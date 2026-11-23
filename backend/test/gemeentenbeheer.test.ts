// Pagina Gemeenten: een gemeente toevoegen en wijzigen, met e-maildomeinen.
// Keycloak en het platform zijn nagebootst; de echte Keycloak-aanroepen zijn
// apart getest tegen Keycloak 26.8.2.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { bouwApp } from "../src/app.ts";
import { routes } from "../src/routes/index.ts";
import { Platform } from "../src/platform.ts";
import { KeycloakBeheer, type Organisatie } from "../src/keycloakbeheer.ts";
import { normaliseer, toetsDomein } from "../src/domeinen.ts";
import { Sleutels, nieuwToken } from "../src/sleutels.ts";
import { verseDatabase, testConfig, kop, wijzig, GEHEIM } from "./hulp.ts";

let pool: pg.Pool, eigenaar: pg.Pool, app: FastifyInstance;
const klok = new Date("2026-11-23T18:00:00Z");
const sleutels = new Sleutels(GEHEIM);
const cookie: Record<string, string> = {};
const id: Record<string, string> = {};

// Nagebootste Keycloak: token, organisaties, tellen.
const organisaties: Organisatie[] = [{ id: "o-1", alias: "haarlem", name: "Gemeente Haarlem", domains: [{ name: "haarlem.nl", verified: true }], attributes: { naam: ["Gemeente Haarlem"] } },
  { id: "o-2", alias: "heemstede", name: "Gemeente Heemstede", domains: [{ name: "heemstede.nl", verified: true }], attributes: { naam: ["Gemeente Heemstede"] } }];
