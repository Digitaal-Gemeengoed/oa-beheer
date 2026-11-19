import { useState } from "react";
import {
  Alert, FormField, FormLabel, Heading1, Paragraph, PrimaryActionButton, SecondaryActionButton, StatusBadge,
  Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Textbox,
} from "@utrecht/component-library-react";
import { api } from "../api";
import { t, tijd } from "../i18n";
import { ga, L } from "../App";
import { foutTekst, MeldingVak, RedenVeld, type Melding } from "./gedeeld";

/**
 * Het overzicht van een model met versies (metadatamodel, classificatiemodel).
 * Eén versie is in gebruik voor nieuwe stukken; stukken die al zijn
 * vastgelegd houden de versie waarmee ze zijn vastgelegd. Oudere versies zijn
 * alleen te bekijken, niet aan te passen: wie iets wil veranderen, maakt een
 * nieuwe versie.
 */
export interface Intrekking { reden: string; door: string | null; op: string }
export interface VersieRij {
  versie: number; naam: string; basis: string; omvang: string; gepubliceerd: string | null; door: string | null; actief: boolean; teBekijken: boolean;
  /** Wanneer de versie ingaat (of inging). */
  ingang: string | null;
  /** Nog niet ingegaan en niet ingetrokken: tot de ingang geldt de huidige versie. */
  gepland: boolean;
  ingetrokken: Intrekking | null;
}

/** Of een versie gepland staat: ingang in de toekomst en niet ingetrokken. */
export const isGepland = (v: { ingang?: string | null; ingetrokken?: Intrekking | null }) =>
  !v.ingetrokken && !!v.ingang && new Date(v.ingang).getTime() > Date.now();

/** De status van een versie, voor de lijst en de kop. */
function Status({ v, kort }: { v: VersieRij; kort?: boolean }) {
  const [badge, regel] = v.actief
    ? [<StatusBadge status="safe">{t("inGebruik")}</StatusBadge>, t("nieuweStukken")]
    : v.gepland
      ? [<StatusBadge status="warning">{t("geplandKop")}</StatusBadge>, `${t("gaatInOp")} ${tijd(v.ingang)}`]
      : v.ingetrokken
        ? [<StatusBadge status="neutral">{t("ingetrokken")}</StatusBadge>, t("gaatNietIn")]
        : [<StatusBadge status="neutral">{t("vorigeVersie")}</StatusBadge>, `${t("bestaandeStukken")} · ${t("alleenLezen")}`];
  return <>{badge}{!kort && <span className="ab-klein ab-blok-regel">{regel}</span>}</>;
}

/** De melding over een geplande versie: tot de ingang blijft de huidige gelden. */
export function PlanningMelding({ gepland, actief }: { gepland: VersieRij; actief: VersieRij | null }) {
  return (
    <Alert type="info">
      <Paragraph>
        <b>{t("versieKop")} {gepland.versie}</b> {t("gaatInOp")} <b>{tijd(gepland.ingang)}</b>.{" "}
        {actief ? `${t("totDanGeldt")} ${actief.versie}.` : ""} {t("geplandBlokkeert")}
      </Paragraph>
    </Alert>
  );
}

/** Wanneer een nieuwe versie ingaat. Leeg: meteen. */
export function IngangVeld({ id, waarde, zet }: { id: string; waarde: string; zet: (s: string) => void }) {
  const nu = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return (
    <FormField label={<FormLabel htmlFor={id}>{t("ingangsdatum")}</FormLabel>} description={t("ingangsdatumUitleg")}>
      <Textbox id={id} type="datetime-local" min={nu} value={waarde} onChange={(e) => zet(e.target.value)} />
    </FormField>
  );
}

/** De ingang zoals het platform hem wil: ISO, of niets (meteen). Een moment in het verleden is ook meteen. */
export function ingangVoorPlatform(waarde: string): string | undefined {
  if (!waarde) return undefined;
  const d = new Date(waarde);
  return Number.isNaN(d.getTime()) || d.getTime() <= Date.now() ? undefined : d.toISOString();
}

