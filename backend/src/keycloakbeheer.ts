import { AppFout } from "./app.js";

/**
 * De organisaties (gemeenten) en de medewerkers in Keycloak, via het
 * service-account van de client oa-beheer. Dat account heeft
 * manage-organizations en view-users, plus fijnmazige beheerrechten
 * (oa-uitrol: keycloak_gemeenten op VPS 3): gebruikers beheren, en daarbij
 * alleen de rollen medewerker, ppl-1, ppl-2 en ppl-3 toekennen. Beheerrollen
 * en de instellingen van de realm blijven buiten bereik. Wachtwoorden zet het
 * portaal nooit: de medewerker krijgt van Keycloak een mail om dat zelf te doen.
 */
export interface Organisatie {
  id: string;
  alias: string;
  name: string;
  enabled?: boolean;
  domains?: { name: string; verified?: boolean }[];
  attributes?: Record<string, string[]>;
}

/** Een medewerker zoals het portaal hem toont: wie, en welk niveau voor persoonsgegevens. */
export interface Medewerker {
  id: string;
  gebruikersnaam: string;
  email: string | null;
  naam: string;
  actief: boolean;
  /** Rollen die er voor het portaal toe doen: medewerker, beheerder, vrijgever, leverancier. */
  rollen: string[];
  /** 0 tot 3: het hoogste ppl-niveau; 0 zonder ppl-rol. */
  niveau: number;
  /** Moet nog iets instellen (wachtwoord, authenticator): de mail is (nog) niet gebruikt. */
  wachtOpInstellen: boolean;
  aangemaakt: string | null;
}

/** Wat de medewerker via de mail van Keycloak opnieuw instelt. */
export type Herstel = "wachtwoord" | "authenticator";
const ACTIE: Record<Herstel, string> = { wachtwoord: "UPDATE_PASSWORD", authenticator: "CONFIGURE_TOTP" };
/** Zo lang is de link in de mail geldig: drie dagen. */
export const LINK_UREN = 72;

interface Gebruiker {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  attributes?: Record<string, string[]>;
  requiredActions?: string[];
  createdTimestamp?: number;
}
interface Rol {
  id: string;
  name: string;
}

