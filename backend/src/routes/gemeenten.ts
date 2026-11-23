import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppFout } from "../app.js";
import { schrijfAudit } from "../audit.js";
import { normaliseer, toetsDomein } from "../domeinen.js";
import { laadGemeenten, type Gemeente } from "../gemeenten.js";
import type { Organisatie } from "../keycloakbeheer.js";
import { vereis } from "../toegang.js";

const GEMEENTE = { type: "string", pattern: "^[a-z0-9-]{2,40}$" } as const;
const REDEN = { type: "string", minLength: 5, maxLength: 1000 } as const;
const NAAM = { type: "string", minLength: 3, maxLength: 100 } as const;
const DOMEINEN = { type: "array", minItems: 1, maxItems: 10, items: { type: "string", minLength: 3, maxLength: 253 } } as const;

/**
 * Meer gemeenten in één inrichting (GR). Elke beheerder beheert één gemeente
 * tegelijk; wie er meer mag, kiest. De keuze geldt voor de sessie en gaat mee
 * naar het platform (metadatamodel, classificatie, anonimiseren) en de audit.
 *
 * Gemeenten toevoegen en wijzigen (pagina Gemeenten): alleen wie GR-breed
 * beheert en het recht gemeenten.manage heeft. Een gemeente krijgt een naam
 * en e-maildomeinen; die bepalen in Keycloak wie bij de gemeente hoort.
 */