/** De melding op het overzicht na publiceren, plannen of intrekken. */
function meldingUitAdres(): Melding {
  const q = new URLSearchParams(location.search);
  if (q.get("gepland")) return { soort: "ok", tekst: `${t("versieKop")} ${q.get("gepland")} ${t("staatGepland")}` };
  if (q.get("ingetrokken")) return { soort: "ok", tekst: `${t("versieKop")} ${q.get("ingetrokken")} ${t("isIngetrokken")}` };
  return null;
}

export function ModelOverzicht(p: {
  titel: string;
  intro: string;
  pad: string;
  kan: boolean;
  rijen: VersieRij[];
  actief: VersieRij | null;
  basisLabel: string;
  concept?: { gewijzigd: string; door: string | null } | null;
  melding?: Melding;
}) {
  // De actieve versie opent de bewerker (een wijziging wordt een nieuwe versie); oudere versies alleen lezen.
  const doel = (v: VersieRij) => (v.actief && p.kan ? `${p.pad}/bewerken` : `${p.pad}/versie/${v.versie}`);
  const gepland = p.rijen.find((r) => r.gepland);
  return (
    <>
      <div className="ab-paginakop">
        <Heading1>{p.titel}</Heading1>
        {p.kan && <PrimaryActionButton onClick={() => ga(`${p.pad}/nieuw`)}>+ {t("nieuwModel")}</PrimaryActionButton>}
      </div>
      <Paragraph className="ab-lead">{p.intro}</Paragraph>
      <MeldingVak m={p.melding ?? meldingUitAdres()} />
      {gepland && <PlanningMelding gepland={gepland} actief={p.actief} />}
      <div className="ab-tabel ab-versies">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("versieKop")}</TableHeaderCell>
              <TableHeaderCell>{t("naam")}</TableHeaderCell>
              <TableHeaderCell>{p.basisLabel}</TableHeaderCell>
              <TableHeaderCell>{t("inhoud")}</TableHeaderCell>
              <TableHeaderCell>{t("gepubliceerdOp")}</TableHeaderCell>
              <TableHeaderCell>{t("status")}</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.concept && p.kan && (
              <TableRow className="ab-klikbaar ab-conceptrij" onClick={() => ga(`${p.pad}/bewerken`)}>
                <TableCell>—</TableCell>
                <TableCell><L naar={`${p.pad}/bewerken`}>{t("concept")}</L></TableCell>
                <TableCell colSpan={2} className="ab-klein">{t("conceptSinds")} {tijd(p.concept.gewijzigd)}{p.concept.door ? ` · ${p.concept.door}` : ""}</TableCell>
                <TableCell>—</TableCell>
                <TableCell><StatusBadge status="warning">{t("conceptOpen")}</StatusBadge></TableCell>
              </TableRow>
            )}
            {p.rijen.map((v) => (
              <TableRow key={v.versie} className={`ab-klikbaar${v.actief ? " ab-actief" : ""}${v.ingetrokken ? " ab-ingetrokken" : ""}`} onClick={() => ga(doel(v))}>
                <TableCell>{v.versie}</TableCell>
                <TableCell><L naar={doel(v)}>{v.naam}</L></TableCell>
                <TableCell>{v.basis}</TableCell>
                <TableCell>{v.omvang}</TableCell>
                <TableCell>{v.gepubliceerd ? tijd(v.gepubliceerd) : "—"}{v.door && <span className="ab-klein ab-blok-regel">{v.door}</span>}</TableCell>
                <TableCell><Status v={v} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!p.rijen.length && <Paragraph className="ab-leeg">{t("geenModelUitleg")}</Paragraph>}
      </div>
      <Paragraph className="ab-klein">{t("versiesUitleg")}</Paragraph>
    </>
  );
}