const PPL = /^ppl-([123])$/;
export const niveauVan = (rollen: string[]) => Math.max(0, ...rollen.map((r) => Number(PPL.exec(r)?.[1] ?? 0)));

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

  private async vraag<T>(methode: string, pad: string, lichaam?: unknown, bijNiet?: T): Promise<T> {
    const r = await this.doeFetch(`${this.beheer}${pad}`, {
      method: methode,
      headers: { authorization: `Bearer ${await this.haalToken()}`, ...(lichaam !== undefined ? { "content-type": "application/json" } : {}) },
      body: lichaam !== undefined ? JSON.stringify(lichaam) : undefined,
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!r) throw new AppFout(502, "keycloak-onbereikbaar", "Keycloak is nu niet bereikbaar.");
    if (r.status === 401 || r.status === 403) {
      this.token = null;
      throw new AppFout(502, "keycloak-geen-recht", "Het portaal heeft daarvoor geen recht in Keycloak. Draai bijwerken.sh op VPS 3 (dat geeft het service-account van het portaal zijn rechten).");
    }
    if (r.status === 404 && bijNiet !== undefined) return bijNiet;
    const org = pad.startsWith("/organizations");
    if (r.status === 409) throw new AppFout(409, "keycloak-bestaat", org ? "Keycloak kent deze gemeente of een van de domeinen al bij een andere gemeente." : "Keycloak kent dit al (bijvoorbeeld een gebruiker met dit e-mailadres).");
    if (r.status === 400) {
      const j = (await r.json().catch(() => ({}))) as { errorMessage?: string; error?: string };
      throw new AppFout(409, "keycloak-weigert", `Keycloak weigert dit: ${j.errorMessage ?? j.error ?? "ongeldige gegevens"}.${org ? " Staat een domein al bij een andere gemeente?" : ""}`);
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

  /**
   * De medewerkers van een gemeente: de leden van haar organisatie, en wie het
   * attribuut gemeente met haar code heeft. Met hun rollen en PPL-niveau.
   */
  async medewerkers(gemeente: string, zoek = "", max = 200): Promise<{ medewerkers: Medewerker[]; meer: boolean }> {
    const z = zoek.trim();
    const o = (await this.organisaties()).find((x) => x.alias === gemeente);
    const leden = o ? await this.vraag<Gebruiker[]>("GET", `/organizations/${encodeURIComponent(o.id)}/members?first=0&max=${max + 1}${z ? `&search=${encodeURIComponent(z)}` : ""}`) : [];
    const metAttribuut = await this.vraag<Gebruiker[]>("GET", `/users?first=0&max=${max + 1}&briefRepresentation=false&q=${encodeURIComponent(`gemeente:${gemeente}`)}${z ? `&search=${encodeURIComponent(z)}` : ""}`);
    const alle = new Map<string, Gebruiker>();
    // Keycloak negeert de zoekterm naast een attribuutvraag (q); daarom ook hier filteren.
    const past = (g: Gebruiker) => !z || [g.username, g.email, g.firstName, g.lastName].some((v) => v?.toLowerCase().includes(z.toLowerCase()));
    for (const g of [...leden, ...metAttribuut]) if (!g.username.startsWith("service-account-") && past(g)) alle.set(g.id, g);
    const lijst = [...alle.values()].sort((a, b) => (a.email ?? a.username).localeCompare(b.email ?? b.username)).slice(0, max);
    const medewerkers = await Promise.all(lijst.map(async (g) => this.naarMedewerker(g, await this.rollenVan(g.id))));
    return { medewerkers, meer: alle.size > max || leden.length > max || metAttribuut.length > max };
  }

  /** Eén gebruiker, als hij bij deze gemeente hoort (lid van de organisatie of attribuut gemeente); anders null. */
  async medewerker(gemeente: string, id: string): Promise<Medewerker | null> {
    const g = await this.vraag<Gebruiker | null>("GET", `/users/${encodeURIComponent(id)}`, undefined, null);
    if (!g || g.username.startsWith("service-account-")) return null;
    let hoort = (g.attributes?.gemeente ?? []).includes(gemeente);
    if (!hoort) {
      const o = (await this.organisaties()).find((x) => x.alias === gemeente);
      hoort = !!o && (await this.vraag<Gebruiker | null>("GET", `/organizations/${encodeURIComponent(o.id)}/members/${encodeURIComponent(id)}`, undefined, null)) !== null;
    }
    return hoort ? this.naarMedewerker(g, await this.rollenVan(g.id)) : null;
  }

  /**
   * Het PPL-niveau zetten: de andere ppl-rollen weg, de gevraagde erbij (0: geen).
   * Welke rol erbij kan, komt uit de lijst van rollen die het portaal mag toekennen.
   */
  async zetNiveau(id: string, niveau: 0 | 1 | 2 | 3): Promise<void> {
    const pad = `/users/${encodeURIComponent(id)}/role-mappings/realm`;
    const huidig = await this.vraag<Rol[]>("GET", pad);
    const weg = huidig.filter((r) => PPL.test(r.name) && r.name !== `ppl-${niveau}`).map(({ id, name }) => ({ id, name }));
    if (weg.length) await this.vraag("DELETE", pad, weg);
    if (niveau > 0 && !huidig.some((r) => r.name === `ppl-${niveau}`)) {
      const rol = (await this.vraag<Rol[]>("GET", `${pad}/available`)).find((r) => r.name === `ppl-${niveau}`);
      if (!rol) throw new AppFout(502, "keycloak-geen-rol", `Keycloak kent de rol ppl-${niveau} niet, of het portaal mag hem niet toekennen. Draai bijwerken.sh op VPS 3.`);
      await this.vraag("POST", pad, [{ id: rol.id, name: rol.name }]);
    }
  }

  private rollenVan(id: string): Promise<Rol[]> {
    return this.vraag<Rol[]>("GET", `/users/${encodeURIComponent(id)}/role-mappings/realm`);
  }

  private naarMedewerker(g: Gebruiker, rollen: Rol[]): Medewerker {
    const namen = rollen.map((r) => r.name);
    return {
      id: g.id,
      gebruikersnaam: g.username,
      email: g.email ?? null,
      naam: [g.firstName, g.lastName].filter(Boolean).join(" ") || g.username,
      actief: g.enabled !== false,
      rollen: namen.filter((r) => ["medewerker", "beheerder", "vrijgever", "leverancier"].includes(r)),
      niveau: niveauVan(namen),
      wachtOpInstellen: (g.requiredActions ?? []).length > 0,
      aangemaakt: g.createdTimestamp ? new Date(g.createdTimestamp).toISOString() : null,
    };
  }

  /**
   * Het inlogaccount bij een e-mailadres (exact), met wat de gebruiker nog
   * moet instellen; null als er geen is.
   */
  async inlogaccount(email: string): Promise<{ id: string; actief: boolean; openStappen: Herstel[] } | null> {
    const e = encodeURIComponent(email);
    const g = (await this.vraag<Gebruiker[]>("GET", `/users?email=${e}&exact=true&briefRepresentation=false`))[0]
      ?? (await this.vraag<Gebruiker[]>("GET", `/users?username=${e}&exact=true&briefRepresentation=false`))[0];
    if (!g) return null;
    const open = (Object.keys(ACTIE) as Herstel[]).filter((w) => (g.requiredActions ?? []).includes(ACTIE[w]));
    return { id: g.id, actief: g.enabled !== false, openStappen: open };
  }

  /** Bestaat er al iemand met dit e-mailadres of deze gebruikersnaam (in welke gemeente ook)? */
  async bestaat(email: string): Promise<boolean> {
    const e = encodeURIComponent(email);
    const [a, b] = await Promise.all([
      this.vraag<Gebruiker[]>("GET", `/users?email=${e}&exact=true&briefRepresentation=true`),
      this.vraag<Gebruiker[]>("GET", `/users?username=${e}&exact=true&briefRepresentation=true`),
    ]);
    return a.length + b.length > 0;
  }

  /**
   * Een medewerker aanmaken: gebruikersnaam is het e-mailadres, met het
   * attribuut gemeente, de rollen medewerker en het gevraagde ppl-niveau, en
   * lid van de organisatie als het e-maildomein daarbij hoort. Daarna stuurt
   * Keycloak de mail om een wachtwoord en de authenticator in te stellen.
   * Geeft de medewerker en of de mail is verstuurd.
   */
  async maakMedewerker(m: { email: string; voornaam: string; achternaam: string; gemeente: string; niveau: 0 | 1 | 2 | 3 }): Promise<{ medewerker: Medewerker; mail: boolean }> {
    if (await this.bestaat(m.email)) throw new AppFout(409, "bestaat-al", "Er is in Keycloak al een gebruiker met dit e-mailadres.");
    await this.vraag("POST", "/users", {
      username: m.email, email: m.email, emailVerified: true, enabled: true,
      firstName: m.voornaam, lastName: m.achternaam,
      attributes: { gemeente: [m.gemeente] },
      requiredActions: [ACTIE.wachtwoord, ACTIE.authenticator],
    });
    const g = (await this.vraag<Gebruiker[]>("GET", `/users?username=${encodeURIComponent(m.email)}&exact=true&briefRepresentation=false`))[0];
    if (!g) throw new AppFout(502, "keycloak-fout", "De medewerker is aangemaakt, maar Keycloak geeft hem niet terug.");
    const pad = `/users/${encodeURIComponent(g.id)}/role-mappings/realm`;
    const kan = await this.vraag<Rol[]>("GET", `${pad}/available`);
    const rollen = kan.filter((r) => r.name === "medewerker" || (m.niveau > 0 && r.name === `ppl-${m.niveau}`)).map(({ id, name }) => ({ id, name }));
    if (rollen.length) await this.vraag("POST", pad, rollen);
    const domein = m.email.split("@")[1]?.toLowerCase();
    const o = (await this.organisaties()).find((x) => x.alias === m.gemeente);
    if (o && domein && (o.domains ?? []).some((d) => d.name.toLowerCase() === domein)) {
      await this.vraag("POST", `/organizations/${encodeURIComponent(o.id)}/members`, g.id).catch(() => undefined);
    }
    const mail = await this.stuurHerstelmail(g.id, ["wachtwoord", "authenticator"]).then(() => true, () => false);
    return { medewerker: this.naarMedewerker(g, await this.rollenVan(g.id)), mail };
  }

  /** In- of uitschakelen. Uitschakelen beëindigt ook alle sessies (en via het uitlogbericht die in de Office Assistent). */
  async zetActief(id: string, actief: boolean): Promise<void> {
    await this.vraag("PUT", `/users/${encodeURIComponent(id)}`, { enabled: actief });
    if (!actief) await this.logUit(id);
  }

  /** Alle sessies beëindigen; Keycloak stuurt het uitlogbericht naar de integratielaag. */
  async logUit(id: string): Promise<void> {
    await this.vraag("POST", `/users/${encodeURIComponent(id)}/logout`);
  }

  /** Keycloak stuurt de medewerker een mail met een link (drie dagen geldig) om dit opnieuw in te stellen. */
  async stuurHerstelmail(id: string, wat: Herstel[]): Promise<void> {
    try {
      await this.vraag("PUT", `/users/${encodeURIComponent(id)}/execute-actions-email?lifespan=${LINK_UREN * 3600}`, wat.map((w) => ACTIE[w]));
    } catch (e) {
      if (e instanceof AppFout && e.code === "keycloak-fout") throw new AppFout(502, "mail-mislukt", "Keycloak kon de mail niet versturen. Is de mailserver ingesteld (inlog.sh smtp op VPS 3)?");
      throw e;
    }
  }

  /** Hoeveel gebruikers een e-mailadres op dit domein hebben (worden elk kwartier gekoppeld). */
  async gebruikersMetDomein(domein: string): Promise<number> {
    return this.vraag<number>("GET", `/users/count?email=${encodeURIComponent(`@${domein}`)}`);
  }
}
