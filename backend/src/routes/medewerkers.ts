import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppFout } from "../app.js";
import { schrijfAudit } from "../audit.js";
import { vereis } from "../toegang.js";

const REDEN = { type: "string", minLength: 5, maxLength: 1000 } as const;
const ID = { type: "string", pattern: "^[0-9a-f-]{36}$" } as const;

/**
 * Medewerkers van de gemeente die je beheert: hun inlogaccount in Keycloak,
 * hun rollen en hun niveau voor persoonsgegevens (PPL). Het niveau is een rol
 * in Keycloak (ppl-1, ppl-2, ppl-3; zonder rol PPL 0) en bepaalt welke
 * originele waarden achter de plaatshouders iemand mag zien.
 *
 * Bekijken: medewerkers.view. Toevoegen, niveau wijzigen, in- en uitschakelen
 * (ook op een datum) en een herstelmail laten sturen: medewerkers.manage, met
 * een reden, alleen voor medewerkers van de gemeente die je nu beheert, en
 * niet voor jezelf. Elke handeling staat in de audit. Wachtwoorden zet het
 * portaal nooit: Keycloak stuurt de medewerker een mail om dat zelf te doen.
 *
 * Bij een ander niveau of uitschakelen eindigen de sessies van de medewerker;
 * Keycloak meldt dat aan de Office Assistent (uitlogbericht), zodat het nieuwe
 * niveau bij de volgende keer inloggen geldt en niet pas na uren.
 */
