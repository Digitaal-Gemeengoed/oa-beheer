import { AppFout } from "./app.js";
import type { Config } from "./config.js";
import type { Persoon } from "./persoon.js";

/**
 * Het platform (opendop-mini), rechtstreeks over het interne netwerk, met de
 * dienstsleutel. De beheerder gaat mee als actor: het platform legt vast wie
 * een nieuw metadatamodel publiceerde.
 */
export class Platform {
  private readonly aangemeld = new Set<string>();

  constructor(
    private readonly c: NonNullable<Config["platform"]> & { gemeenten?: Config["gemeenten"] },
    private readonly doeFetch: typeof fetch = fetch,
  ) {}

  /**
   * Altijd voor de gemeente die de beheerder nu beheert (persoon.gemeente).
   * De eerste keer per gemeente meldt het portaal die aan bij het platform,
   * zodat een gemeente die nog niemand gebruikte daar klaarstaat.
   */
  async vraag<T>(methode: "GET" | "POST" | "PUT", pad: string, persoon: Persoon, lichaam?: unknown): Promise<T> {
    if (!persoon.gemeente) throw new AppFout(403, "geen-gemeente", "Je account beheert geen gemeente van deze inrichting.");
    if (!this.aangemeld.has(persoon.gemeente) && pad !== "/gemeente") {
      const naam = this.c.gemeenten?.find((g) => g.id === persoon.gemeente)?.naam;
      if (naam) {
        await this.stuur("PUT", "/gemeente", persoon, { naam }).catch(() => undefined);
        this.aangemeld.add(persoon.gemeente);
      }
    }
    return this.stuur<T>(methode, pad, persoon, lichaam);
  }

  private async stuur<T>(methode: "GET" | "POST" | "PUT", pad: string, persoon: Persoon, lichaam?: unknown): Promise<T> {
    const actor = Buffer.from(JSON.stringify({ sub: `oa-beheer:${persoon.id}`, naam: persoon.email, beheerder: true })).toString("base64url");
    let r: Response;
    try {
      r = await this.doeFetch(`${this.c.url}${pad}`, {
        method: methode,
        headers: {
          "x-oa-dienstsleutel": this.c.dienstsleutel,
          "x-oa-gemeente": persoon.gemeente,
          "x-oa-actor": actor,
          ...(lichaam !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: lichaam !== undefined ? JSON.stringify(lichaam) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AppFout(502, "platform-onbereikbaar", "Het platform is nu niet bereikbaar.");
    }
    const j = (await r.json().catch(() => ({}))) as T & { fout?: string; melding?: string; details?: unknown };
    if (!r.ok) {
      // Een route die het platform niet kent: het platform is ouder dan dit portaal.
      if (r.status === 404 && !j.fout) {
        throw new AppFout(502, "platform-te-oud", `Het platform kent deze functie nog niet (${methode} ${pad}). Werk het platform bij: bijwerken.sh op de server van het platform (VPS 2).`);
      }
      // Een weigering met uitleg (ongeldig, of in strijd met een planning) geven we door; de rest is een platformfout.
      throw new AppFout([400, 409, 422].includes(r.status) && j.fout ? r.status : 502, j.fout ?? "platform-fout", j.melding ?? `Het platform gaf fout ${r.status}.`, j.details);
    }
    return j;
  }
}
