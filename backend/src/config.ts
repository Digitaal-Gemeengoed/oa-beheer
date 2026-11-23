/**
 * Instellingen uit de omgeving. Het portaal start niet met een ontbrekend,
 * te kort of voorbeeldgeheim. Geen geheim komt ooit in een log, een URL of
 * de browser.
 */

export class ConfigFout extends Error {}

const VOORBEELDEN = /^(changeme|change-me|verander-?mij|voorbeeld|example|secret|geheim|password|wachtwoord|test|xxx+|\*+)$/i;

function nodig(env: NodeJS.ProcessEnv, naam: string): string {
  const w = env[naam];
  if (!w || !w.trim()) throw new ConfigFout(`${naam} ontbreekt`);
  return w.trim();
}

/** Een geheim: lang genoeg, geen voorbeeldwaarde, niet één teken herhaald. */
export function geheim(env: NodeJS.ProcessEnv, naam: string, minimaal: number): string {
  const w = nodig(env, naam);
  if (w.length < minimaal) throw new ConfigFout(`${naam} is te kort (minstens ${minimaal} tekens)`);
  if (VOORBEELDEN.test(w) || /^(.)\1+$/.test(w) || /voorbeeld|example|changeme|verander/i.test(w)) {
    throw new ConfigFout(`${naam} is een voorbeeldwaarde`);
  }
  if (new Set(w).size < 10) throw new ConfigFout(`${naam} is niet willekeurig genoeg`);
  return w;
}

export interface Config {
  /** De enige hostnaam waarop het portaal antwoordt, bijvoorbeeld oa-admin.haarlem.dev. */
  host: string;
  /** Het eigen adres, https://<host>; ook de verplichte Origin bij wijzigende verzoeken. */
  herkomst: string;
  poort: number;
  adminSecret: string;
  databaseUrl: string;
  hoofdaccountEmail: string;
  oidc: { issuer: string; clientId: string; clientSecret: string } | null;
  smtp: { host: string; poort: number; gebruiker: string; wachtwoord: string; afzender: string; tls: "starttls" | "tls" | "geen" } | null;
  /**
   * Het platform (opendop-mini), voor de pagina's die de assistent zelf
   * instellen, zoals het metadatamodel. Zonder deze instellingen staan die
   * pagina's uit. De dienstsleutel is dezelfde die de integratielaag gebruikt.
   */
  platform: { url: string; dienstsleutel: string } | null;
  /**
   * De gemeenten van de inrichting: GEMEENTEN ("haarlem:Gemeente Haarlem,zandvoort:Gemeente Zandvoort",
   * zoals op VPS 3; e-maildomeinen erachter worden genegeerd) of, zoals vroeger, één GEMEENTE.
   * Een account beheert er één, meer of alle (GR-breed).
   */
  gemeenten: { id: string; naam: string }[];
  /** Statische bestanden van de frontend. */
  frontendMap: string;
  /** Alleen voor tests en lokale ontwikkeling: e-mails naar een functie in plaats van SMTP. */
  vertrouwProxy: boolean;
}

export function leesConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const host = nodig(env, "BEHEER_HOST").toLowerCase();
  if (!/^[a-z0-9.-]+(:\d+)?$/.test(host)) throw new ConfigFout("BEHEER_HOST is geen hostnaam");
  const herkomst = env.BEHEER_HERKOMST?.trim() || `https://${host}`;
  const oidcAan = !!env.OIDC_ISSUER;
  const smtpAan = !!env.SMTP_HOST;
  return {
    host,
    herkomst,
    poort: Number(env.POORT ?? 4300),
    adminSecret: geheim(env, "ADMIN_SECRET", 32),
    databaseUrl: nodig(env, "DATABASE_URL"),
    hoofdaccountEmail: nodig(env, "HOOFDACCOUNT_EMAIL").toLowerCase(),
    oidc: oidcAan
      ? { issuer: nodig(env, "OIDC_ISSUER").replace(/\/$/, ""), clientId: nodig(env, "OIDC_CLIENT_ID"), clientSecret: geheim(env, "OIDC_CLIENT_SECRET", 32) }
      : null,
    smtp: smtpAan
      ? {
          host: nodig(env, "SMTP_HOST"),
          poort: Number(env.SMTP_POORT ?? 587),
          gebruiker: env.SMTP_GEBRUIKER ?? "",
          wachtwoord: env.SMTP_GEBRUIKER ? geheim(env, "SMTP_WACHTWOORD", 8) : "",
          afzender: nodig(env, "SMTP_AFZENDER"),
          tls: (env.SMTP_TLS as "starttls" | "tls" | "geen") ?? "starttls",
        }
      : null,
    platform: env.PLATFORM_URL
      ? {
          url: nodig(env, "PLATFORM_URL").replace(/\/$/, ""),
          dienstsleutel: geheim(env, "PLATFORM_DIENSTSLEUTEL", 16),
        }
      : null,
    gemeenten: leesGemeenten(env.GEMEENTEN, env.GEMEENTE),
    frontendMap: env.FRONTEND_MAP ?? new URL("../../frontend/dist", import.meta.url).pathname,
    vertrouwProxy: env.VERTROUW_PROXY !== "nee",
  };
}

/** "haarlem:Gemeente Haarlem:haarlem.nl,zandvoort:Gemeente Zandvoort" → [{id, naam}]. */
export function leesGemeenten(lijst: string | undefined, enkel?: string): { id: string; naam: string }[] {
  const uit: { id: string; naam: string }[] = [];
  const tekst = (lijst ?? "").trim().replace(/^"|"$/g, "") || (enkel ?? "").trim();
  for (const deel of tekst.split(",").map((x) => x.trim()).filter(Boolean)) {
    const [ruw, ...rest] = deel.split(":");
    const id = ruw!.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(id)) throw new ConfigFout(`GEMEENTEN: "${id}" is geen geldige code (zoals haarlem)`);
    if (rest.length > 1 && /^[a-z0-9.+-]+$/.test(rest[rest.length - 1]!)) rest.pop();
    const naam = rest.join(":").trim() || `Gemeente ${id.split("-").map((d) => (d ? d[0]!.toUpperCase() + d.slice(1) : d)).join("-")}`;
    if (!uit.some((g) => g.id === id)) uit.push({ id, naam });
  }
  return uit;
}
