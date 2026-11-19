import type { ReactNode } from "react";
import {
  Heading1, Heading2, Paragraph, PrimaryActionButton, SecondaryActionButton, StatusBadge,
  Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow,
} from "@utrecht/component-library-react";
import { t, tijd } from "../i18n";
import { ga, L } from "../App";
import { MeldingVak, type Melding } from "./gedeeld";

/**
 * Het overzicht van een model met versies (metadatamodel, classificatiemodel).
 * Eén versie is in gebruik voor nieuwe stukken; stukken die al zijn
 * vastgelegd houden de versie waarmee ze zijn vastgelegd. Oudere versies zijn
 * alleen te bekijken, niet aan te passen: wie iets wil veranderen, maakt een
 * nieuwe versie.
 */
export interface VersieRij { versie: number; naam: string; basis: string; omvang: string; gepubliceerd: string | null; door: string | null; actief: boolean; teBekijken: boolean }

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
  return (
    <>
      <div className="ab-paginakop">
        <Heading1>{p.titel}</Heading1>
        {p.kan && <PrimaryActionButton onClick={() => ga(`${p.pad}/nieuw`)}>+ {t("nieuwModel")}</PrimaryActionButton>}
      </div>
      <Paragraph className="ab-lead">{p.intro}</Paragraph>
      <MeldingVak m={p.melding ?? null} />
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
              <TableRow key={v.versie} className={`ab-klikbaar${v.actief ? " ab-actief" : ""}`} onClick={() => ga(doel(v))}>
                <TableCell>{v.versie}</TableCell>
                <TableCell><L naar={doel(v)}>{v.naam}</L></TableCell>
                <TableCell>{v.basis}</TableCell>
                <TableCell>{v.omvang}</TableCell>
                <TableCell>{v.gepubliceerd ? tijd(v.gepubliceerd) : "—"}{v.door && <span className="ab-klein ab-blok-regel">{v.door}</span>}</TableCell>
                <TableCell>
                  {v.actief
                    ? <><StatusBadge status="safe">{t("inGebruik")}</StatusBadge><span className="ab-klein ab-blok-regel">{t("nieuweStukken")}</span></>
                    : <><StatusBadge status="neutral">{t("vorigeVersie")}</StatusBadge><span className="ab-klein ab-blok-regel">{t("bestaandeStukken")} · {t("alleenLezen")}</span></>}
                </TableCell>
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

/** De kop van één versie: alleen lezen. */
export function VersieKop({ titel, pad, rij }: { titel: string; pad: string; rij: VersieRij | undefined }) {
  return (
    <>
      <Paragraph><L naar={pad}>← {titel}</L></Paragraph>
      <div className="ab-paginakop">
        <Heading1>{rij ? `${rij.naam} · ${t("versie")} ${rij.versie}` : t("versie")}</Heading1>
        {rij && (rij.actief ? <StatusBadge status="safe">{t("nieuweStukken")}</StatusBadge> : <StatusBadge status="neutral">{t("bestaandeStukken")}</StatusBadge>)}
      </div>
      <Paragraph className="ab-klein">{t("alleenLezenVersie")}</Paragraph>
    </>
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
