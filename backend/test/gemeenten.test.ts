// Meer gemeenten in één inrichting (GR): bereik per account, de gekozen
// gemeente per sessie, gescheiden concepten en de gemeente naar het platform.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { bouwApp } from "../src/app.ts";
import { routes } from "../src/routes/index.ts";
import { Platform } from "../src/platform.ts";
import { vergeetCatalogus } from "../src/routes/metadatamodel.ts";
import { leesGemeenten } from "../src/config.ts";
import { binnenBereik } from "../src/regels.ts";
import { Sleutels, nieuwToken } from "../src/sleutels.ts";
import { verseDatabase, testConfig, kop, wijzig, GEHEIM } from "./hulp.ts";

let pool: pg.Pool, eigenaar: pg.Pool, app: FastifyInstance;
const klok = new Date("2026-11-23T09:00:00Z");
const sleutels = new Sleutels(GEHEIM);
const id: Record<string, string> = {};
const naarPlatform: { methode: string; pad: string; gemeente: string; lichaam?: unknown }[] = [];

const nepFetch = (async (url: string | URL, init?: RequestInit) => {
  const pad = new URL(String(url)).pathname;
  const kop = init?.headers as Record<string, string>;
  naarPlatform.push({ methode: init?.method ?? "GET", pad, gemeente: kop["x-oa-gemeente"]!, lichaam: init?.body ? JSON.parse(String(init.body)) : undefined });
  const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "content-type": "application/json" } });
  if (pad === "/gemeente") return json(200, { nieuw: false });
  if (pad === "/metadatamodellen") return json(200, { modellen: {}, waardelijsten: {}, rollen: [] });
  if (pad === "/objecttypen/document") return json(200, { versie: 1, titel: "Document", schema: { properties: {} } });
  if (pad === "/objecttypen/document/versies") return json(200, []);
  if (pad === "/classificatiemodel") return json(200, { actief: null });
  return json(404, { fout: "niet-gevonden" });
}) as typeof fetch;

async function sessie(account: string): Promise<string> {
  const token = nieuwToken();
  await pool.query("INSERT INTO sessies (account, token_hash, apparaat, ip, aangemaakt, laatst_actief, hard_einde) VALUES ($1, $2, 'test', '192.0.2.1', $3, $3, $4)", [
    account, sleutels.sessieHash(token), klok, new Date(klok.getTime() + 12 * 3600_000),
  ]);
  return `__Host-oa_beheer=${token}`;
}
const vraag = (cookie: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, headers: method === "GET" ? kop({ cookie }) : wijzig({ cookie }), payload: method === "GET" ? undefined : JSON.stringify(payload ?? {}) });
const cookie: Record<string, string> = {};

before(async () => {
  const d = await verseDatabase("oa_beheer_gr");
  pool = d.pool;
  eigenaar = d.eigenaar;
  const config = testConfig("oa_beheer_gr", { GEMEENTEN: "haarlem:Gemeente Haarlem:haarlem.nl,zandvoort:Gemeente Zandvoort:zandvoort.nl,bloemendaal:Gemeente Bloemendaal" });
  const platform = new Platform({ url: "http://platform.test", dienstsleutel: "platform-sleutel-0123456789", gemeenten: config.gemeenten }, nepFetch);
  app = await bouwApp({ config, pool, nu: () => klok, platform }, routes);
  const groep = (await pool.query(
    "INSERT INTO groepen (naam, rechten, niveau) VALUES ('Beheer', '{accounts.view,accounts.manage,metadata.view,metadata.manage,classificatie.view}', 3) RETURNING id",
  )).rows[0].id;
  const leden = (await pool.query("INSERT INTO groepen (naam, rechten, niveau) VALUES ('Leden', '{metadata.view}', 1) RETURNING id")).rows[0].id;
  for (const [s, bereik, g] of [
    ["gr", null, groep], // GR-breed
    ["haarlem", ["haarlem"], groep],
    ["zandvoort", ["zandvoort"], groep],
    ["lid-haarlem", ["haarlem"], leden],
    ["lid-beide", ["haarlem", "zandvoort"], leden],
  ] as const) {
    id[s] = (await pool.query("INSERT INTO accounts (email, naam, gemeenten) VALUES ($1, $1, $2) RETURNING id", [`${s}@test.nl`, bereik])).rows[0].id;
    await pool.query("INSERT INTO lidmaatschappen VALUES ($1, $2)", [id[s], g]);
    cookie[s] = await sessie(id[s]);
  }
  vergeetCatalogus();
});

