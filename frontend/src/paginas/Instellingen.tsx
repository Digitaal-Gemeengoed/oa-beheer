import { useEffect, useRef, useState } from "react";
import { FormField, FormLabel, Heading1, Paragraph, PrimaryActionButton, SecondaryActionButton, Select, SelectOption, StatusBadge, Textarea, Textbox } from "@utrecht/component-library-react";
import { api, type Ik } from "../api";
import { t, taal, tijd, type Sleutel } from "../i18n";
import { foutTekst, MeldingVak, RedenVeld, useLaden, type Melding } from "./gedeeld";

interface Instelling { sleutel: string; type: "geheel" | "boolean" | "tekst" | "lijst" | "tijdzone"; waarde: unknown; standaard: unknown; minimum: number | null; maximum: number | null; omschrijving: { nl: string; en: string }; gewijzigd: string | null }

/** Instellingen per onderwerp, op het eerste deel van de sleutel. */
const GROEPEN: { id: Sleutel; voorvoegsels: string[] }[] = [
  { id: "groepAanmelden", voorvoegsels: ["sessie", "pogingen", "mfa"] },
  { id: "groepNood", voorvoegsels: ["nood"] },
  { id: "groepAudit", voorvoegsels: ["audit"] },
];

/**
 * Een compacte lijst: per instelling de omschrijving, de sleutel en de waarde.
 * Klik je op een regel, dan klapt hij open om te wijzigen; er is er altijd
 * hoogstens één open.
 */
