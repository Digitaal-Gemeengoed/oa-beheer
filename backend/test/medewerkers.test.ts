// Pagina Medewerkers: het PPL-niveau van medewerkers van de gemeente die je
// beheert. Keycloak is nagebootst, met dezelfde grenzen als het echte
// service-account (alleen ppl-rollen toekennen); de echte aanroepen zijn apart
// getest tegen Keycloak 26.8.2.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { bouwApp } from "../src/app.ts";
import { routes } from "../src/routes/index.ts";
import { KeycloakBeheer } from "../src/keycloakbeheer.ts";
import { Sleutels, nieuwToken } from "../src/sleutels.ts";
import { verseDatabase, testConfig, kop, wijzig, GEHEIM } from "./hulp.ts";

let pool: pg.Pool, eigenaar: pg.Pool, app: FastifyInstance;
const klok = new Date("2026-11-26T09:00:00Z");
const sleutels = new Sleutels(GEHEIM);
const cookie: Record<string, string> = {};

const U = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const ROL: Record<string, string> = { medewerker: "r-m", beheerder: "r-b", vrijgever: "r-v", "ppl-1": "r-1", "ppl-2": "r-2", "ppl-3": "r-3" };
// Femke is lid van de organisatie Haarlem; Test heeft het attribuut gemeente=haarlem; Zoë is van Zandvoort; Ilse beheert het portaal.
const gebruikers = [
  { id: U(1), username: "femke@haarlem.nl", email: "femke@haarlem.nl", firstName: "Femke", lastName: "de Vries", org: "o-1", attributes: {} },
  { id: U(2), username: "test.haarlem", email: undefined, org: null, attributes: { gemeente: ["haarlem"] } },
  { id: U(3), username: "zoe@zandvoort.nl", email: "zoe@zandvoort.nl", org: "o-2", attributes: {} },
  { id: U(4), username: "ilse@haarlem.nl", email: "ilse@haarlem.nl", org: "o-1", attributes: {} },
];
const rollen: Record<string, string[]> = { [U(1)]: ["medewerker", "ppl-1"], [U(2)]: ["medewerker"], [U(3)]: ["medewerker", "ppl-1"], [U(4)]: ["medewerker", "beheerder", "ppl-3"] };
const nepKeycloak = (async (url: string | URL, init?: RequestInit) => {
  const u = new URL(String(url));
  const m = init?.method ?? "GET";
  const json = (status: number, j?: unknown) => new Response(j === undefined ? null : JSON.stringify(j), { status, headers: { "content-type": "application/json" } });
  const naarRollen = (namen: string[]) => namen.map((name) => ({ id: ROL[name], name }));
  const pad = u.pathname.replace(/^.*\/admin\/realms\/gemeenten/, "");
  if (u.pathname.endsWith("/token")) return json(200, { access_token: "t", expires_in: 300 });
  if (pad === "/organizations") return json(200, [{ id: "o-1", alias: "haarlem", name: "Gemeente Haarlem" }, { id: "o-2", alias: "zandvoort", name: "Gemeente Zandvoort" }]);
  let x = /^\/organizations\/([^/]+)\/members$/.exec(pad);
  if (x) return json(200, gebruikers.filter((g) => g.org === x![1]));
  x = /^\/organizations\/([^/]+)\/members\/([^/]+)$/.exec(pad);
  if (x) return gebruikers.some((g) => g.org === x![1] && g.id === x![2]) ? json(200, {}) : json(404, {});
  if (pad === "/users") {
    const [k, v] = (u.searchParams.get("q") ?? ":").split(":");
    return json(200, gebruikers.filter((g) => (g.attributes as Record<string, string[]>)[k!]?.includes(v!)));
  }
  x = /^\/users\/([^/]+)$/.exec(pad);
  if (x) { const g = gebruikers.find((y) => y.id === x![1]); return g ? json(200, g) : json(404, {}); }
  x = /^\/users\/([^/]+)\/role-mappings\/realm(\/available)?$/.exec(pad);
  if (x) {
    const id = x[1]!;
    if (x[2]) return json(200, naarRollen(["ppl-1", "ppl-2", "ppl-3"].filter((r) => !rollen[id]!.includes(r))));
    if (m === "GET") return json(200, naarRollen(rollen[id]!));
    const lijst = JSON.parse(String(init!.body)) as { name: string }[];
    if (lijst.some((r) => !/^ppl-[123]$/.test(r.name))) return json(403, {});
    rollen[id] = m === "POST" ? [...rollen[id]!, ...lijst.map((r) => r.name)] : rollen[id]!.filter((r) => !lijst.some((y) => y.name === r));
    return json(204);
  }
  return json(404, {});
}) as typeof fetch;

async function sessie(account: string): Promise<string> {
  const token = nieuwToken();
  await pool.query("INSERT INTO sessies (account, token_hash, apparaat, ip, aangemaakt, laatst_actief, hard_einde) VALUES ($1, $2, 'test', '192.0.2.1', $3, $3, $4)", [
    account, sleutels.sessieHash(token), klok, new Date(klok.getTime() + 12 * 3600_000),
  ]);
  return `__Host-oa_beheer=${token}`;
}
const vraag = (c: string, method: "GET" | "PUT", url: string, payload?: object) =>
  app.inject({ method, url, headers: method === "GET" ? kop({ cookie: c }) : wijzig({ cookie: c }), payload: method === "GET" ? undefined : JSON.stringify(payload ?? {}) });