after(async () => {
  await app.close();
  await pool.end();
  await eigenaar.end();
});

test("GEMEENTEN lezen: met of zonder domeinen; vroeger één GEMEENTE", () => {
  assert.deepEqual(leesGemeenten('"haarlem:Gemeente Haarlem:haarlem.nl+haarlem.org,zandvoort"'), [
    { id: "haarlem", naam: "Gemeente Haarlem" },
    { id: "zandvoort", naam: "Gemeente Zandvoort" },
  ]);
  assert.deepEqual(leesGemeenten(undefined, "haarlem"), [{ id: "haarlem", naam: "Gemeente Haarlem" }]);
  assert.throws(() => leesGemeenten("Haarlem!"));
  assert.equal(binnenBereik(null, null), true);
  assert.equal(binnenBereik(["haarlem"], null), false);
  assert.equal(binnenBereik(["haarlem", "zandvoort"], ["zandvoort"]), true);
});

test("kiezen: een GR-beheerder wisselt van gemeente; een beheerder van één gemeente niet", async () => {
  let r = await vraag(cookie.gr, "GET", "/api/gemeenten");
  assert.equal(r.json().actief.id, "haarlem");
  assert.equal(r.json().keuze.length, 3);
  assert.equal(r.json().grBreed, true);
  r = await vraag(cookie.gr, "PUT", "/api/gemeente", { id: "zandvoort" });
  assert.equal(r.statusCode, 200);
  assert.equal((await vraag(cookie.gr, "GET", "/api/ik")).json().gemeente.naam, "Gemeente Zandvoort");
  r = await vraag(cookie.haarlem, "PUT", "/api/gemeente", { id: "zandvoort" });
  assert.equal(r.statusCode, 403);
  const audit = await eigenaar.query("SELECT details FROM beheer.audit WHERE actie = 'gemeente.gekozen'");
  assert.deepEqual(audit.rows[0].details, { van: "haarlem", naar: "zandvoort" });
});

test("het platform krijgt de gekozen gemeente, en die wordt eerst aangemeld", async () => {
  naarPlatform.length = 0;
  let r = await vraag(cookie.gr, "GET", "/api/classificatie");
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().gemeente, "zandvoort");
  assert.deepEqual(naarPlatform.map((a) => [a.methode, a.pad, a.gemeente]), [["PUT", "/gemeente", "zandvoort"], ["GET", "/classificatiemodel", "zandvoort"]]);
  assert.deepEqual(naarPlatform[0]!.lichaam, { naam: "Gemeente Zandvoort" });
  naarPlatform.length = 0;
  r = await vraag(cookie.haarlem, "GET", "/api/classificatie");
  assert.equal(r.json().gemeente, "haarlem");
  assert.ok(naarPlatform.every((a) => a.gemeente === "haarlem"));
});

test("concepten van het metadatamodel zijn per gemeente", async () => {
  await vraag(cookie.haarlem, "PUT", "/api/metadatamodel/concept", { config: { basis: "mdto", naam: "Haarlem", velden: [] } });
  await vraag(cookie.zandvoort, "PUT", "/api/metadatamodel/concept", { config: { basis: "rgbz", naam: "Zandvoort", velden: [] } });
  const h = (await vraag(cookie.haarlem, "GET", "/api/metadatamodel")).json();
  const z = (await vraag(cookie.zandvoort, "GET", "/api/metadatamodel")).json();
  assert.equal(h.concept?.config.naam, "Haarlem", JSON.stringify(h));
  assert.equal(z.concept?.config.naam, "Zandvoort");
  await vraag(cookie.zandvoort, "DELETE", "/api/metadatamodel/concept");
  assert.equal((await vraag(cookie.haarlem, "GET", "/api/metadatamodel")).json().concept?.config.naam, "Haarlem", "verwijderen raakt de andere gemeente niet");
});