export async function gemeenteRoutes(app: FastifyInstance): Promise<void> {
  const d = app.diensten;
  const naamVan = (req: FastifyRequest, id: string) => req.gemeenten?.find((g) => g.id === id)?.naam ?? id;

  app.get("/api/gemeenten", async (req) => {
    const p = req.persoon!;
    return {
      actief: p.gemeente ? { id: p.gemeente, naam: naamVan(req, p.gemeente) } : null,
      keuze: p.gemeenten.map((id) => ({ id, naam: naamVan(req, id) })),
      /** Alle gemeenten van de inrichting, voor het toekennen aan een account. */
      inrichting: (req.gemeenten ?? []).map(({ id, naam }) => ({ id, naam })),
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
      return { actief: { id: req.body.id, naam: naamVan(req, req.body.id) } };
    },
  );

  /** Alleen GR-breed, met het recht gemeenten.manage. */
  const magBeheren = (req: FastifyRequest) => {
    vereis(req, "gemeenten.manage");
    if (req.persoon!.bereik !== null) throw new AppFout(403, "niet-gr-breed", "Gemeenten beheren kan alleen wie alle gemeenten van de inrichting beheert.");
  };

  /** Domeinen opschonen en toetsen: geldig, geen algemeen e-maildomein, niet al bij een andere gemeente. */
  const toetsDomeinen = (ruw: string[], id: string, gemeenten: Gemeente[], organisaties: Organisatie[]) => {
    const domeinen = [...new Set(ruw.map(normaliseer).filter(Boolean))];
    if (!domeinen.length) throw new AppFout(400, "domein-ontbreekt", "Geef ten minste één e-maildomein, zoals haarlem.nl.");
    for (const dm of domeinen) {
      const fout = toetsDomein(dm);
      if (fout) throw new AppFout(400, "domein-ongeldig", fout);
      const ander = gemeenten.find((g) => g.id !== id && g.domeinen.includes(dm))?.naam
        ?? organisaties.find((o) => o.alias !== id && o.domains?.some((x) => x.name === dm))?.name;
      if (ander) throw new AppFout(409, "domein-bezet", `"${dm}" hoort al bij ${ander}.`);
    }
    return domeinen;
  };

  /**
   * Het overzicht, met per gemeente de stand in Keycloak en hoeveel gebruikers
   * een adres op elk domein hebben. Gemeenten die alleen in Keycloak bestaan
   * (bijvoorbeeld uit GEMEENTEN op VPS 3), neemt het portaal over.
   */
  app.get("/api/gemeenten/beheer", async (req) => {
    magBeheren(req);
    let organisaties: Organisatie[] | null = null;
    let keycloakFout: string | null = null;
    if (d.keycloak) {
      try {
        organisaties = await d.keycloak.organisaties();
      } catch (e) {
        keycloakFout = (e as Error).message;
      }
    }
    for (const o of organisaties ?? []) {
      if (!/^[a-z0-9-]{2,40}$/.test(o.alias) || (req.gemeenten ?? []).some((g) => g.id === o.alias)) continue;
      const naam = (o.attributes?.naam?.[0] ?? o.name).slice(0, 100);
      await d.pool.query("INSERT INTO gemeenten (id, naam, domeinen) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [o.alias, naam.length >= 3 ? naam : o.alias, (o.domains ?? []).map((x) => x.name).slice(0, 10)]);
    }
    const gemeenten = await laadGemeenten(d.pool);
    const r = await d.pool.query("SELECT g.id, g.aangemaakt, g.gewijzigd, a.email AS door FROM gemeenten g LEFT JOIN accounts a ON a.id = g.aangemaakt_door");
    const extra = new Map(r.rows.map((x) => [x.id, x]));
    const lijst = await Promise.all(
      gemeenten.map(async (g) => {
        const o = organisaties?.find((x) => x.alias === g.id);
        const inKeycloak = organisaties === null ? null : !o ? "ontbreekt" : sameSet(g.domeinen, (o.domains ?? []).map((x) => x.name)) ? "ok" : "afwijkend";
        const gebruikers: Record<string, number | null> = {};
        for (const dm of g.domeinen) gebruikers[dm] = d.keycloak && organisaties ? await d.keycloak.gebruikersMetDomein(dm).catch(() => null) : null;
        return { ...g, keycloak: inKeycloak, gebruikers, aangemaakt: extra.get(g.id)?.aangemaakt, gewijzigd: extra.get(g.id)?.gewijzigd, door: extra.get(g.id)?.door ?? null };
      }),
    );
    return { gemeenten: lijst, keycloak: d.keycloak ? (keycloakFout ? { aan: true, fout: keycloakFout } : { aan: true }) : { aan: false } };
  });

  /** Een gemeente toevoegen: in Keycloak (met domeinen), bij het platform, dan in het portaal. */
  app.post<{ Body: { id: string; naam: string; domeinen: string[]; reden: string } }>(
    "/api/gemeenten",
    { schema: { body: { type: "object", required: ["id", "naam", "domeinen", "reden"], additionalProperties: false, properties: { id: GEMEENTE, naam: NAAM, domeinen: DOMEINEN, reden: REDEN } } } },
    async (req, antwoord) => {
      magBeheren(req);
      const p = req.persoon!;
      const gemeenten = await laadGemeenten(d.pool);
      if (gemeenten.some((g) => g.id === req.body.id)) throw new AppFout(409, "gemeente-bestaat", "Er is al een gemeente met deze code.");
      const organisaties = d.keycloak ? await d.keycloak.organisaties() : [];
      if (organisaties.some((o) => o.alias === req.body.id)) throw new AppFout(409, "gemeente-bestaat", "Keycloak kent al een gemeente met deze code. Ververs de pagina: het portaal neemt haar over.");
      const naam = req.body.naam.trim();
      const domeinen = toetsDomeinen(req.body.domeinen, req.body.id, gemeenten, organisaties);
      if (d.keycloak) await d.keycloak.maak(req.body.id, naam, domeinen);
      // Bij het platform aanmelden: register, opslag en zoekindex staan dan klaar.
      if (d.platform) await d.platform.meldAan(req.body.id, naam, p).catch((e) => req.log.warn({ fout: (e as Error).message }, "gemeente niet aangemeld bij het platform"));
      await d.pool.query("INSERT INTO gemeenten (id, naam, domeinen, aangemaakt_door) VALUES ($1, $2, $3, $4)", [req.body.id, naam, domeinen, p.id]);
      await schrijfAudit(d.pool, { account: p.id, email: p.email, actie: "gemeente.aangemaakt", doel: req.body.id, ip: req.ip, resultaat: "ok", details: { naam, domeinen, keycloak: !!d.keycloak, reden: req.body.reden } });
      return antwoord.code(201).send({ id: req.body.id, naam, domeinen });
    },
  );

  /** Naam en domeinen wijzigen. Wie al gekoppeld is, blijft dat; nieuwe domeinen koppelt VPS 3 binnen een kwartier. */
  app.put<{ Params: { id: string }; Body: { naam: string; domeinen: string[]; reden: string } }>(
    "/api/gemeenten/:id",
    { schema: { params: { type: "object", properties: { id: GEMEENTE } }, body: { type: "object", required: ["naam", "domeinen", "reden"], additionalProperties: false, properties: { naam: NAAM, domeinen: DOMEINEN, reden: REDEN } } } },
    async (req) => {
      magBeheren(req);
      const p = req.persoon!;
      const gemeenten = await laadGemeenten(d.pool);
      const oud = gemeenten.find((g) => g.id === req.params.id);
      if (!oud) throw new AppFout(404, "niet-gevonden", "Deze gemeente bestaat niet.");
      const organisaties = d.keycloak ? await d.keycloak.organisaties() : [];
      const naam = req.body.naam.trim();
      const domeinen = toetsDomeinen(req.body.domeinen, req.params.id, gemeenten, organisaties);
      if (d.keycloak) {
        const o = organisaties.find((x) => x.alias === req.params.id);
        if (o) await d.keycloak.wijzig(o, naam, domeinen);
        else await d.keycloak.maak(req.params.id, naam, domeinen);
      }
      if (d.platform && naam !== oud.naam) await d.platform.meldAan(req.params.id, naam, p).catch((e) => req.log.warn({ fout: (e as Error).message }, "naam niet bijgewerkt bij het platform"));
      await d.pool.query("UPDATE gemeenten SET naam = $2, domeinen = $3, gewijzigd = now() WHERE id = $1", [req.params.id, naam, domeinen]);
      await schrijfAudit(d.pool, { account: p.id, email: p.email, actie: "gemeente.gewijzigd", doel: req.params.id, ip: req.ip, resultaat: "ok", details: { oud: { naam: oud.naam, domeinen: oud.domeinen }, nieuw: { naam, domeinen }, reden: req.body.reden } });
      return { id: req.params.id, naam, domeinen };
    },
  );
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}
