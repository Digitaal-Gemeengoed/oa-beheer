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
  extra?: ReactNode;
}) {
  const { actief } = p;
  return (
    <>
      <div className="ab-paginakop">
        <Heading1>{p.titel}</Heading1>
        {p.kan && (
          <div className="ab-knoppen">
            <SecondaryActionButton onClick={() => ga(`${p.pad}/nieuw`)}>+ {t("nieuwModel")}</SecondaryActionButton>
            {actief && <PrimaryActionButton onClick={() => ga(`${p.pad}/bewerken`)}>{t("bewerken")}</PrimaryActionButton>}
          </div>
        )}
      </div>
      <Paragraph className="ab-lead">{p.intro}</Paragraph>
      <MeldingVak m={p.melding ?? null} />
      {p.concept && (
        <div className="ab-concept">
          <span><StatusBadge status="warning">{t("conceptOpen")}</StatusBadge> {t("conceptSinds")} {tijd(p.concept.gewijzigd)}{p.concept.door ? ` · ${p.concept.door}` : ""}</span>
          {p.kan && <L naar={`${p.pad}/bewerken`}>{t("verderBewerken")} →</L>}
        </div>
      )}
      <section className="ab-kaart ab-blok ab-actiefmodel">
        <span className="ab-klein">{t("inGebruikNieuw")}</span>
        {actief ? (
          <>
            <Heading2>{actief.naam} <span className="ab-pil">{t("versie")} {actief.versie}</span></Heading2>
            <dl className="ab-feiten ab-feiten-rij">
              <div><dt>{p.basisLabel}</dt><dd>{actief.basis}</dd></div>
              <div><dt>{t("inhoud")}</dt><dd>{actief.omvang}</dd></div>
              <div><dt>{t("gepubliceerdOp")}</dt><dd>{actief.gepubliceerd ? tijd(actief.gepubliceerd) : "—"}{actief.door ? ` · ${actief.door}` : ""}</dd></div>
            </dl>
            <div className="ab-knoppen">
              <L naar={`${p.pad}/versie/${actief.versie}`}>{t("bekijken")}</L>
            </div>
          </>
        ) : (
          <Paragraph>{t("geenModelUitleg")}</Paragraph>
        )}
      </section>
      {p.extra}
      <Heading2>{t("versies")}</Heading2>
      <Paragraph className="ab-klein">{t("versiesUitleg")}</Paragraph>
      <div className="ab-tabel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("versie")}</TableHeaderCell>
              <TableHeaderCell>{t("naam")}</TableHeaderCell>
              <TableHeaderCell>{p.basisLabel}</TableHeaderCell>
              <TableHeaderCell>{t("inhoud")}</TableHeaderCell>
              <TableHeaderCell>{t("gepubliceerdOp")}</TableHeaderCell>
              <TableHeaderCell>{t("geldtVoor")}</TableHeaderCell>
              <TableHeaderCell><span className="ab-verborgen">{t("acties")}</span></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.rijen.map((v) => (
              <TableRow key={v.versie}>
                <TableCell><b>{v.versie}</b></TableCell>
                <TableCell>{v.naam}</TableCell>
                <TableCell>{v.basis}</TableCell>
                <TableCell>{v.omvang}</TableCell>
                <TableCell>{v.gepubliceerd ? tijd(v.gepubliceerd) : "—"}{v.door && <span className="ab-klein ab-blok-regel">{v.door}</span>}</TableCell>
                <TableCell>{v.actief ? <StatusBadge status="safe">{t("nieuweStukken")}</StatusBadge> : <StatusBadge status="neutral">{t("bestaandeStukken")}</StatusBadge>}</TableCell>
                <TableCell>{v.teBekijken && <L naar={`${p.pad}/versie/${v.versie}`}>{t("bekijken")}</L>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!p.rijen.length && <Paragraph className="ab-leeg">{t("geenVersies")}</Paragraph>}
      </div>
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
