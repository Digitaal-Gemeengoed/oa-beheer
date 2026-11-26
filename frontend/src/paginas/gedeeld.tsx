import { useEffect, useState } from "react";
import { Alert, FormField, FormLabel, Paragraph, Textarea } from "@utrecht/component-library-react";
import { ApiFout } from "../api";
import { t, taal, tijd } from "../i18n";

export type Melding = { soort: "ok" | "fout"; tekst: string } | null;

export function MeldingVak({ m }: { m: Melding }) {
  if (!m) return null;
  return <Alert type={m.soort === "ok" ? "ok" : "error"}><Paragraph>{m.tekst}</Paragraph></Alert>;
}

export function foutTekst(e: unknown): string {
  if (e instanceof ApiFout) return e.code === "verzoek-ongeldig" ? `${t("geweigerd")} (${t("redenUitleg")})` : e.message;
  return t("geweigerd");
}

export function RedenVeld({ id, waarde, zet, uitleg }: { id: string; waarde: string; zet: (s: string) => void; uitleg?: string }) {
  return (
    <FormField label={<FormLabel htmlFor={id}>{t("reden")}</FormLabel>} description={uitleg ?? t("redenUitleg")}>
      <Textarea id={id} value={waarde} rows={2} maxLength={1000} required onChange={(e) => zet(e.target.value)} />
    </FormField>
  );
}

/** Laadt gegevens; opnieuw met herlaad(). */
export function useLaden<T>(laad: () => Promise<T>): { data: T | null; fout: string | null; herlaad: () => void } {
  const [data, zet] = useState<T | null>(null);
  const [fout, zetFout] = useState<string | null>(null);
  const [teller, zetTeller] = useState(0);
  useEffect(() => {
    laad().then(zet, (e) => zetFout(foutTekst(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teller]);
  return { data, fout, herlaad: () => zetTeller((n) => n + 1) };
}

/** "5 min geleden", "3 uur geleden", "2 dagen geleden"; ouder: de datum. */
export function relatief(w: string | null | undefined): string {
  if (!w) return t("nooit");
  const s = (Date.now() - new Date(w).getTime()) / 1000;
  if (s < 60) return t("zojuist");
  if (s < 3600) return `${Math.floor(s / 60)} ${t("minutenGeleden")}`;
  if (s < 86400) return `${Math.floor(s / 3600)} ${t("urenGeleden")}`;
  if (s < 2 * 86400) return t("gisteren");
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} ${t("dagenGeleden")}`;
  return tijd(w).split(",")[0] ?? tijd(w);
}

export function initialen(naam: string): string {
  const d = naam.trim().split(/\s+/).filter((w) => /^\p{Lu}/u.test(w));
  return ((d[0]?.[0] ?? naam[0] ?? "?") + (d.length > 1 ? d[d.length - 1]![0] : "")).toUpperCase();
}

export function Avatar({ naam, groot }: { naam: string; groot?: boolean }) {
  return <span className={`ab-avatar${groot ? " groot" : ""}`} aria-hidden="true">{initialen(naam)}</span>;
}

/** Leesbare naam van een auditactie; onbekende acties zoals ze zijn. */
const ACTIES: Record<string, [string, string]> = {
  "inloggen.gelukt": ["Ingelogd", "Signed in"],
  "inloggen.mislukt": ["Inloggen mislukt", "Sign-in failed"],
  uitloggen: ["Uitgelogd", "Signed out"],
  "nood.ingelogd": ["Noodtoegang gebruikt", "Emergency access used"],
  "nood.mislukt": ["Noodtoegang mislukt", "Emergency access failed"],
  "nood.geblokkeerd": ["Noodtoegang geblokkeerd", "Emergency access blocked"],
  "account.aangemaakt": ["Account toegevoegd", "Account added"],
  "medewerker.aangemaakt": ["Medewerker toegevoegd", "Staff member added"],
  "medewerker.niveau": ["PPL-niveau gewijzigd", "PPL level changed"],
  "medewerker.uitgeschakeld": ["Medewerker uitgeschakeld", "Staff member disabled"],
  "medewerker.ingeschakeld": ["Medewerker ingeschakeld", "Staff member enabled"],
  "medewerker.gepland": ["In- of uitschakelen gepland", "Enable or disable scheduled"],
  "medewerker.gepland.geannuleerd": ["Geplande wijziging medewerker geannuleerd", "Scheduled staff change cancelled"],
  "medewerker.herstelmail": ["Herstelmail gestuurd", "Reset email sent"],
  "account.gewijzigd": ["Account gewijzigd", "Account changed"],
  "account.groepen": ["Groepen van een account gewijzigd", "Account groups changed"],
  "account.status.gepland": ["Statuswijziging ingepland", "Status change scheduled"],
  "account.status.ingegaan": ["Statuswijziging ingegaan", "Status change took effect"],
  "account.status.geannuleerd": ["Statuswijziging geannuleerd", "Status change cancelled"],
  "account.uitgelogd": ["Overal uitgelogd", "Signed out everywhere"],
  "sessie.beeindigd": ["Sessie beëindigd", "Session ended"],
  "groep.aangemaakt": ["Groep toegevoegd", "Group added"],
  "groep.gewijzigd": ["Groep gewijzigd", "Group changed"],
  "groep.verwijderd": ["Groep verwijderd", "Group deleted"],
  "instelling.gewijzigd": ["Instelling gewijzigd", "Setting changed"],
  "hoofdaccount.aangemaakt": ["Hoofdaccount aangemaakt", "Master account created"],
  "metadatamodel.gepubliceerd": ["Metadatamodel gepubliceerd", "Metadata model published"],
  "classificatiemodel.gepubliceerd": ["Classificatiemodel gepubliceerd", "Classification model published"],
  "account.gekoppeld": ["Account gekoppeld bij eerste aanmelding", "Account linked at first sign-in"],
  "audit.dagelijks": ["Dagelijkse controle van de audit", "Daily audit check"],
  "profiel.gewijzigd": ["Eigen profiel gewijzigd", "Own profile changed"],
  "sessie.verlopen": ["Sessie verlopen", "Session expired"],
};
export function actieTekst(actie: string): string {
  const a = ACTIES[actie];
  return a ? a[taal() === "nl" ? 0 : 1] : actie;
}
