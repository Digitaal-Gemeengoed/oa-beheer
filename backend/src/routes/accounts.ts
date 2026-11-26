import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppFout } from "../app.js";
import { schrijfAudit } from "../audit.js";
import { inTransactie } from "../db.js";
import { bericht } from "../mail.js";
import { voerStatuswijzigingenUit } from "../persoon.js";
import { binnenBereik, laadDoel, laadGroepen, magBeheren, magGroepGeven, weigerAls } from "../regels.js";
import { beeindigAlle } from "../sessies.js";
import { vereis } from "../toegang.js";

const UUID = { type: "string", pattern: "^[0-9a-fA-F-]{36}$" } as const;
const REDEN = { type: "string", minLength: 5, maxLength: 1000 } as const;
const STATUS = { enum: ["actief", "geblokkeerd", "gedeactiveerd"] } as const;
/** De gemeenten van een account: een lijst, of null = alle (GR-breed). */
const BEREIK = { anyOf: [{ type: "null" }, { type: "array", minItems: 1, maxItems: 100, uniqueItems: true, items: { type: "string", pattern: "^[a-z0-9-]{2,40}$" } }] } as const;

/** Een beheerder ziet zichzelf en de accounts binnen zijn bereik. */
const zichtbaar = (p: { id: string; bereik: string[] | null }, a: { id: string; bereik?: string[] | null }) => a.id === p.id || binnenBereik(p.bereik, a.bereik);