const nepKeycloak = (async (url: string | URL, init?: RequestInit) => {
  const u = new URL(String(url));
  const json = (status: number, j: unknown) => new Response(j === undefined ? null : JSON.stringify(j), { status, headers: { "content-type": "application/json" } });
  if (u.pathname.endsWith("/token")) return json(200, { access_token: "t", expires_in: 300 });
  if (u.pathname.endsWith("/organizations") && (init?.method ?? "GET") === "GET") return json(200, organisaties);
  if (u.pathname.endsWith("/organizations") && init?.method === "POST") {
    const o = JSON.parse(String(init.body));
    organisaties.push({ ...o, id: `o-${organisaties.length + 1}` });
    return json(201, undefined);
  }
  const m = /\/organizations\/([^/]+)$/.exec(u.pathname);
  if (m && init?.method === "PUT") {
    const i = organisaties.findIndex((o) => o.id === decodeURIComponent(m[1]!));
    organisaties[i] = JSON.parse(String(init.body));
    return json(204, undefined);
  }
  if (u.pathname.endsWith("/users/count")) return json(200, u.searchParams.get("email") === "@bloemendaal.nl" ? 3 : 0);
  return json(404, {});
}) as typeof fetch;
const naarPlatform: { pad: string; gemeente: string; lichaam: unknown }[] = [];
const nepPlatform = (async (url: string | URL, init?: RequestInit) => {
  naarPlatform.push({ pad: new URL(String(url)).pathname, gemeente: (init?.headers as Record<string, string>)["x-oa-gemeente"]!, lichaam: init?.body ? JSON.parse(String(init.body)) : undefined });
  return new Response(JSON.stringify({ nieuw: true }), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

async function sessie(account: string): Promise<string> {
  const token = nieuwToken();
  await pool.query("INSERT INTO sessies (account, token_hash, apparaat, ip, aangemaakt, laatst_actief, hard_einde) VALUES ($1, $2, 'test', '192.0.2.1', $3, $3, $4)", [
    account, sleutels.sessieHash(token), klok, new Date(klok.getTime() + 12 * 3600_000),
  ]);
  return `__Host-oa_beheer=${token}`;
}
const vraag = (c: string, method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
  app.inject({ method, url, headers: method === "GET" ? kop({ cookie: c }) : wijzig({ cookie: c }), payload: method === "GET" ? undefined : JSON.stringify(payload ?? {}) });

before(async () => {
  const d = await verseDatabase("oa_beheer_gb");
  pool = d.pool;
  eigenaar = d.eigenaar;
  const config = testConfig("oa_beheer_gb", { GEMEENTEN: "haarlem:Gemeente Haarlem:haarlem.nl,zandvoort:Gemeente Zandvoort:zandvoort.nl" });
  const keycloak = new KeycloakBeheer("https://id.test.nl/realms/gemeenten", "oa-beheer", "geheim", nepKeycloak);
  const platform = new Platform({ url: "http://platform.test", dienstsleutel: "platform-sleutel-0123456789" }, nepPlatform);
  app = await bouwApp({ config, pool, nu: () => klok, platform, keycloak }, routes);
  const g = async (naam: string, rechten: string[]) => (await pool.query("INSERT INTO groepen (naam, rechten, niveau) VALUES ($1, $2, 3) RETURNING id", [naam, rechten])).rows[0].id;
  const superbeheer = await g("Superbeheer", ["gemeenten.manage", "accounts.view"]);
  const gewoon = await g("Beheer", ["accounts.view"]);
  for (const [s, bereik, groep] of [["super", null, superbeheer], ["super-haarlem", ["haarlem"], superbeheer], ["gewoon", null, gewoon]] as const) {
    id[s] = (await pool.query("INSERT INTO accounts (email, naam, gemeenten) VALUES ($1, $1, $2) RETURNING id", [`${s}@test.nl`, bereik])).rows[0].id;
    await pool.query("INSERT INTO lidmaatschappen VALUES ($1, $2)", [id[s], groep]);
    cookie[s] = await sessie(id[s]);
  }
});

after(async () => {
  await app.close();
  await pool.end();
  await eigenaar.end();
});

test("domeinen: opschonen, geen algemene, geldig", () => {
  assert.equal(normaliseer(" @WWW.Haarlem.NL. "), "haarlem.nl");
  assert.equal(toetsDomein("haarlem.nl"), null);
  assert.match(toetsDomein("gmail.com")!, /algemeen/);
  assert.match(toetsDomein("mail.ziggo.nl")!, /algemeen/);
  assert.match(toetsDomein("haarlem")!, /geen geldig domein/);
  assert.match(toetsDomein("-x.nl")!, /geen geldig domein/);
});

test("alleen GR-breed met het recht gemeenten.manage", async () => {
  assert.equal((await vraag(cookie["super-haarlem"]!, "GET", "/api/gemeenten/beheer")).json().fout, "niet-gr-breed");
  assert.equal((await vraag(cookie.gewoon!, "GET", "/api/gemeenten/beheer")).statusCode, 403);
  assert.equal((await vraag(cookie.super!, "GET", "/api/gemeenten/beheer")).statusCode, 200);
});

test("overzicht: uit de configuratie en uit Keycloak, met de stand per gemeente", async () => {
  const r = (await vraag(cookie.super!, "GET", "/api/gemeenten/beheer")).json();
  const per = Object.fromEntries(r.gemeenten.map((g: { id: string; keycloak: string }) => [g.id, g.keycloak]));
  // Haarlem staat in beide; Zandvoort alleen in de configuratie; Heemstede alleen in Keycloak (overgenomen).
  assert.deepEqual(per, { haarlem: "ok", heemstede: "ok", zandvoort: "ontbreekt" });
});

test("toevoegen: naam en domeinen; in Keycloak, bij het platform en in de audit", async () => {
  let r = await vraag(cookie.super!, "POST", "/api/gemeenten", { id: "bloemendaal", naam: "Gemeente Bloemendaal", domeinen: ["@Bloemendaal.nl", "bloemendaal.nl"], reden: "Treedt toe tot de GR" });
  assert.equal(r.statusCode, 201, r.body);
  assert.deepEqual(r.json().domeinen, ["bloemendaal.nl"]);
  const o = organisaties.find((x) => x.alias === "bloemendaal")!;
  assert.deepEqual(o.domains, [{ name: "bloemendaal.nl", verified: true }]);
  assert.deepEqual(o.attributes, { naam: ["Gemeente Bloemendaal"] });
  assert.deepEqual(naarPlatform.at(-1), { pad: "/gemeente", gemeente: "bloemendaal", lichaam: { naam: "Gemeente Bloemendaal" } });
  const a = await eigenaar.query("SELECT details FROM beheer.audit WHERE actie = 'gemeente.aangemaakt'");
  assert.equal(a.rows[0].details.reden, "Treedt toe tot de GR");
  // In het overzicht, met het aantal gebruikers op het domein; en meteen te kiezen.
  const ov = (await vraag(cookie.super!, "GET", "/api/gemeenten/beheer")).json();
  assert.deepEqual(ov.gemeenten.find((g: { id: string }) => g.id === "bloemendaal").gebruikers, { "bloemendaal.nl": 3 });
  r = await vraag(cookie.super!, "PUT", "/api/gemeente", { id: "bloemendaal" });
  assert.equal(r.statusCode, 200);
});

test("toevoegen weigert: algemene domeinen, een domein van een andere gemeente, een bestaande code", async () => {
  const fout = async (b: object) => (await vraag(cookie.super!, "POST", "/api/gemeenten", { reden: "Treedt toe tot de GR", ...b })).json().fout;
  assert.equal(await fout({ id: "x1", naam: "Gemeente X", domeinen: ["gmail.com"] }), "domein-ongeldig");
  assert.equal(await fout({ id: "x1", naam: "Gemeente X", domeinen: ["haarlem.nl"] }), "domein-bezet");
  assert.equal(await fout({ id: "x1", naam: "Gemeente X", domeinen: ["heemstede.nl"] }), "domein-bezet");
  assert.equal(await fout({ id: "haarlem", naam: "Gemeente X", domeinen: ["x.nl"] }), "gemeente-bestaat");
  assert.equal(await fout({ id: "x1", naam: "Gemeente X", domeinen: [] }), "verzoek-ongeldig");
});

test("wijzigen: naam en domeinen, ook in Keycloak; een gemeente die daar ontbreekt, komt erbij", async () => {
  let r = await vraag(cookie.super!, "PUT", "/api/gemeenten/haarlem", { naam: "Gemeente Haarlem", domeinen: ["haarlem.nl", "haarlem.org"], reden: "Tweede domein" });
  assert.equal(r.statusCode, 200, r.body);
  assert.deepEqual(organisaties.find((x) => x.alias === "haarlem")!.domains!.map((x) => x.name), ["haarlem.nl", "haarlem.org"]);
  r = await vraag(cookie.super!, "PUT", "/api/gemeenten/zandvoort", { naam: "Gemeente Zandvoort", domeinen: ["zandvoort.nl"], reden: "Ook in Keycloak" });
  assert.equal(r.statusCode, 200, r.body);
  assert.ok(organisaties.some((x) => x.alias === "zandvoort"));
  const a = await eigenaar.query("SELECT details FROM beheer.audit WHERE actie = 'gemeente.gewijzigd' ORDER BY id LIMIT 1");
  assert.deepEqual(a.rows[0].details.oud.domeinen, ["haarlem.nl"]);
});