/** De kop van één versie: alleen lezen. Een geplande versie kun je hier intrekken. */
export function VersieKop({ titel, pad, rij, intrekPad, herlaad }: { titel: string; pad: string; rij: VersieRij | undefined; intrekPad?: string; herlaad?: () => void }) {
  return (
    <>
      <Paragraph><L naar={pad}>← {titel}</L></Paragraph>
      <div className="ab-paginakop">
        <Heading1>{rij ? `${rij.naam} · ${t("versie")} ${rij.versie}` : t("versie")}</Heading1>
        {rij && <Status v={rij} kort />}
      </div>
      {rij?.gepland ? (
        <Paragraph className="ab-klein">{t("geplandVersie")} {tijd(rij.ingang)}. {t("geplandVersie2")}</Paragraph>
      ) : rij?.ingetrokken ? (
        <Paragraph className="ab-klein">{t("ingetrokkenOp")} {tijd(rij.ingetrokken.op)}{rij.ingetrokken.door ? ` ${t("door").toLowerCase()} ${rij.ingetrokken.door}` : ""}: {rij.ingetrokken.reden}</Paragraph>
      ) : (
        <Paragraph className="ab-klein">{t("alleenLezenVersie")}</Paragraph>
      )}
      {rij?.gepland && intrekPad && <PlanningIntrekken pad={pad} intrekPad={intrekPad} versie={rij.versie} herlaad={herlaad} />}
    </>
  );
}

/** Een geplande versie intrekken: hij gaat dan nooit in; de huidige blijft gelden. Met reden, in de audit. */
function PlanningIntrekken({ pad, intrekPad, versie, herlaad }: { pad: string; intrekPad: string; versie: number; herlaad?: () => void }) {
  const [open, zetOpen] = useState(false);
  const [reden, zetReden] = useState("");
  const [bezig, zetBezig] = useState(false);
  const [m, zetM] = useState<Melding>(null);
  if (!open) return <div className="ab-knoppen ab-ruimte"><SecondaryActionButton onClick={() => zetOpen(true)}>{t("planningIntrekken")}</SecondaryActionButton></div>;
  const doe = async () => {
    zetBezig(true);
    zetM(null);
    try {
      await api("POST", intrekPad, { reden });
      ga(`${pad}?ingetrokken=${versie}`);
      herlaad?.();
    } catch (e) {
      zetM({ soort: "fout", tekst: foutTekst(e) });
    } finally {
      zetBezig(false);
    }
  };
  return (
    <form className="ab-kaart ab-blok ab-formulier ab-ruimte" onSubmit={(e) => { e.preventDefault(); void doe(); }}>
      <Paragraph>{t("intrekkenUitleg")}</Paragraph>
      <MeldingVak m={m} />
      <RedenVeld id="intrek-reden" waarde={reden} zet={zetReden} />
      <div className="ab-knoppen">
        <PrimaryActionButton type="submit" disabled={bezig || reden.trim().length < 5}>{t("planningIntrekken")}</PrimaryActionButton>
        <SecondaryActionButton type="button" onClick={() => zetOpen(false)}>{t("annuleren")}</SecondaryActionButton>
      </div>
    </form>
  );
}

/** De keuze bij een nieuw model: kaarten met het basismodel of de selectielijst. */
export function Keuzekaarten<K extends string>({ opties, gekozen, kies }: { opties: { id: K; naam: string; sub?: string; uitleg: string }[]; gekozen: K | null; kies: (k: K) => void }) {
  return (
    <div className="md-modellen" role="radiogroup">
      {opties.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={gekozen === o.id} className={`md-model${gekozen === o.id ? " gekozen" : ""}`} onClick={() => kies(o.id)}>
          <span className="md-model-kop"><b>{o.naam}</b>{o.sub && <span className="ab-klein">{o.sub}</span>}</span>
          <span className="ab-klein">{o.uitleg}</span>
        </button>
      ))}
    </div>
  );
}