/** De uitnodiging voor het portaal; bij opnieuw sturen dezelfde tekst. */
function uitnodiging(van: string, email: string, taal: string, herkomst: string) {
  return taal === "en"
    ? bericht([email], "You have access to the Office Assistant admin portal", [`${van} has given you access to ${herkomst}.`, "You sign in with your municipality account (Keycloak), the same as for the Office Assistant. If you have not set that up yet, you will receive a separate email from Keycloak to choose a password and link your authenticator app.", `Sign in: ${herkomst}/`])
    : bericht([email], "Je hebt toegang tot het beheerportaal van de Office Assistent", [`${van} heeft je toegang gegeven tot ${herkomst}.`, "Je logt in met je account van de gemeente (Keycloak), hetzelfde als voor de Office Assistent. Heb je dat nog niet ingesteld, dan krijg je van Keycloak een aparte mail om een wachtwoord te kiezen en je authenticator-app te koppelen.", `Inloggen: ${herkomst}/`]);
}
export async function accountRoutes(app: FastifyInstance): Promise<void> {
  const d = app.diensten;

  /** Alleen gemeenten van de inrichting, en alleen binnen je eigen bereik; "alle" alleen GR-breed. */
  const toetsBereik = (req: FastifyRequest, bereik: string[] | null) => {
    if (bereik && bereik.some((g) => !(req.gemeenten ?? []).some((x) => x.id === g))) throw new AppFout(400, "gemeente-onbekend", "Een van de gemeenten hoort niet bij deze inrichting.");
    if (!binnenBereik(req.persoon!.bereik, bereik)) weigerAls("bereik-buiten-eigen");
  };

  app.get("/api/accounts", async (req) => {
    vereis(req, "accounts.view");
    const r = await d.pool.query(
      `SELECT a.id, a.email, a.naam, a.taal, a.status, a.hoofdaccount, a.aangemaakt, a.gemeenten AS bereik, a.keycloak_sub IS NOT NULL AS gekoppeld,
              coalesce(max(g.niveau), 0)::int AS niveau,
              coalesce(array_agg(g.naam ORDER BY g.naam) FILTER (WHERE g.id IS NOT NULL), '{}') AS groepen,
              (SELECT max(laatst_actief) FROM sessies s WHERE s.account = a.id) AS laatst_actief,
              (SELECT count(*)::int FROM statuswijzigingen w WHERE w.account = a.id AND w.uitgevoerd IS NULL AND w.geannuleerd IS NULL) AS gepland
         FROM accounts a LEFT JOIN lidmaatschappen l ON l.account = a.id LEFT JOIN groepen g ON g.id = l.groep
        GROUP BY a.id ORDER BY a.hoofdaccount DESC, a.naam`,
    );
    const p = req.persoon!;
    return r.rows.filter((a) => zichtbaar(p, a)).map((a) => ({ ...a, beheerbaar: p.rechten.has("accounts.manage") && magBeheren(p, a) === null }));
  });

  app.get<{ Params: { id: string } }>("/api/accounts/:id", { schema: { params: { type: "object", properties: { id: UUID } } } }, async (req) => {
    vereis(req, "accounts.view");
    const a = await laadDoel(d.pool, req.params.id);
    if (!zichtbaar(req.persoon!, a)) throw new AppFout(404, "niet-gevonden", "Dit account bestaat niet.");
    const groepen = (await d.pool.query("SELECT g.id, g.naam, g.niveau FROM lidmaatschappen l JOIN groepen g ON g.id = l.groep WHERE l.account = $1 ORDER BY g.naam", [a.id])).rows;
    const wijzigingen = (await d.pool.query(
      `SELECT w.id, w.status, w.reden, w.ingang, w.uitgevoerd, w.aangemaakt, b.naam AS door, w.geannuleerd, w.reden_annulering, x.naam AS geannuleerd_door
         FROM statuswijzigingen w JOIN accounts b ON b.id = w.door LEFT JOIN accounts x ON x.id = w.geannuleerd_door
        WHERE w.account = $1 ORDER BY w.ingang DESC LIMIT 50`,
      [a.id],
    )).rows;
    const sessies = (await d.pool.query("SELECT count(*)::int AS n FROM sessies WHERE account = $1 AND beeindigd IS NULL AND hard_einde > now()", [a.id])).rows[0].n;
    const laatst = (await d.pool.query("SELECT max(laatst_actief) AS t FROM sessies WHERE account = $1", [a.id])).rows[0].t;
    return { ...a, groepen, wijzigingen, actieveSessies: sessies, laatst_actief: laatst, beheerbaar: req.persoon!.rechten.has("accounts.manage") && magBeheren(req.persoon!, a) === null };
  });

  /** Een account toevoegen. Nooit door zelf aan te melden; de persoon logt in via Keycloak met dit e-mailadres. */
  app.post<{ Body: { email: string; naam: string; taal: "nl" | "en"; groepen: string[]; gemeenten?: string[] | null; reden: string } }>(
    "/api/accounts",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "naam", "taal", "groepen", "reden"],
          additionalProperties: false,
          properties: {
            email: { type: "string", minLength: 3, maxLength: 254, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
            naam: { type: "string", minLength: 1, maxLength: 200 },
            taal: { enum: ["nl", "en"] },
            groepen: { type: "array", maxItems: 20, items: UUID, uniqueItems: true },
            gemeenten: BEREIK,
            reden: REDEN,
          },
        },
      },
    },
    async (req, antwoord) => {
      vereis(req, "accounts.manage");
      const p = req.persoon!;
      const groepen = await laadGroepen(d.pool, req.body.groepen);
      for (const g of groepen) weigerAls(magGroepGeven(p, g));
      // Zonder keuze: de gemeente die je nu beheert (of GR-breed als de inrichting geen gemeenten noemt).
      const bereik = req.body.gemeenten !== undefined ? req.body.gemeenten : p.gemeente ? [p.gemeente] : null;
      toetsBereik(req, bereik);
      const email = req.body.email.toLowerCase();
      const id = await inTransactie(d.pool, async (c) => {
        const bestaat = await c.query("SELECT 1 FROM accounts WHERE email = $1", [email]);
        if (bestaat.rowCount) throw new AppFout(409, "bestaat-al", "Er is al een account met dit e-mailadres.");
        const nieuw = (await c.query("INSERT INTO accounts (email, naam, taal, aangemaakt_door, gemeenten) VALUES ($1, $2, $3, $4, $5) RETURNING id", [email, req.body.naam, req.body.taal, p.id, bereik])).rows[0].id;
        for (const g of groepen) await c.query("INSERT INTO lidmaatschappen (account, groep) VALUES ($1, $2)", [nieuw, g.id]);
        await schrijfAudit(c, { account: p.id, email: p.email, actie: "account.aangemaakt", doel: nieuw, ip: req.ip, resultaat: "ok", details: { email, naam: req.body.naam, groepen: groepen.map((g) => g.naam), gemeenten: bereik ?? "alle", reden: req.body.reden } });
        return nieuw;
      });
      await d.mailer.verstuur(uitnodiging(p.naam, email, req.body.taal, d.config.herkomst)).catch((e) => req.log.error({ fout: (e as Error).message }, "uitnodiging niet verstuurd"));
      return antwoord.code(201).send({ id });
    },
  );

  app.put<{ Params: { id: string }; Body: { naam: string; taal: "nl" | "en" } }>(
    "/api/accounts/:id",
    { schema: { params: { type: "object", properties: { id: UUID } }, body: { type: "object", required: ["naam", "taal"], additionalProperties: false, properties: { naam: { type: "string", minLength: 1, maxLength: 200 }, taal: { enum: ["nl", "en"] } } } } },
    async (req) => {
      vereis(req, "accounts.manage");
      const p = req.persoon!;
      const a = await laadDoel(d.pool, req.params.id);
      weigerAls(magBeheren(p, a));
      await d.pool.query("UPDATE accounts SET naam = $2, taal = $3 WHERE id = $1", [a.id, req.body.naam, req.body.taal]);
      await schrijfAudit(d.pool, { account: p.id, email: p.email, actie: "account.gewijzigd", doel: a.id, ip: req.ip, resultaat: "ok", details: { oud: { naam: a.naam }, nieuw: { naam: req.body.naam, taal: req.body.taal } } });
      return {};
    },
  );

  /** Groepen van een account vervangen. Elke groep die erbij komt of eraf gaat, moet je mogen geven. */
  app.put<{ Params: { id: string }; Body: { groepen: string[]; reden: string } }>(
    "/api/accounts/:id/groepen",
    { schema: { params: { type: "object", properties: { id: UUID } }, body: { type: "object", required: ["groepen", "reden"], additionalProperties: false, properties: { groepen: { type: "array", maxItems: 20, items: UUID, uniqueItems: true }, reden: REDEN } } } },
    async (req) => {
      vereis(req, "accounts.manage");
      const p = req.persoon!;
      const a = await laadDoel(d.pool, req.params.id);
      weigerAls(magBeheren(p, a));
      await inTransactie(d.pool, async (c) => {
        const huidig = (await c.query("SELECT groep FROM lidmaatschappen WHERE account = $1", [a.id])).rows.map((r) => r.groep as string);
        const erbij = req.body.groepen.filter((g) => !huidig.includes(g));
        const eraf = huidig.filter((g) => !req.body.groepen.includes(g));
        const betrokken = await laadGroepen(c, [...erbij, ...eraf]);
        for (const g of betrokken) weigerAls(magGroepGeven(p, g));
        for (const g of eraf) await c.query("DELETE FROM lidmaatschappen WHERE account = $1 AND groep = $2", [a.id, g]);
        for (const g of erbij) await c.query("INSERT INTO lidmaatschappen (account, groep) VALUES ($1, $2)", [a.id, g]);
        const naam = (id: string) => betrokken.find((g) => g.id === id)?.naam ?? id;
        await schrijfAudit(c, { account: p.id, email: p.email, actie: "account.groepen", doel: a.id, ip: req.ip, resultaat: "ok", details: { erbij: erbij.map(naam), eraf: eraf.map(naam), reden: req.body.reden } });
      });
      return {};
    },
  );

  /** De gemeenten van een account: een lijst, of null = alle gemeenten van de inrichting. */
  app.put<{ Params: { id: string }; Body: { gemeenten: string[] | null; reden: string } }>(
    "/api/accounts/:id/gemeenten",
    { schema: { params: { type: "object", properties: { id: UUID } }, body: { type: "object", required: ["gemeenten", "reden"], additionalProperties: false, properties: { gemeenten: BEREIK, reden: REDEN } } } },
    async (req) => {
      vereis(req, "accounts.manage");
      const p = req.persoon!;
      const a = await laadDoel(d.pool, req.params.id);
      weigerAls(magBeheren(p, a));
      toetsBereik(req, req.body.gemeenten);
      await d.pool.query("UPDATE accounts SET gemeenten = $2 WHERE id = $1", [a.id, req.body.gemeenten]);
      await schrijfAudit(d.pool, { account: p.id, email: p.email, actie: "account.gemeenten", doel: a.id, ip: req.ip, resultaat: "ok", details: { oud: a.bereik ?? "alle", nieuw: req.body.gemeenten ?? "alle", reden: req.body.reden } });
      return {};
    },
  );

  /** Status wijzigen, nu of later. Blokkeren of deactiveren beëindigt alle sessies. */
  app.post<{ Params: { id: string }; Body: { status: "actief" | "geblokkeerd" | "gedeactiveerd"; reden: string; ingang?: string } }>(
    "/api/accounts/:id/status",
    { schema: { params: { type: "object", properties: { id: UUID } }, body: { type: "object", required: ["status", "reden"], additionalProperties: false, properties: { status: STATUS, reden: REDEN, ingang: { type: "string", format: "date-time" } } } } },
    async (req) => {
      vereis(req, "accounts.manage");
      const p = req.persoon!;
      const a = await laadDoel(d.pool, req.params.id);
      weigerAls(magBeheren(p, a));
      const nu = d.nu();
      const ingang = req.body.ingang ? new Date(req.body.ingang) : nu;
      if (Number.isNaN(ingang.getTime()) || ingang.getTime() > nu.getTime() + 366 * 24 * 3600_000) throw new AppFout(400, "verzoek-ongeldig", "Ongeldig moment.");
      await d.pool.query("INSERT INTO statuswijzigingen (account, status, reden, ingang, door) VALUES ($1, $2, $3, $4, $5)", [a.id, req.body.status, req.body.reden, ingang < nu ? nu : ingang, p.id]);
      await schrijfAudit(d.pool, { account: p.id, email: p.email, actie: "account.status.gepland", doel: a.id, ip: req.ip, resultaat: "ok", details: { status: req.body.status, reden: req.body.reden, ingang: (ingang < nu ? nu : ingang).toISOString() } });
      await voerStatuswijzigingenUit(d.pool, nu);
      return {};
    },
  );

  /**
   * De uitnodiging opnieuw sturen, voor een account dat nog nooit heeft
   * ingelogd. Moet de persoon zijn inlogaccount in Keycloak nog instellen
   * (wachtwoord, authenticator), dan stuurt Keycloak ook die mail opnieuw.
   * Hooguit één keer per vijf minuten per account.
   */
  app.post<{ Params: { id: string } }>(
    "/api/accounts/:id/uitnodiging",
    { schema: { params: { type: "object", properties: { id: UUID } } } },
    async (req) => {
      vereis(req, "accounts.manage");
      const p = req.persoon!;
      const a = await laadDoel(d.pool, req.params.id);
      weigerAls(magBeheren(p, a));
      const x = (await d.pool.query("SELECT keycloak_sub, taal FROM accounts WHERE id = $1", [a.id])).rows[0];
      if (x.keycloak_sub) throw new AppFout(409, "al-ingelogd", "Dit account heeft al ingelogd; een uitnodiging is niet meer nodig.");
      if (a.status !== "actief") throw new AppFout(409, "niet-actief", "Dit account is niet actief.");
      const recent = await d.pool.query("SELECT 1 FROM audit WHERE actie = 'account.uitnodiging' AND doel = $1 AND tijd > now() - interval '5 minutes' LIMIT 1", [a.id]);
      if (recent.rowCount) throw new AppFout(429, "te-snel", "De uitnodiging is net verstuurd. Probeer het over een paar minuten opnieuw.");

      let keycloak: "verstuurd" | "al-ingesteld" | "geen-inlogaccount" | "uitgeschakeld" | "mislukt" | "niet-verbonden" = "niet-verbonden";
      if (d.keycloak) {
        const k = await d.keycloak.inlogaccount(a.email).catch(() => undefined);
        if (k === undefined) keycloak = "mislukt";
        else if (!k) keycloak = "geen-inlogaccount";
        else if (!k.actief) keycloak = "uitgeschakeld";
        else if (!k.openStappen.length) keycloak = "al-ingesteld";
        else keycloak = await d.keycloak.stuurHerstelmail(k.id, k.openStappen).then(() => "verstuurd" as const, () => "mislukt" as const);
      }
      const portaal = await d.mailer.verstuur(uitnodiging(p.naam, a.email, x.taal, d.config.herkomst)).then(() => true, (e) => (req.log.error({ fout: (e as Error).message }, "uitnodiging niet verstuurd"), false));
      await schrijfAudit(d.pool, { account: p.id, email: p.email, actie: "account.uitnodiging", doel: a.id, ip: req.ip, resultaat: portaal ? "ok" : "mail-mislukt", details: { email: a.email, keycloak } });
      return { portaal, keycloak };
    },
  );

  /** Overal uitloggen, bijvoorbeeld bij een verloren laptop. */
  app.post<{ Params: { id: string }; Body: { reden: string } }>(
    "/api/accounts/:id/uitloggen",
    { schema: { params: { type: "object", properties: { id: UUID } }, body: { type: "object", required: ["reden"], additionalProperties: false, properties: { reden: REDEN } } } },
    async (req) => {
      vereis(req, "accounts.manage");
      const p = req.persoon!;
      const a = await laadDoel(d.pool, req.params.id);
      weigerAls(magBeheren(p, a));
      const n = await beeindigAlle(d.pool, a.id, "door-beheerder", d.nu());
      await schrijfAudit(d.pool, { account: p.id, email: p.email, actie: "account.uitgelogd", doel: a.id, ip: req.ip, resultaat: "ok", details: { sessies: n, reden: req.body.reden } });
      return { beeindigd: n };
    },
  );

  /** Alle geplande statuswijzigingen die nog niet zijn ingegaan. */
  app.get("/api/accounts/gepland", async (req) => {
    vereis(req, "accounts.view");
    const p = req.persoon!;
    const r = await d.pool.query(
      `SELECT w.id, w.status, w.reden, w.ingang, w.aangemaakt, b.naam AS door,
              a.id AS account, a.naam, a.email, a.hoofdaccount, a.gemeenten AS bereik,
              (SELECT coalesce(max(g.niveau), 0)::int FROM lidmaatschappen l JOIN groepen g ON g.id = l.groep WHERE l.account = a.id) AS niveau
         FROM statuswijzigingen w JOIN accounts a ON a.id = w.account JOIN accounts b ON b.id = w.door
        WHERE w.uitgevoerd IS NULL AND w.geannuleerd IS NULL
        ORDER BY w.ingang`,
    );
    return r.rows
      .filter((w) => zichtbaar(p, { id: w.account, bereik: w.bereik }))
      .map(({ hoofdaccount, niveau, bereik, ...w }) => ({ ...w, beheerbaar: p.rechten.has("accounts.manage") && magBeheren(p, { id: w.account, hoofdaccount, niveau, bereik }) === null }));
  });

  /** Een geplande statuswijziging annuleren; de rij blijft, met wie en waarom. */
  app.post<{ Params: { id: string }; Body: { reden: string } }>(
    "/api/accounts/gepland/:id/annuleren",
    { schema: { params: { type: "object", properties: { id: UUID } }, body: { type: "object", required: ["reden"], additionalProperties: false, properties: { reden: REDEN } } } },
    async (req) => {
      vereis(req, "accounts.manage");
      const p = req.persoon!;
      const w = (await d.pool.query("SELECT id, account, status, ingang FROM statuswijzigingen WHERE id = $1 AND uitgevoerd IS NULL AND geannuleerd IS NULL", [req.params.id])).rows[0];
      if (!w) throw new AppFout(404, "niet-gevonden", "Deze wijziging is al ingegaan of geannuleerd.");
      const a = await laadDoel(d.pool, w.account);
      weigerAls(magBeheren(p, a));
      const r = await d.pool.query(
        "UPDATE statuswijzigingen SET geannuleerd = $2, geannuleerd_door = $3, reden_annulering = $4 WHERE id = $1 AND uitgevoerd IS NULL AND geannuleerd IS NULL",
        [w.id, d.nu(), p.id, req.body.reden],
      );
      if (!r.rowCount) throw new AppFout(409, "al-ingegaan", "Deze wijziging is net ingegaan.");
      await schrijfAudit(d.pool, { account: p.id, email: p.email, actie: "account.status.geannuleerd", doel: a.id, ip: req.ip, resultaat: "ok", details: { status: w.status, ingang: new Date(w.ingang).toISOString(), reden: req.body.reden } });
      return {};
    },
  );

  /**
   * Alle actieve sessies, voor wie accounts mag zien en minstens niveau 3
   * heeft (zoals het getal op het overzicht). Zonder token.
   */
  app.get("/api/sessies", async (req) => {
    vereis(req, "accounts.view");
    const p = req.persoon!;
    if (p.niveau < 3) throw new AppFout(403, "niveau", "Dit overzicht is er vanaf niveau 3.");
    const r = await d.pool.query(
      `SELECT s.id, s.apparaat, s.ip, s.aangemaakt, s.laatst_actief, s.hard_einde, s.nood,
              a.id AS account, a.naam, a.email, a.hoofdaccount, a.gemeenten AS bereik,
              (SELECT coalesce(max(g.niveau), 0)::int FROM lidmaatschappen l JOIN groepen g ON g.id = l.groep WHERE l.account = a.id) AS niveau
         FROM sessies s JOIN accounts a ON a.id = s.account
        WHERE s.beeindigd IS NULL AND s.hard_einde > $1
        ORDER BY s.laatst_actief DESC`,
      [d.nu()],
    );
    return r.rows
      .filter((s) => zichtbaar(p, { id: s.account, bereik: s.bereik }))
      .map(({ hoofdaccount, niveau, bereik, ...s }) => ({
        ...s,
        eigen: s.account === p.id,
        beheerbaar: p.rechten.has("accounts.manage") && magBeheren(p, { id: s.account, hoofdaccount, niveau, bereik }) === null,
      }));
  });

  /** Eén sessie van iemand anders beëindigen (een verloren of gedeelde laptop). */
  app.post<{ Params: { id: string }; Body: { reden: string } }>(
    "/api/sessies/:id/beeindigen",
    { schema: { params: { type: "object", properties: { id: UUID } }, body: { type: "object", required: ["reden"], additionalProperties: false, properties: { reden: REDEN } } } },
    async (req) => {
      vereis(req, "accounts.manage");
      const p = req.persoon!;
      const s = (await d.pool.query("SELECT id, account, apparaat FROM sessies WHERE id = $1 AND beeindigd IS NULL", [req.params.id])).rows[0];
      if (!s) throw new AppFout(404, "niet-gevonden", "Deze sessie is al beëindigd.");
      const a = await laadDoel(d.pool, s.account);
      weigerAls(magBeheren(p, a));
      await d.pool.query("UPDATE sessies SET beeindigd = $2, reden_einde = 'door-beheerder' WHERE id = $1 AND beeindigd IS NULL", [s.id, d.nu()]);
      await schrijfAudit(d.pool, { account: p.id, email: p.email, actie: "sessie.beeindigd", doel: a.id, ip: req.ip, resultaat: "ok", details: { apparaat: s.apparaat, reden: req.body.reden } });
      return {};
    },
  );
}
