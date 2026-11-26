import type { Diensten } from "./app.js";
import { schrijfAudit } from "./audit.js";

/**
 * Geplande in- en uitschakelingen van medewerkers uitvoeren (elke 30
 * seconden, en direct na het plannen). Lukt Keycloak niet, dan blijft de
 * wijziging open met de fout erbij en volgt een nieuwe poging.
 */
export async function voerMedewerkerwijzigingenUit(d: Pick<Diensten, "pool" | "keycloak">, nu: Date): Promise<number> {
  if (!d.keycloak) return 0;
  const r = await d.pool.query(
    `SELECT id, gemeente, medewerker, email, actief, reden, door
       FROM medewerkerwijzigingen
      WHERE uitgevoerd IS NULL AND geannuleerd IS NULL AND ingang <= $1
      ORDER BY ingang, aangemaakt`,
    [nu],
  );
  let n = 0;
  for (const w of r.rows) {
    try {
      await d.keycloak.zetActief(w.medewerker, w.actief);
      const u = await d.pool.query("UPDATE medewerkerwijzigingen SET uitgevoerd = $2, fout = NULL WHERE id = $1 AND uitgevoerd IS NULL AND geannuleerd IS NULL", [w.id, nu]);
      if (!u.rowCount) continue;
      await schrijfAudit(d.pool, {
        account: w.door, actie: w.actief ? "medewerker.ingeschakeld" : "medewerker.uitgeschakeld", doel: w.medewerker, resultaat: "ok",
        details: { gemeente: w.gemeente, medewerker: w.email, reden: w.reden, gepland: true },
      });
      n++;
    } catch (e) {
      await d.pool.query("UPDATE medewerkerwijzigingen SET fout = $2 WHERE id = $1", [w.id, (e as Error).message.slice(0, 500)]);
    }
  }
  return n;
}