test("accounts: een beheerder van één gemeente ziet en beheert alleen accounts van die gemeente", async () => {
  const zien = async (wie: string) => (await vraag(cookie[wie]!, "GET", "/api/accounts")).json().map((a: { email: string }) => a.email).sort();
  assert.deepEqual(await zien("haarlem"), ["haarlem@test.nl", "lid-haarlem@test.nl"]);
  assert.ok((await zien("gr")).includes("lid-beide@test.nl"));
  assert.equal((await vraag(cookie.haarlem, "GET", `/api/accounts/${id["lid-beide"]}`)).statusCode, 404);
  assert.equal((await vraag(cookie.haarlem, "GET", `/api/accounts/${id.gr}`)).statusCode, 404);
  // Een account dat ook bij Zandvoort hoort, mag Haarlem niet wijzigen.
  let r = await vraag(cookie.haarlem, "PUT", `/api/accounts/${id["lid-beide"]}`, { naam: "x", taal: "nl" });
  assert.equal(r.json().fout, "andere-gemeente");
  r = await vraag(cookie.gr, "PUT", `/api/accounts/${id["lid-beide"]}`, { naam: "Lid van beide", taal: "nl" });
  assert.equal(r.statusCode, 200);
});

test("accounts: aanmaken krijgt de gemeente die je beheert; meer of alle alleen binnen je eigen bereik", async () => {
  let r = await vraag(cookie.haarlem, "POST", "/api/accounts", { email: "nieuw-h@test.nl", naam: "Nieuw", taal: "nl", groepen: [], reden: "Nieuwe collega" });
  assert.equal(r.statusCode, 201, r.body);
  assert.deepEqual((await pool.query("SELECT gemeenten FROM accounts WHERE id = $1", [r.json().id])).rows[0].gemeenten, ["haarlem"]);
  r = await vraag(cookie.haarlem, "POST", "/api/accounts", { email: "nieuw-z@test.nl", naam: "Nieuw", taal: "nl", groepen: [], gemeenten: ["zandvoort"], reden: "Nieuwe collega" });
  assert.equal(r.json().fout, "bereik-buiten-eigen");
  r = await vraag(cookie.haarlem, "POST", "/api/accounts", { email: "nieuw-a@test.nl", naam: "Nieuw", taal: "nl", groepen: [], gemeenten: null, reden: "Nieuwe collega" });
  assert.equal(r.json().fout, "bereik-buiten-eigen");
  r = await vraag(cookie.gr, "POST", "/api/accounts", { email: "nieuw-gr@test.nl", naam: "Nieuw", taal: "nl", groepen: [], gemeenten: ["velsen"], reden: "Nieuwe collega" });
  assert.equal(r.json().fout, "gemeente-onbekend");
  // Het bereik wijzigen: de GR-beheerder maakt iemand GR-breed; dat staat in de audit.
  r = await vraag(cookie.gr, "PUT", `/api/accounts/${id["lid-haarlem"]}/gemeenten`, { gemeenten: null, reden: "Werkt voor de hele GR" });
  assert.equal(r.statusCode, 200);
  const a = await eigenaar.query("SELECT details FROM beheer.audit WHERE actie = 'account.gemeenten'");
  assert.deepEqual(a.rows[0].details, { oud: ["haarlem"], nieuw: "alle", reden: "Werkt voor de hele GR" });
  // Nu hoort dat account ook bij andere gemeenten: de Haarlemse beheerder ziet het niet meer.
  assert.equal((await vraag(cookie.haarlem, "GET", `/api/accounts/${id["lid-haarlem"]}`)).statusCode, 404);
});

test("de audit van elke aanroep noemt de gemeente", async () => {
  await vraag(cookie.zandvoort, "GET", "/api/gemeenten");
  const r = await eigenaar.query("SELECT details FROM beheer.audit WHERE account = $1 AND actie = 'GET /api/gemeenten' ORDER BY id DESC LIMIT 1", [id.zandvoort]);
  assert.equal(r.rows[0].details.gemeente, "zandvoort");
});