before(async () => {
  const d = await verseDatabase("oa_beheer_mw");
  pool = d.pool;
  eigenaar = d.eigenaar;
  const config = testConfig("oa_beheer_mw", { GEMEENTEN: "haarlem:Gemeente Haarlem:haarlem.nl,zandvoort:Gemeente Zandvoort:zandvoort.nl" });
  const keycloak = new KeycloakBeheer("https://id.test.nl/realms/gemeenten", "oa-beheer", "geheim", nepKeycloak);
  app = await bouwApp({ config, pool, nu: () => klok, keycloak }, routes);
  const g = async (naam: string, rechten: string[]) => (await pool.query("INSERT INTO groepen (naam, rechten, niveau) VALUES ($1, $2, 3) RETURNING id", [naam, rechten])).rows[0].id;
  const beheer = await g("Medewerkers", ["medewerkers.view", "medewerkers.manage"]);
  const kijken = await g("Kijken", ["medewerkers.view"]);
  for (const [email, bereik, groep] of [["ilse@haarlem.nl", ["haarlem"], beheer], ["kijk@haarlem.nl", ["haarlem"], kijken], ["anne@zandvoort.nl", ["zandvoort"], beheer]] as const) {
    const id = (await pool.query("INSERT INTO accounts (email, naam, gemeenten) VALUES ($1, $1, $2) RETURNING id", [email, bereik])).rows[0].id;
    await pool.query("INSERT INTO lidmaatschappen VALUES ($1, $2)", [id, groep]);
    cookie[email] = await sessie(id);
  }
});

after(async () => {
  await app.close();
  await pool.end();
  await eigenaar.end();
});

test("overzicht: leden van de organisatie en wie het attribuut gemeente heeft, met rollen en niveau", async () => {
  const r = await vraag(cookie["kijk@haarlem.nl"]!, "GET", "/api/medewerkers");
  assert.equal(r.statusCode, 200, r.body);
  const j = r.json();
  assert.equal(j.gemeente, "haarlem");
  assert.equal(j.magWijzigen, false);
  assert.deepEqual(j.medewerkers.map((m: { gebruikersnaam: string; niveau: number; rollen: string[] }) => [m.gebruikersnaam, m.niveau, m.rollen.join(",")]), [
    ["femke@haarlem.nl", 1, "medewerker"],
    ["ilse@haarlem.nl", 3, "medewerker,beheerder"],
    ["test.haarlem", 0, "medewerker"],
  ]);
  assert.equal(j.medewerkers.find((m: { naam: string }) => m.naam === "Femke de Vries") !== undefined, true);
});

test("niveau wijzigen: met reden, in Keycloak en in de audit", async () => {
  const r = await vraag(cookie["ilse@haarlem.nl"]!, "PUT", `/api/medewerkers/${U(2)}/niveau`, { niveau: 2, reden: "Wmo-consulent, werkt met gezondheidsgegevens" });
  assert.equal(r.statusCode, 200, r.body);
  assert.deepEqual(rollen[U(2)], ["medewerker", "ppl-2"]);
  // Omlaag: de hogere rol gaat weg; 0: geen ppl-rol meer.
  await vraag(cookie["ilse@haarlem.nl"]!, "PUT", `/api/medewerkers/${U(2)}/niveau`, { niveau: 1, reden: "Andere functie" });
  assert.deepEqual(rollen[U(2)], ["medewerker", "ppl-1"]);
  await vraag(cookie["ilse@haarlem.nl"]!, "PUT", `/api/medewerkers/${U(1)}/niveau`, { niveau: 0, reden: "Uit dienst per 1 december" });
  assert.deepEqual(rollen[U(1)], ["medewerker"]);
  const a = await eigenaar.query("SELECT doel, details FROM beheer.audit WHERE actie = 'medewerker.niveau' ORDER BY id");
  assert.deepEqual(a.rows.map((x) => [x.details.medewerker, x.details.van, x.details.naar]), [["test.haarlem", 0, 2], ["test.haarlem", 2, 1], ["femke@haarlem.nl", 1, 0]]);
  assert.equal(a.rows[0].details.reden, "Wmo-consulent, werkt met gezondheidsgegevens");
});

test("weigert: zonder recht, zonder reden, een medewerker van een andere gemeente, je eigen niveau", async () => {
  const zet = (c: string, id: string, b: object) => vraag(cookie[c]!, "PUT", `/api/medewerkers/${id}/niveau`, b);
  assert.equal((await zet("kijk@haarlem.nl", U(2), { niveau: 3, reden: "Zomaar even" })).statusCode, 403);
  assert.equal((await zet("ilse@haarlem.nl", U(2), { niveau: 3 })).json().fout, "verzoek-ongeldig");
  assert.equal((await zet("ilse@haarlem.nl", U(2), { niveau: 4, reden: "Te hoog niveau" })).json().fout, "verzoek-ongeldig");
  assert.equal((await zet("ilse@haarlem.nl", U(3), { niveau: 3, reden: "Andere gemeente" })).json().fout, "niet-gevonden");
  assert.equal((await zet("anne@zandvoort.nl", U(2), { niveau: 3, reden: "Andere gemeente" })).json().fout, "niet-gevonden");
  assert.equal((await zet("ilse@haarlem.nl", U(4), { niveau: 1, reden: "Mijn eigen niveau" })).json().fout, "eigen-niveau");
  assert.deepEqual(rollen[U(3)], ["medewerker", "ppl-1"]);
  assert.deepEqual(rollen[U(4)], ["medewerker", "beheerder", "ppl-3"]);
  // Wie zelf een account is, ziet dat in de lijst.
  const j = (await vraag(cookie["ilse@haarlem.nl"]!, "GET", "/api/medewerkers")).json();
  assert.equal(j.medewerkers.find((m: { zelf: boolean }) => m.zelf).gebruikersnaam, "ilse@haarlem.nl");
});
