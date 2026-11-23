import { AppFout } from "./app.js";

/**
 * De organisaties (gemeenten) in Keycloak, via het service-account van de
 * client oa-beheer. Dat account heeft alleen manage-organizations en
 * view-users (oa-uitrol: keycloak_gemeenten op VPS 3): het maakt en wijzigt
 * gemeenten en telt gebruikers, maar wijzigt geen gebruikers. Gebruikers aan
 * hun gemeente koppelen doet VPS 3 (elk kwartier).
 */
export interface Organisatie {
  id: string;
  alias: string;
  name: string;
  enabled?: boolean;
  domains?: { name: string; verified?: boolean }[];
  attributes?: Record<string, string[]>;
}

export class KeycloakBeheer {
  private token: { waarde: string; tot: number } | null = null;
  private readonly beheer: string;
  private readonly realm: string;

  /**
   * `issuer` is het openbare adres van de realm (https://id.<domein>/realms/gemeenten);
   * `intern` het adres van Keycloak over het private netwerk (http://10.66.0.3:8080). Het
   * beheerscherm (/admin) staat niet open naar buiten; het portaal gaat daarom intern.
   * Zonder `intern`: het openbare adres (lokaal en in tests).
   */
  constructor(
    issuer: string,
    private readonly clientId: string,
    private readonly geheim: string,
    private readonly doeFetch: typeof fetch = fetch,
    intern?: string,
  ) {
    const m = /^(.*)\/realms\/([^/]+)\/?$/.exec(issuer);
    const basis = (intern || m?.[1] || issuer).replace(/\/$/, "");
    const realm = m?.[2] ?? "gemeenten";
    this.realm = `${basis}/realms/${realm}`;
    this.beheer = `${basis}/admin/realms/${realm}`;
  }

  private async haalToken(): Promise<string> {
    if (this.token && this.token.tot > Date.now()) return this.token.waarde;
    const r = await this.doeFetch(`${this.realm}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.clientId, client_secret: this.geheim }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!r?.ok) throw new AppFout(502, "keycloak-onbereikbaar", "Keycloak geeft het portaal geen toegang. Draai bijwerken.sh op VPS 3 (dat zet het service-account van het portaal aan).");
    const j = (await r.json()) as { access_token: string; expires_in?: number };
    this.token = { waarde: j.access_token, tot: Date.now() + Math.max(10, (j.expires_in ?? 60) - 30) * 1000 };
    return j.access_token;
  }

  private async vraag<T>(methode: string, pad: string, lichaam?: unknown): Promise<T> {
    const r = await this.doeFetch(`${this.beheer}${pad}`, {
      method: methode,
      headers: { authorization: `Bearer ${await this.haalToken()}`, ...(lichaam !== undefined ? { "content-type": "application/json" } : {}) },
      body: lichaam !== undefined ? JSON.stringify(lichaam) : undefined,
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!r) throw new AppFout(502, "keycloak-onbereikbaar", "Keycloak is nu niet bereikbaar.");
    if (r.status === 401 || r.status === 403) {
      this.token = null;
      throw new AppFout(502, "keycloak-geen-recht", "Het portaal mag in Keycloak geen gemeenten beheren. Draai bijwerken.sh op VPS 3.");
    }
    if (r.status === 409) throw new AppFout(409, "keycloak-bestaat", "Keycloak kent deze gemeente of een van de domeinen al bij een andere gemeente.");
    if (r.status === 400) {
      const j = (await r.json().catch(() => ({}))) as { errorMessage?: string; error?: string };
      throw new AppFout(409, "keycloak-weigert", `Keycloak weigert dit: ${j.errorMessage ?? j.error ?? "ongeldige gegevens"}. Staat een domein al bij een andere gemeente?`);
    }
    if (!r.ok) throw new AppFout(502, "keycloak-fout", `Keycloak gaf fout ${r.status}.`);
    const tekst = await r.text();
    return (tekst ? JSON.parse(tekst) : undefined) as T;
  }

  organisaties(): Promise<Organisatie[]> {
    return this.vraag<Organisatie[]>("GET", "/organizations?max=1000&briefRepresentation=false");
  }

  async maak(id: string, naam: string, domeinen: string[]): Promise<void> {
    await this.vraag("POST", "/organizations", { name: naam, alias: id, enabled: true, attributes: { naam: [naam] }, domains: domeinen.map((name) => ({ name, verified: true })) });
  }

  /** Naam en domeinen wijzigen; de rest van de organisatie (zoals gekoppelde identiteitsvoorzieningen) blijft. */
  async wijzig(o: Organisatie, naam: string, domeinen: string[]): Promise<void> {
    await this.vraag("PUT", `/organizations/${encodeURIComponent(o.id)}`, {
      ...o,
      name: naam,
      attributes: { ...(o.attributes ?? {}), naam: [naam] },
      domains: domeinen.map((name) => ({ ...(o.domains?.find((d) => d.name === name) ?? {}), name, verified: true })),
    });
  }

  /** Hoeveel gebruikers een e-mailadres op dit domein hebben (worden elk kwartier gekoppeld). */
  async gebruikersMetDomein(domein: string): Promise<number> {
    return this.vraag<number>("GET", `/users/count?email=${encodeURIComponent(`@${domein}`)}`);
  }
}