export function Instellingen({ ik }: { ik: Ik }) {
  const lijst = useLaden(() => api<Instelling[]>("GET", "/api/instellingen"));
  const kan = ik.rechten.includes("settings.manage");
  const [open, zetOpen] = useState<string | null>(null);
  const [m, zetM] = useState<Melding>(null);
  // Niet-opgeslagen invoer in de open regel; en waar de gebruiker heen wil als die er is (null = dichtklappen).
  const [vuil, zetVuil] = useState(false);
  const [wacht, zetWacht] = useState<{ naar: string | null } | null>(null);
  const ga = (naar: string | null) => { zetM(null); zetWacht(null); zetVuil(false); zetOpen(naar); };
  const wil = (naar: string | null) => (vuil && open !== null ? zetWacht({ naar }) : ga(naar));
  // Ook bij het verlaten of verversen van de pagina.
  useEffect(() => {
    if (!vuil) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [vuil]);
  const alle = lijst.data ?? [];
  const groep = (s: string) => GROEPEN.find((g) => g.voorvoegsels.includes(s.split(".")[0]))?.id ?? "groepOverig";
  const groepen = [...GROEPEN.map((g) => g.id), "groepOverig" as const]
    .map((id) => ({ id, rijen: alle.filter((i) => groep(i.sleutel) === id) }))
    .filter((g) => g.rijen.length);
  return (
    <>
      <Heading1>{t("instellingen")}</Heading1>
      <Paragraph className="ab-lead">{t(kan ? "instellingenUitleg" : "instellingenUitlegLezen")}</Paragraph>
      {lijst.fout && <MeldingVak m={{ soort: "fout", tekst: lijst.fout }} />}
      <MeldingVak m={m} />
      {groepen.map((g) => (
        <section key={g.id} className="ab-instellingen" aria-labelledby={`g-${g.id}`}>
          <h2 id={`g-${g.id}`} className="ab-instellingen-kop">{t(g.id)}</h2>
          <ul>
            {g.rijen.map((i) => (
              <Regel
                key={i.sleutel}
                i={i}
                kan={kan}
                open={open === i.sleutel}
                wissel={() => wil(open === i.sleutel ? null : i.sleutel)}
                annuleer={() => ga(null)}
                vuil={zetVuil}
                waarschuwing={open === i.sleutel && wacht ? { verwerp: () => ga(wacht.naar), blijf: () => zetWacht(null) } : null}
                klaar={() => { ga(null); zetM({ soort: "ok", tekst: `${t("opgeslagen")} ${i.omschrijving[taal()]}` }); lijst.herlaad(); }}
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function naarTekst(i: Instelling, w: unknown): string {
  if (w === null || w === undefined) return "";
  return i.type === "lijst" ? (w as string[]).join("\n") : String(w);
}

/** De waarde zoals je hem in de lijst leest: met eenheid, ja/nee, of een telling. */
function leesbaar(i: Instelling, w: unknown): string {
  if (i.type === "boolean") return t(w === true || w === "true" ? "ja" : "nee");
  if (i.type === "lijst") {
    const l = (w as string[] | null) ?? [];
    return l.length === 0 ? t("geenWaarden") : l.length === 1 ? l[0] : `${l[0]} + ${l.length - 1}`;
  }
  if (i.type === "geheel") {
    const eenheid = i.sleutel.endsWith("_minuten") ? ` ${t("minuten")}` : i.sleutel.endsWith("_dagen") ? ` ${t("dagen")}` : "";
    return `${w}${eenheid}`;
  }
  return String(w ?? "") || "—";
}

const zelfde = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

interface Waarschuwing { verwerp: () => void; blijf: () => void }

function Regel({ i, kan, open, wissel, annuleer, vuil, waarschuwing, klaar }: {
  i: Instelling; kan: boolean; open: boolean; wissel: () => void; annuleer: () => void; vuil: (v: boolean) => void; waarschuwing: Waarschuwing | null; klaar: () => void;
}) {
  const id = `i-${i.sleutel.replace(/\W/g, "-")}`;
  const aangepast = !zelfde(i.waarde, i.standaard);
  return (
    <li className={`ab-instelling${open ? " open" : ""}`}>
      <button type="button" className="ab-instelling-rij" aria-expanded={open} aria-controls={`${id}-paneel`} onClick={wissel}>
        <span className="ab-instelling-wat">
          <span className="ab-instelling-naam">{i.omschrijving[taal()]}</span>
          <span className="ab-mono ab-grijs">{i.sleutel}</span>
        </span>
        <span className="ab-instelling-waarde">{leesbaar(i, i.waarde)}</span>
        <span className="ab-instelling-stand">
          {aangepast ? <StatusBadge status="warning">{t("aangepast")}</StatusBadge> : <StatusBadge status="neutral">{t("standaardKop")}</StatusBadge>}
        </span>
        <span className="ab-instelling-tijd ab-klein">{i.gewijzigd ? tijd(i.gewijzigd) : "—"}</span>
        <span className="ab-instelling-pijl" aria-hidden="true" />
      </button>
      {open && <Paneel id={id} i={i} kan={kan} sluit={wissel} annuleer={annuleer} vuil={vuil} waarschuwing={waarschuwing} klaar={klaar} />}
    </li>
  );
}

function Paneel({ id, i, kan, sluit, annuleer, vuil, waarschuwing, klaar }: {
  id: string; i: Instelling; kan: boolean; sluit: () => void; annuleer: () => void; vuil: (v: boolean) => void; waarschuwing: Waarschuwing | null; klaar: () => void;
}) {
  const [waarde, zet] = useState(naarTekst(i, i.waarde));
  const [reden, zetReden] = useState("");
  const [bezig, zetBezig] = useState(false);
  const [m, zetM] = useState<Melding>(null);
  const veld = useRef<HTMLDivElement>(null);
  useEffect(() => { veld.current?.querySelector<HTMLElement>("input, select, textarea")?.focus(); }, []);

  const naarWaarde = (s: string): unknown =>
    i.type === "geheel" ? Number(s) : i.type === "boolean" ? s === "true" : i.type === "lijst" ? s.split("\n").map((x) => x.trim()).filter(Boolean) : s;
  const gewijzigd = !zelfde(naarWaarde(waarde), i.waarde);
  const nietOpgeslagen = kan && (gewijzigd || reden.trim() !== "");
  useEffect(() => vuil(nietOpgeslagen), [nietOpgeslagen, vuil]);
  const melding = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!waarschuwing) return;
    melding.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    melding.current?.querySelector<HTMLElement>("button")?.focus();
  }, [waarschuwing]);
  const opslaan = async () => {
    zetBezig(true);
    zetM(null);
    try {
      await api("PUT", `/api/instellingen/${i.sleutel}`, { waarde: naarWaarde(waarde), reden });
      klaar();
    } catch (x) {
      zetM({ soort: "fout", tekst: foutTekst(x) });
    } finally {
      zetBezig(false);
    }
  };
  const bereik = i.minimum !== null ? ` (${i.minimum}–${i.maximum})` : "";
  const standaard = naarTekst(i, i.standaard);

  return (
    <form
      id={`${id}-paneel`}
      className="ab-instelling-paneel"
      onSubmit={(e) => { e.preventDefault(); void opslaan(); }}
      onKeyDown={(e) => { if (e.key === "Escape") (waarschuwing ? waarschuwing.blijf() : sluit()); }}
    >
      {waarschuwing && (
        <div ref={melding} className="ab-onopgeslagen" role="alertdialog" aria-labelledby={`${id}-waarschuwing`}>
          <p id={`${id}-waarschuwing`}><b>{t("nietOpgeslagen")}</b> {t("nietOpgeslagenUitleg")}</p>
          <div className="ab-knoppen">
            <SecondaryActionButton type="button" onClick={waarschuwing.blijf}>{t("verderBewerken")}</SecondaryActionButton>
            <button type="button" className="ab-linkknop ab-rood" onClick={waarschuwing.verwerp}>{t("wijzigingWeggooien")}</button>
          </div>
        </div>
      )}
      <MeldingVak m={m} />
      <div className="ab-instelling-velden">
        <div ref={veld}>
          <FormField
            label={<FormLabel htmlFor={id}>{t("waarde")}{bereik}</FormLabel>}
            description={<>{t("standaard")}: {standaard || "—"}{i.type === "lijst" ? ` · ${t("lijstUitleg")}` : ""}</>}
          >
            {i.type === "boolean" ? (
              <Select id={id} value={waarde} disabled={!kan} onChange={(e) => zet(e.target.value)}>
                <SelectOption value="true">{t("ja")}</SelectOption>
                <SelectOption value="false">{t("nee")}</SelectOption>
              </Select>
            ) : i.type === "lijst" ? (
              <Textarea id={id} rows={3} value={waarde} disabled={!kan} onChange={(e) => zet(e.target.value)} />
            ) : (
              <Textbox id={id} type={i.type === "geheel" ? "number" : "text"} min={i.minimum ?? undefined} max={i.maximum ?? undefined} value={waarde} disabled={!kan} onChange={(e) => zet(e.target.value)} />
            )}
          </FormField>
          {kan && standaard !== waarde && (
            <button type="button" className="ab-linkknop" onClick={() => zet(standaard)}>{t("terugNaarStandaard")}</button>
          )}
        </div>
        {kan && <RedenVeld id={`${id}-reden`} waarde={reden} zet={zetReden} />}
      </div>
      <div className="ab-knoppen">
        {kan && (
          <PrimaryActionButton type="submit" disabled={bezig || !gewijzigd || reden.trim().length < 5}>{t("opslaan")}</PrimaryActionButton>
        )}
        <SecondaryActionButton type="button" onClick={annuleer}>{t(kan ? "annuleren" : "sluiten")}</SecondaryActionButton>
        {kan && !gewijzigd && <span className="ab-klein ab-grijs">{t("nogNietsGewijzigd")}</span>}
      </div>
    </form>
  );
}