export async function medewerkerRoutes(app: FastifyInstance): Promise<void> {
  const d = app.diensten;

  const gemeenteVan = (req: FastifyRequest) => {
    const g = req.persoon!.gemeente;
    if (!g) throw new AppFout(403, "geen-gemeente", "Je beheert geen gemeente.");
    return g;
  };
  const keycloak = () => {
    if (!d.keycloak) throw new AppFout(409, "keycloak-uit", "Het portaal is niet met Keycloak verbonden (beheer.sh keycloak op VPS 1).");
    return d.keycloak;
  };
  const isZelf = (req: FastifyRequest, m: { email: string | null; gebruikersnaam: string }) => {
    const ik = req.persoon!.email.toLowerCase();
    return m.email?.toLowerCase() === ik || m.gebruikersnaam.toLowerCase() === ik;
  };

  app.get<{ Querystring: { zoek?: string } }>(
    "/api/medewerkers",
    { schema: { querystring: { type: "object", additionalProperties: false, properties: { zoek: { type: "string", maxLength: 100 } } } } },
    async (req) => {
      vereis(req, "medewerkers.view");
      const gemeente = gemeenteVan(req);
      if (!d.keycloak) return { gemeente, keycloak: { aan: false }, medewerkers: [], meer: false };
      const { medewerkers, meer } = await d.keycloak.medewerkers(gemeente, req.query.zoek ?? "");
      const emails = medewerkers.map((m) => (m.email ?? m.gebruikersnaam).toLowerCase());
      const portaal = new Set((await d.pool.query("SELECT email FROM accounts WHERE email = ANY($1) AND status = 'actief'", [emails])).rows.map((x) => x.email));
      const gepland = (await d.pool.query(
        "SELECT id, medewerker, actief, ingang, reden, fout FROM medewerkerwijzigingen WHERE gemeente = $1 AND uitgevoerd IS NULL AND geannuleerd IS NULL ORDER BY ingang",
        [gemeente],
      )).rows;
      return {
        gemeente,
        keycloak: { aan: true },
        medewerkers: medewerkers.map((m) => ({
          ...m,
          zelf: isZelf(req, m),
          portaal: portaal.has((m.email ?? m.gebruikersnaam).toLowerCase()),
          gepland: gepland.filter((g) => g.medewerker === m.id).map(({ medewerker: _, ...g }) => g),
        })),
        meer,
        magWijzigen: req.persoon!.rechten.has("medewerkers.manage"),
      };
    },
  );

  app.put<{ Params: { id: string }; Body: { niveau: 0 | 1 | 2 | 3; reden: string } }>(
    "/api/medewerkers/:id/niveau",
    {
      schema: {
        params: { type: "object", properties: { id: ID } },
        body: { type: "object", required: ["niveau", "reden"], additionalProperties: false, properties: { niveau: { type: "integer", minimum: 0, maximum: 3 }, reden: REDEN } },
      },
    },
    async (req) => {
      vereis(req, "medewerkers.manage");
      const p = req.persoon!;
      const gemeente = gemeenteVan(req);
      const kc = keycloak();
      const m = await kc.medewerker(gemeente, req.params.id);
      if (!m) throw new AppFout(404, "niet-gevonden", "Deze medewerker hoort niet bij de gemeente die je nu beheert.");
      if (isZelf(req, m)) throw new AppFout(403, "eigen-niveau", "Je eigen niveau wijzig je niet zelf. Vraag een andere beheerder.");
      const van = m.niveau;
      const naar = req.body.niveau;
      // Daarna uitloggen: het nieuwe niveau geldt bij de volgende keer inloggen, niet pas na uren.
      if (van !== naar) await kc.zetNiveau(m.id, naar).then(() => kc.logUit(m.id));
      await schrijfAudit(d.pool, {
        account: p.id, email: p.email, actie: "medewerker.niveau", doel: m.id, ip: req.ip, resultaat: "ok",
        details: { gemeente, medewerker: m.email ?? m.gebruikersnaam, van, naar, reden: req.body.reden },
      });
      return { ...m, niveau: naar };
    },
  );

  /** Eén medewerker van de gemeente die je beheert, die je mag wijzigen (niet jezelf). */
  const doelVan = async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const m = await keycloak().medewerker(gemeenteVan(req), req.params.id);
    if (!m) throw new AppFout(404, "niet-gevonden", "Deze medewerker hoort niet bij de gemeente die je nu beheert.");
    if (isZelf(req, m)) throw new AppFout(403, "eigen-account", "Je eigen inlogaccount wijzig je niet hier. Vraag een andere beheerder.");
    return m;
  };
  const audit = (req: FastifyRequest, actie: string, doel: string, details: Record<string, unknown>) =>
    schrijfAudit(d.pool, { account: req.persoon!.id, email: req.persoon!.email, actie, doel, ip: req.ip, resultaat: "ok", details: { gemeente: req.persoon!.gemeente, ...details } });

  app.post<{ Body: { email: string; voornaam: string; achternaam: string; niveau: 0 | 1 | 2 | 3; reden: string } }>(
    "/api/medewerkers",
    {
      schema: {
        body: {
          type: "object", required: ["email", "voornaam", "achternaam", "niveau", "reden"], additionalProperties: false,
          properties: {
            email: { type: "string", minLength: 3, maxLength: 254, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
            voornaam: { type: "string", minLength: 1, maxLength: 100 },
            achternaam: { type: "string", minLength: 1, maxLength: 100 },
            niveau: { type: "integer", minimum: 0, maximum: 3 },
            reden: REDEN,
          },
        },
      },
    },
    async (req) => {
      vereis(req, "medewerkers.manage");
      const gemeente = gemeenteVan(req);
      const email = req.body.email.trim().toLowerCase();
      const { medewerker, mail } = await keycloak().maakMedewerker({ email, voornaam: req.body.voornaam.trim(), achternaam: req.body.achternaam.trim(), gemeente, niveau: req.body.niveau });
      await audit(req, "medewerker.aangemaakt", medewerker.id, { medewerker: email, niveau: req.body.niveau, reden: req.body.reden, mail });
      return { medewerker, mail };
    },
  );

  app.post<{ Params: { id: string }; Body: { actief: boolean; reden: string; ingang?: string } }>(
    "/api/medewerkers/:id/actief",
    {
      schema: {
        params: { type: "object", properties: { id: ID } },
        body: { type: "object", required: ["actief", "reden"], additionalProperties: false, properties: { actief: { type: "boolean" }, reden: REDEN, ingang: { type: "string", format: "date-time" } } },
      },
    },
    async (req) => {
      vereis(req, "medewerkers.manage");
      const m = await doelVan(req);
      const nu = d.nu();
      const ingang = req.body.ingang ? new Date(req.body.ingang) : nu;
      if (Number.isNaN(ingang.getTime()) || ingang.getTime() > nu.getTime() + 366 * 24 * 3600_000) throw new AppFout(400, "verzoek-ongeldig", "Ongeldig moment.");
      if (ingang <= nu) {
        await keycloak().zetActief(m.id, req.body.actief);
        await audit(req, req.body.actief ? "medewerker.ingeschakeld" : "medewerker.uitgeschakeld", m.id, { medewerker: m.email ?? m.gebruikersnaam, reden: req.body.reden });
        return { uitgevoerd: true };
      }
      await d.pool.query(
        "INSERT INTO medewerkerwijzigingen (gemeente, medewerker, email, actief, reden, ingang, door) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [gemeenteVan(req), m.id, m.email ?? m.gebruikersnaam, req.body.actief, req.body.reden, ingang, req.persoon!.id],
      );
      await audit(req, "medewerker.gepland", m.id, { medewerker: m.email ?? m.gebruikersnaam, actief: req.body.actief, ingang: ingang.toISOString(), reden: req.body.reden });
      return { uitgevoerd: false, ingang: ingang.toISOString() };
    },
  );

  app.post<{ Params: { id: string }; Body: { reden: string } }>(
    "/api/medewerkers/gepland/:id/annuleren",
    { schema: { params: { type: "object", properties: { id: ID } }, body: { type: "object", required: ["reden"], additionalProperties: false, properties: { reden: REDEN } } } },
    async (req) => {
      vereis(req, "medewerkers.manage");
      const r = await d.pool.query(
        `UPDATE medewerkerwijzigingen SET geannuleerd = $3, geannuleerd_door = $4, reden_annulering = $5
          WHERE id = $1 AND gemeente = $2 AND uitgevoerd IS NULL AND geannuleerd IS NULL RETURNING medewerker, email, actief, ingang`,
        [req.params.id, gemeenteVan(req), d.nu(), req.persoon!.id, req.body.reden],
      );
      if (!r.rowCount) throw new AppFout(404, "niet-gevonden", "Deze wijziging is al ingegaan of geannuleerd.");
      const w = r.rows[0];
      await audit(req, "medewerker.gepland.geannuleerd", w.medewerker, { medewerker: w.email, actief: w.actief, ingang: new Date(w.ingang).toISOString(), reden: req.body.reden });
      return {};
    },
  );

  app.post<{ Params: { id: string }; Body: { wachtwoord: boolean; authenticator: boolean; reden: string } }>(
    "/api/medewerkers/:id/herstelmail",
    {
      schema: {
        params: { type: "object", properties: { id: ID } },
        body: { type: "object", required: ["wachtwoord", "authenticator", "reden"], additionalProperties: false, properties: { wachtwoord: { type: "boolean" }, authenticator: { type: "boolean" }, reden: REDEN } },
      },
    },
    async (req) => {
      vereis(req, "medewerkers.manage");
      const wat = [...(req.body.wachtwoord ? (["wachtwoord"] as const) : []), ...(req.body.authenticator ? (["authenticator"] as const) : [])];
      if (!wat.length) throw new AppFout(400, "verzoek-ongeldig", "Kies wat de medewerker opnieuw instelt.");
      const m = await doelVan(req);
      if (!m.actief) throw new AppFout(409, "uitgeschakeld", "Deze medewerker is uitgeschakeld. Schakel hem eerst weer in.");
      if (!m.email) throw new AppFout(409, "geen-email", "Deze medewerker heeft in Keycloak geen e-mailadres.");
      await keycloak().stuurHerstelmail(m.id, wat);
      await audit(req, "medewerker.herstelmail", m.id, { medewerker: m.email, wat, reden: req.body.reden });
      return {};
    },
  );

}
