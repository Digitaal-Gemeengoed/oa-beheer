import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppFout } from "../app.js";
import { schrijfAudit } from "../audit.js";
import { vereis } from "../toegang.js";

const REDEN = { type: "string", minLength: 5, maxLength: 1000 } as const;
const ID = { type: "string", pattern: "^[0-9a-f-]{36}$" } as const;

/**
 * Medewerkers van de gemeente die je beheert, met hun niveau voor
 * persoonsgegevens (PPL). Het niveau is een rol in Keycloak (ppl-1, ppl-2,
 * ppl-3; zonder rol PPL 0) en bepaalt welke originele waarden achter de
 * plaatshouders iemand mag zien.
 *
 * Bekijken: medewerkers.view. Wijzigen: medewerkers.manage, met een reden,
 * alleen voor medewerkers van de gemeente die je nu beheert, en niet voor
 * jezelf. Elke wijziging staat in de audit. Het nieuwe niveau geldt vanaf de
 * volgende keer dat de medewerker inlogt.
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
      return {
        gemeente,
        keycloak: { aan: true },
        medewerkers: medewerkers.map((m) => ({ ...m, zelf: isZelf(req, m) })),
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
      if (van !== naar) await kc.zetNiveau(m.id, naar);
      await schrijfAudit(d.pool, {
        account: p.id, email: p.email, actie: "medewerker.niveau", doel: m.id, ip: req.ip, resultaat: "ok",
        details: { gemeente, medewerker: m.email ?? m.gebruikersnaam, van, naar, reden: req.body.reden },
      });
      return { ...m, niveau: naar };
    },
  );
}
