/**
 * E-maildomeinen van een gemeente. Wie een domein aan een gemeente koppelt,
 * bepaalt wie er bij die gemeente hoort (Keycloak Organizations). Daarom geen
 * algemene domeinen van e-maildiensten en providers: daarmee zou iedereen met
 * zo'n adres bij de gemeente horen.
 */
export const ALGEMENE_DOMEINEN = new Set([
  // Internationaal
  "gmail.com", "googlemail.com", "outlook.com", "outlook.nl", "hotmail.com", "hotmail.nl", "live.com", "live.nl", "msn.com",
  "yahoo.com", "yahoo.nl", "icloud.com", "me.com", "mac.com", "aol.com", "gmx.com", "gmx.net", "gmx.de", "mail.com",
  "proton.me", "protonmail.com", "pm.me", "tutanota.com", "tuta.io", "zoho.com", "yandex.com", "fastmail.com",
  // Nederlandse providers
  "ziggo.nl", "kpnmail.nl", "kpnplanet.nl", "planet.nl", "hetnet.nl", "xs4all.nl", "home.nl", "casema.nl", "chello.nl",
  "upcmail.nl", "quicknet.nl", "online.nl", "tele2.nl", "telfort.nl", "zonnet.nl", "freedom.nl", "solcon.nl", "caiway.nl",
  "kabelfoon.nl", "zeelandnet.nl", "onsbrabantnet.nl", "dds.nl", "wxs.nl", "versatel.nl", "tiscali.nl", "12move.nl",
  // Voorbeelden en tests
  "example.com", "example.org", "example.net", "example.nl", "test.nl",
]);

const DOMEIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** "@Haarlem.NL", "www.haarlem.nl" → "haarlem.nl". */
export function normaliseer(d: string): string {
  return d.trim().toLowerCase().replace(/^@/, "").replace(/^www\./, "").replace(/\.$/, "");
}

/** Wat er mis is met een domein, of null. */
export function toetsDomein(d: string): string | null {
  if (!DOMEIN.test(d)) return `"${d}" is geen geldig domein (zoals haarlem.nl).`;
  const algemeen = [...ALGEMENE_DOMEINEN].find((a) => d === a || d.endsWith(`.${a}`));
  if (algemeen) return `"${d}" is een algemeen e-maildomein; daarmee zou iedereen met zo'n adres bij de gemeente horen.`;
  return null;
}
