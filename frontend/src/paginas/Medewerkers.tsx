import { useEffect, useState, type FormEvent } from "react";
import {
  FormField, FormLabel, Heading1, Heading2, Paragraph, PrimaryActionButton, SecondaryActionButton, Select, SelectOption,
  Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Textbox,
} from "@utrecht/component-library-react";
import { api } from "../api";
import { t } from "../i18n";
import { foutTekst, MeldingVak, RedenVeld, type Melding } from "./gedeeld";

interface Medewerker {
  id: string;
  gebruikersnaam: string;
  email: string | null;
  naam: string;
  actief: boolean;
  rollen: string[];
  niveau: number;
  zelf: boolean;
}
interface Overzicht {
  gemeente: string;
  keycloak: { aan: boolean };
  medewerkers: Medewerker[];
  meer: boolean;
  magWijzigen?: boolean;
}

const NIVEAUS = [0, 1, 2, 3] as const;
const niveauTekst = (n: number) => t(`ppl${n}` as never);

/**
 * Medewerkers van de gemeente die je beheert, met hun niveau voor
 * persoonsgegevens (PPL): welke originele waarden achter de plaatshouders
 * iemand mag zien. Het niveau staat in Keycloak; wijzigen met een reden, niet
 * voor jezelf, en het geldt vanaf de volgende keer inloggen.
 */
export function Medewerkers({ gemeenteNaam }: { gemeenteNaam: string }) {
  const [zoek, zetZoek] = useState("");
  const [data, zetData] = useState<Overzicht | null>(null);
  const [m, zetM] = useState<Melding>(null);
  const [bewerk, zetBewerk] = useState<{ m: Medewerker; niveau: number; reden: string } | null>(null);

  const laad = (z = zoek) =>
    api<Overzicht>("GET", `/api/medewerkers${z.trim() ? `?zoek=${encodeURIComponent(z.trim())}` : ""}`).then(zetData, (e) => zetM({ soort: "fout", tekst: foutTekst(e) }));
  useEffect(() => {
    void laad("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoeken = (e: FormEvent) => {
    e.preventDefault();
    void laad();
  };

  const opslaan = async (e: FormEvent) => {
    e.preventDefault();
    if (!bewerk) return;
    try {
      await api("PUT", `/api/medewerkers/${bewerk.m.id}/niveau`, { niveau: bewerk.niveau, reden: bewerk.reden });
      zetM({ soort: "ok", tekst: t("niveauGewijzigd").replace("{wie}", bewerk.m.email ?? bewerk.m.gebruikersnaam).replace("{niveau}", String(bewerk.niveau)) });
      zetBewerk(null);
      await laad();
    } catch (x) {
      zetM({ soort: "fout", tekst: foutTekst(x) });
    }
    scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <Heading1>{t("medewerkers")}</Heading1>
      <Paragraph className="ab-klein">{t("medewerkersUitleg").replace("{gemeente}", gemeenteNaam)}</Paragraph>
      <ul className="ab-klein ab-niveaus">
        {NIVEAUS.map((n) => <li key={n}><span className="ab-pil">PPL {n}</span> {niveauTekst(n)}</li>)}
      </ul>
      <Paragraph className="ab-klein">{t("niveauVolgendeInlog")}</Paragraph>
      <MeldingVak m={m} />
      {data && !data.keycloak.aan && <Paragraph className="ab-waarschuwing">{t("medewerkersZonderKeycloak")}</Paragraph>}

      {bewerk && (
        <form className="ab-kaart ab-blok ab-formulier" onSubmit={opslaan}>
          <Heading2>{t("niveauWijzigen")}: {bewerk.m.naam}</Heading2>
          <Paragraph className="ab-klein">{bewerk.m.email ?? bewerk.m.gebruikersnaam} · {t("nu")} PPL {bewerk.m.niveau}</Paragraph>
          <FormField label={<FormLabel htmlFor="m-niveau">{t("niveau")}</FormLabel>} description={niveauTekst(bewerk.niveau)}>
            <Select id="m-niveau" value={String(bewerk.niveau)} onChange={(e) => zetBewerk({ ...bewerk, niveau: Number(e.target.value) })}>
              {NIVEAUS.map((n) => <SelectOption key={n} value={String(n)}>PPL {n}</SelectOption>)}
            </Select>
          </FormField>
          <RedenVeld id="m-reden" waarde={bewerk.reden} zet={(reden) => zetBewerk({ ...bewerk, reden })} uitleg={t("niveauRedenUitleg")} />
          <div className="ab-knoppen">
            <PrimaryActionButton type="submit" disabled={bewerk.niveau === bewerk.m.niveau}>{t("opslaan")}</PrimaryActionButton>
            <SecondaryActionButton type="button" onClick={() => zetBewerk(null)}>{t("annuleren")}</SecondaryActionButton>
          </div>
        </form>
      )}

      <form className="ab-zoekbalk" onSubmit={zoeken} role="search">
        <FormField label={<FormLabel htmlFor="m-zoek">{t("zoeken")}</FormLabel>}>
          <Textbox id="m-zoek" type="search" maxLength={100} value={zoek} onChange={(e) => zetZoek(e.target.value)} />
        </FormField>
        <SecondaryActionButton type="submit">{t("zoekKnop")}</SecondaryActionButton>
      </form>

      <div className="ab-kaart ab-tabel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("naam")}</TableHeaderCell>
              <TableHeaderCell>{t("rollen")}</TableHeaderCell>
              <TableHeaderCell>{t("niveau")}</TableHeaderCell>
              {data?.magWijzigen && <TableHeaderCell><span className="ab-klein">{t("acties")}</span></TableHeaderCell>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.medewerkers.map((x) => (
              <TableRow key={x.id}>
                <TableCell>
                  {x.naam}
                  <div className="ab-klein">{x.email ?? x.gebruikersnaam}{!x.actief && ` · ${t("uitgeschakeld")}`}</div>
                </TableCell>
                <TableCell className="ab-klein">{x.rollen.length ? x.rollen.join(", ") : "—"}</TableCell>
                <TableCell><span className="ab-pil" title={niveauTekst(x.niveau)}>PPL {x.niveau}</span></TableCell>
                {data.magWijzigen && (
                  <TableCell>
                    {x.zelf
                      ? <span className="ab-klein">{t("eigenNiveau")}</span>
                      : <SecondaryActionButton onClick={() => { zetBewerk({ m: x, niveau: x.niveau, reden: "" }); scrollTo({ top: 0, behavior: "smooth" }); }}>{t("wijzigen")}</SecondaryActionButton>}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {data && data.keycloak.aan && !data.medewerkers.length && (
              <TableRow><TableCell colSpan={4}>{t("geenMedewerkers")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {data?.meer && <Paragraph className="ab-klein">{t("medewerkersMeer")}</Paragraph>}
    </>
  );
}
