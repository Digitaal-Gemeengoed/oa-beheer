import { useEffect, useState, type FormEvent } from "react";
import {
  Checkbox, FormField, FormLabel, Heading1, Heading2, Paragraph, PrimaryActionButton, SecondaryActionButton, Select, SelectOption,
  StatusBadge, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Textbox,
} from "@utrecht/component-library-react";
import { api } from "../api";
import { t, tijd } from "../i18n";
import { foutTekst, MeldingVak, RedenVeld, type Melding } from "./gedeeld";

interface Gepland {
  id: string;
  actief: boolean;
  ingang: string;
  reden: string;
  fout: string | null;
}
interface Medewerker {
  id: string;
  gebruikersnaam: string;
  email: string | null;
  naam: string;
  actief: boolean;
  rollen: string[];
  niveau: number;
  wachtOpInstellen: boolean;
  zelf: boolean;
  portaal: boolean;
  gepland: Gepland[];
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

/** Wat er nu open staat: een nieuwe medewerker, of een handeling voor één medewerker. */
type Bewerk =
  | { soort: "nieuw"; email: string; voornaam: string; achternaam: string; niveau: number; reden: string }
  | { soort: "niveau"; m: Medewerker; niveau: number; reden: string }
  | { soort: "actief"; m: Medewerker; ingang: string; reden: string }
  | { soort: "herstel"; m: Medewerker; wachtwoord: boolean; authenticator: boolean; reden: string }
  | { soort: "annuleer"; m: Medewerker; g: Gepland; reden: string };

/**
 * Medewerkers van de gemeente die je beheert: hun inlogaccount in Keycloak,
 * rollen en niveau voor persoonsgegevens (PPL). Toevoegen, niveau wijzigen,
 * in- en uitschakelen (ook op een datum) en een herstelmail laten sturen.
 * Wachtwoorden lopen nooit via het portaal: Keycloak mailt de medewerker.
 */
export function Medewerkers({ gemeenteNaam }: { gemeenteNaam: string }) {
  const [zoek, zetZoek] = useState("");
  const [data, zetData] = useState<Overzicht | null>(null);
  const [m, zetM] = useState<Melding>(null);
  const [bewerk, zetBewerk] = useState<Bewerk | null>(null);
  const [bezig, zetBezig] = useState(false);

  const laad = (z = zoek) =>
    api<Overzicht>("GET", `/api/medewerkers${z.trim() ? `?zoek=${encodeURIComponent(z.trim())}` : ""}`).then(zetData, (e) => zetM({ soort: "fout", tekst: foutTekst(e) }));
  useEffect(() => {
    void laad("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (b: Bewerk) => {
    zetBewerk(b);
    zetM(null);
    scrollTo({ top: 0, behavior: "smooth" });
  };
  const wie = (x: Medewerker) => x.email ?? x.gebruikersnaam;

  const opslaan = async (e: FormEvent) => {
    e.preventDefault();
    if (!bewerk) return;
    zetBezig(true);
    try {
      let tekst = "";
      if (bewerk.soort === "nieuw") {
        const r = await api<{ mail: boolean }>("POST", "/api/medewerkers", {
          email: bewerk.email.trim(), voornaam: bewerk.voornaam.trim(), achternaam: bewerk.achternaam.trim(), niveau: bewerk.niveau, reden: bewerk.reden,
        });
        tekst = (r.mail ? t("medewerkerToegevoegd") : t("medewerkerToegevoegdZonderMail")).replace("{wie}", bewerk.email.trim().toLowerCase());
      } else if (bewerk.soort === "niveau") {
        await api("PUT", `/api/medewerkers/${bewerk.m.id}/niveau`, { niveau: bewerk.niveau, reden: bewerk.reden });
        tekst = t("niveauGewijzigd").replace("{wie}", wie(bewerk.m)).replace("{niveau}", String(bewerk.niveau));
      } else if (bewerk.soort === "actief") {
        const aan = !bewerk.m.actief;
        const r = await api<{ uitgevoerd: boolean }>("POST", `/api/medewerkers/${bewerk.m.id}/actief`, {
          actief: aan, reden: bewerk.reden, ...(bewerk.ingang ? { ingang: new Date(bewerk.ingang).toISOString() } : {}),
        });
        tekst = (r.uitgevoerd ? (aan ? t("medewerkerIngeschakeld") : t("medewerkerUitgeschakeld")) : t("medewerkerGepland").replace("{wanneer}", tijd(new Date(bewerk.ingang).toISOString()))).replace("{wie}", wie(bewerk.m));
      } else if (bewerk.soort === "herstel") {
        await api("POST", `/api/medewerkers/${bewerk.m.id}/herstelmail`, { wachtwoord: bewerk.wachtwoord, authenticator: bewerk.authenticator, reden: bewerk.reden });
        tekst = t("herstelmailVerstuurd").replace("{wie}", wie(bewerk.m));
      } else {
        await api("POST", `/api/medewerkers/gepland/${bewerk.g.id}/annuleren`, { reden: bewerk.reden });
        tekst = t("geplandGeannuleerd").replace("{wie}", wie(bewerk.m));
      }
      zetM({ soort: "ok", tekst });
      zetBewerk(null);
      await laad();
    } catch (x) {
      zetM({ soort: "fout", tekst: foutTekst(x) });
    } finally {
      zetBezig(false);
    }
    scrollTo({ top: 0, behavior: "smooth" });
  };

  const knoppen = (kan = true) => (
    <div className="ab-knoppen">
      <PrimaryActionButton type="submit" disabled={!kan || bezig} busy={bezig}>{t("opslaan")}</PrimaryActionButton>
      <SecondaryActionButton type="button" onClick={() => zetBewerk(null)}>{t("annuleren")}</SecondaryActionButton>
    </div>
  );
  const niveauKeuze = (id: string, waarde: number, zet: (n: number) => void) => (
    <FormField label={<FormLabel htmlFor={id}>{t("niveau")}</FormLabel>} description={niveauTekst(waarde)}>
      <Select id={id} value={String(waarde)} onChange={(e) => zet(Number(e.target.value))}>
        {NIVEAUS.map((n) => <SelectOption key={n} value={String(n)}>PPL {n}</SelectOption>)}
      </Select>
    </FormField>
  );

  const formulier = () => {
    if (!bewerk) return null;
    const b = bewerk;
    const reden = (uitleg?: string) => <RedenVeld id="m-reden" waarde={b.reden} zet={(reden) => zetBewerk({ ...b, reden } as Bewerk)} uitleg={uitleg} />;
    const kop = (titel: string, x?: Medewerker) => (
      <>
        <Heading2>{titel}{x ? `: ${x.naam}` : ""}</Heading2>
        {x && <Paragraph className="ab-klein">{wie(x)} · PPL {x.niveau}{!x.actief && ` · ${t("uitgeschakeld")}`}</Paragraph>}
      </>
    );
    return (
      <form className="ab-kaart ab-blok ab-formulier" onSubmit={opslaan}>
        {b.soort === "nieuw" && (
          <>
            {kop(t("medewerkerToevoegen"))}
            <Paragraph className="ab-klein">{t("medewerkerToevoegenUitleg").replace("{gemeente}", gemeenteNaam)}</Paragraph>
            <FormField label={<FormLabel htmlFor="n-email">{t("email")}</FormLabel>}>
              <Textbox id="n-email" type="email" required maxLength={254} autoComplete="off" value={b.email} onChange={(e) => zetBewerk({ ...b, email: e.target.value })} />
            </FormField>
            <div className="ab-velden-twee">
              <FormField label={<FormLabel htmlFor="n-voornaam">{t("voornaam")}</FormLabel>}>
                <Textbox id="n-voornaam" required maxLength={100} autoComplete="off" value={b.voornaam} onChange={(e) => zetBewerk({ ...b, voornaam: e.target.value })} />
              </FormField>
              <FormField label={<FormLabel htmlFor="n-achternaam">{t("achternaam")}</FormLabel>}>
                <Textbox id="n-achternaam" required maxLength={100} autoComplete="off" value={b.achternaam} onChange={(e) => zetBewerk({ ...b, achternaam: e.target.value })} />
              </FormField>
            </div>
            {niveauKeuze("n-niveau", b.niveau, (niveau) => zetBewerk({ ...b, niveau }))}
            {reden(t("medewerkerRedenUitleg"))}
            {knoppen(!!b.email.trim() && !!b.voornaam.trim() && !!b.achternaam.trim())}
          </>
        )}
        {b.soort === "niveau" && (
          <>
            {kop(t("niveauWijzigen"), b.m)}
            {niveauKeuze("m-niveau", b.niveau, (niveau) => zetBewerk({ ...b, niveau }))}
            {reden(t("niveauRedenUitleg"))}
            <Paragraph className="ab-klein">{t("niveauUitlogUitleg")}</Paragraph>
            {knoppen(b.niveau !== b.m.niveau)}
          </>
        )}
        {b.soort === "actief" && (
          <>
            {kop(b.m.actief ? t("uitschakelen") : t("inschakelen"), b.m)}
            <Paragraph className="ab-klein">{b.m.actief ? t("uitschakelenUitleg") : t("inschakelenUitleg")}</Paragraph>
            <FormField label={<FormLabel htmlFor="m-ingang">{t("ingang")}</FormLabel>}>
              <Textbox id="m-ingang" type="datetime-local" value={b.ingang} onChange={(e) => zetBewerk({ ...b, ingang: e.target.value })} />
            </FormField>
            {reden()}
            {knoppen()}
          </>
        )}
        {b.soort === "herstel" && (
          <>
            {kop(b.m.wachtOpInstellen ? t("uitnodigingOpnieuw") : t("herstelmail"), b.m)}
            <Paragraph className="ab-klein">{t("herstelmailUitleg")}</Paragraph>
            <fieldset className="ab-vinkjes">
              <legend>{t("herstelWat")}</legend>
              <label><Checkbox checked={b.wachtwoord} onChange={(e) => zetBewerk({ ...b, wachtwoord: e.target.checked })} /> <span>{t("herstelWachtwoord")}</span></label>
              <label><Checkbox checked={b.authenticator} onChange={(e) => zetBewerk({ ...b, authenticator: e.target.checked })} /> <span>{t("herstelAuthenticator")}</span></label>
            </fieldset>
            {reden()}
            {knoppen(b.wachtwoord || b.authenticator)}
          </>
        )}
        {b.soort === "annuleer" && (
          <>
            {kop(t("geplandAnnuleren"), b.m)}
            <Paragraph className="ab-klein">{(b.g.actief ? t("geplandAan") : t("geplandUit")).replace("{wanneer}", tijd(b.g.ingang))} · {b.g.reden}</Paragraph>
            {reden()}
            {knoppen()}
          </>
        )}
      </form>
    );
  };

  const kan = !!data?.magWijzigen;
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
      {formulier()}

      <div className="ab-zoekbalk">
        <form className="ab-zoekbalk-veld" onSubmit={(e) => { e.preventDefault(); void laad(); }} role="search">
          <FormField label={<FormLabel htmlFor="m-zoek">{t("zoeken")}</FormLabel>}>
            <Textbox id="m-zoek" type="search" maxLength={100} value={zoek} onChange={(e) => zetZoek(e.target.value)} />
          </FormField>
          <SecondaryActionButton type="submit">{t("zoekKnop")}</SecondaryActionButton>
        </form>
        {kan && data?.keycloak.aan && (
          <PrimaryActionButton type="button" onClick={() => open({ soort: "nieuw", email: "", voornaam: "", achternaam: "", niveau: 1, reden: "" })}>
            {t("medewerkerToevoegen")}
          </PrimaryActionButton>
        )}
      </div>

      <div className="ab-kaart ab-tabel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("naam")}</TableHeaderCell>
              <TableHeaderCell>{t("status")}</TableHeaderCell>
              <TableHeaderCell>{t("rollen")}</TableHeaderCell>
              <TableHeaderCell>{t("niveau")}</TableHeaderCell>
              {kan && <TableHeaderCell><span className="ab-klein">{t("acties")}</span></TableHeaderCell>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.medewerkers.map((x) => (
              <TableRow key={x.id}>
                <TableCell>
                  {x.naam}
                  <div className="ab-klein">{wie(x)}</div>
                </TableCell>
                <TableCell>
                  <span className="ab-statussen">
                    {x.actief ? <StatusBadge status="safe">{t("actief")}</StatusBadge> : <StatusBadge status="danger">{t("uitgeschakeld")}</StatusBadge>}
                    {x.actief && x.wachtOpInstellen && <StatusBadge status="warning">{t("nogNietIngesteld")}</StatusBadge>}
                    {x.portaal && <StatusBadge status="neutral">{t("beheertPortaal")}</StatusBadge>}
                  </span>
                  {x.gepland.map((g) => (
                    <div key={g.id} className="ab-klein ab-gepland">
                      {(g.actief ? t("geplandAan") : t("geplandUit")).replace("{wanneer}", tijd(g.ingang))}
                      {g.fout && <span className="ab-waarschuwing"> · {t("geplandFout")}</span>}
                      {kan && !x.zelf && <> · <button type="button" className="ab-linkknop" onClick={() => open({ soort: "annuleer", m: x, g, reden: "" })}>{t("annuleren")}</button></>}
                    </div>
                  ))}
                </TableCell>
                <TableCell className="ab-klein">{x.rollen.length ? x.rollen.join(", ") : "—"}</TableCell>
                <TableCell><span className="ab-pil" title={niveauTekst(x.niveau)}>PPL {x.niveau}</span></TableCell>
                {kan && (
                  <TableCell>
                    {x.zelf ? (
                      <span className="ab-klein">{t("eigenNiveau")}</span>
                    ) : (
                      <span className="ab-acties">
                        <SecondaryActionButton onClick={() => open({ soort: "niveau", m: x, niveau: x.niveau, reden: "" })}>{t("niveau")}</SecondaryActionButton>
                        {x.actief && x.email && (
                          <SecondaryActionButton onClick={() => open({ soort: "herstel", m: x, wachtwoord: x.wachtOpInstellen, authenticator: true, reden: "" })}>{x.wachtOpInstellen ? t("uitnodigingOpnieuw") : t("herstelmailKort")}</SecondaryActionButton>
                        )}
                        <SecondaryActionButton onClick={() => open({ soort: "actief", m: x, ingang: "", reden: "" })}>{x.actief ? t("uitschakelen") : t("inschakelen")}</SecondaryActionButton>
                      </span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {data && data.keycloak.aan && !data.medewerkers.length && (
              <TableRow><TableCell colSpan={5}>{t("geenMedewerkers")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {data?.meer && <Paragraph className="ab-klein">{t("medewerkersMeer")}</Paragraph>}
    </>
  );
}
