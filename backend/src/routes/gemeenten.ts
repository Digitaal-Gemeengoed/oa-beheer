import type { FastifyInstance } from "fastify";
import { AppFout } from "../app.js";
import { schrijfAudit } from "../audit.js";

const GEMEENTE = { type: "string", pattern: "^[a-z0-9-]{2,40}$" } as const;

/**
 * Meer gemeenten in één inrichting (GR). Elke beheerder beheert één gemeente
 * tegelijk; wie er meer mag, kiest. De keuze geldt voor de sessie en gaat mee
 * naar het platform (metadatamodel, classificatie, anonimiseren) en de audit.
 */
export async function gemeenteRoutes(app: FastifyInstance): Promise<void> {
  const d = app.diensten;
  const naam = (id: string) => d.config.gemeenten.find((g) => g.id === id)?.naam ?? id;

  app.get("/api/gemeenten", async (req) => {
    const p = req.persoon!;
    return {
      actief: p.gemeente ? { id: p.gemeente, naam: naam(p.gemeente) } : null,
      keuze: p.gemeenten.map((id) => ({ id, naam: naam(id) })),
      /** Alle gemeenten van de inrichting, voor het toekennen aan een account. */
      inrichting: d.config.gemeenten,
      grBreed: p.bereik === null,
    };
  });

  app.put<{ Body: { id: string } }>(
    "/api/gemeente",
    { schema: { body: { type: "object", required: ["id"], additionalProperties: false, properties: { id: GEMEENTE } } } },
    async (req) => {
      const p = req.persoon!;
      if (!p.gemeenten.includes(req.body.id)) throw new AppFout(403, "andere-gemeente", "Deze gemeente beheer je niet.");
      await d.pool.query("UPDATE sessies SET gemeente = $2 WHERE id = $1", [p.sessie, req.body.id]);
      await schrijfAudit(d.pool, { account: p.id, email: p.email, actie: "gemeente.gekozen", doel: req.body.id, ip: req.ip, resultaat: "ok", details: { van: p.gemeente || null, naar: req.body.id } });
      return { actief: { id: req.body.id, naam: naam(req.body.id) } };
    },
  );
}
