import { useState, type FormEvent } from "react";
import {
  FormField, FormLabel, Heading1, Heading2, Paragraph, PrimaryActionButton, SecondaryActionButton,
  Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Textbox,
} from "@utrecht/component-library-react";
import { api } from "../api";
import { t, tijd } from "../i18n";
import { foutTekst, MeldingVak, RedenVeld, useLaden, type Melding } from "./gedeeld";

interface Rij {
  id: string;
  naam: string;
  domeinen: string[];
  keycloak: "ok" | "afwijkend" | "ontbreekt" | null;
  gebruikers: Record<string, number | null>;
  aangemaakt?: string;
  door: string | null;
}
interface Overzicht {
  gemeenten: Rij[];
  keycloak: { aan: boolean; fout?: string };
}

/** "Gemeente Bloemendaal" → "bloemendaal"; "Gemeente Den Haag" → "den-haag". */
function codeUit(naam: string): string {
  return naam
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^gemeente\s+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const domeinenUit = (tekst: string) => tekst.split(/[\s,;]+/).map((d) => d.trim()).filter(Boolean);

/**
 * Gemeenten van de inrichting: toevoegen en wijzigen, met de e-maildomeinen
 * die bepalen wie bij welke gemeente hoort. Alleen GR-breed, met het recht
 * gemeenten.manage.
 */
export function Gemeenten() {
  const lijst = useLaden(() => api<Overzicht>("GET", "/api/gemeenten/beheer"));
  const [m, zetM] = useState<Melding>(null);
  const [nieuw, zetNieuw] = useState({ naam: "", id: "", domeinen: "", reden: "" });
  const [idZelf, zetIdZelf] = useState(false);
  const [bewerk, zetBewerk] = useState<{ id: string; naam: string; domeinen: string; reden: string } | null>(null);

  const doe = async (f: () => Promise<unknown>, tekst: string, daarna: () => void) => {
    try {
      await f();
      zetM({ soort: "ok", tekst });
      daarna();
      lijst.herlaad();
    } catch (x) {
      zetM({ soort: "fout", tekst: foutTekst(x) });
    }
    scrollTo({ top: 0, behavior: "smooth" });
  };

  const voegToe = (e: FormEvent) => {
    e.preventDefault();
    void doe(
      () => api("POST", "/api/gemeenten", { id: nieuw.id, naam: nieuw.naam, domeinen: domeinenUit(nieuw.domeinen), reden: nieuw.reden }),
      t("gemeenteToegevoegd"),
      () => { zetNieuw({ naam: "", id: "", domeinen: "", reden: "" }); zetIdZelf(false); },
    );
  };

  return (
    <>
      <Heading1>{t("gemeenten")}</Heading1>
      <Paragraph className="ab-klein">{t("gemeentenPaginaUitleg")}</Paragraph>
      <MeldingVak m={m ?? (lijst.fout ? { soort: "fout", tekst: lijst.fout } : null)} />
      {lijst.data && !lijst.data.keycloak.aan && <Paragraph className="ab-waarschuwing">{t("gemeentenZonderKeycloak")}</Paragraph>}
      {lijst.data?.keycloak.fout && <Paragraph className="ab-waarschuwing">{lijst.data.keycloak.fout}</Paragraph>}
      <div className="ab-kaart ab-tabel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("naam")}</TableHeaderCell>
              <TableHeaderCell>{t("code")}</TableHeaderCell>
              <TableHeaderCell>{t("domeinen")}</TableHeaderCell>
              <TableHeaderCell>{t("inKeycloak")}</TableHeaderCell>
              <TableHeaderCell><span className="ab-klein">{t("acties")}</span></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lijst.data?.gemeenten.map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  {g.naam}
                  {g.aangemaakt && <span className="ab-klein"> · {tijd(g.aangemaakt)}{g.door ? ` · ${g.door}` : ""}</span>}
                </TableCell>
                <TableCell><code>{g.id}</code></TableCell>
                <TableCell>
                  {g.domeinen.length ? g.domeinen.map((d) => (
                    <div key={d}>
                      {d}
                      {g.gebruikers[d] != null && <span className="ab-klein"> · {g.gebruikers[d]} {t("gebruikers")}</span>}
                    </div>
                  )) : "—"}
                </TableCell>
                <TableCell>{g.keycloak === null ? "—" : t(g.keycloak === "ok" ? "keycloakOk" : g.keycloak === "afwijkend" ? "keycloakAfwijkend" : "keycloakOntbreekt")}</TableCell>
                <TableCell>
                  <SecondaryActionButton onClick={() => zetBewerk({ id: g.id, naam: g.naam, domeinen: g.domeinen.join(", "), reden: "" })}>{t("wijzigen")}</SecondaryActionButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {bewerk && (
        <form
          className="ab-kaart ab-blok ab-formulier"
          onSubmit={(e) => {
            e.preventDefault();
            void doe(() => api("PUT", `/api/gemeenten/${bewerk.id}`, { naam: bewerk.naam, domeinen: domeinenUit(bewerk.domeinen), reden: bewerk.reden }), t("opgeslagen"), () => zetBewerk(null));
          }}
        >
          <Heading2>{t("gemeenteWijzigen")}: <code>{bewerk.id}</code></Heading2>
          <FormField label={<FormLabel htmlFor="w-naam">{t("naam")}</FormLabel>}>
            <Textbox id="w-naam" required minLength={3} maxLength={100} value={bewerk.naam} onChange={(e) => zetBewerk({ ...bewerk, naam: e.target.value })} />
          </FormField>
          <FormField label={<FormLabel htmlFor="w-domeinen">{t("domeinen")}</FormLabel>} description={t("domeinenUitleg")}>
            <Textbox id="w-domeinen" required value={bewerk.domeinen} onChange={(e) => zetBewerk({ ...bewerk, domeinen: e.target.value })} />
          </FormField>
          <Paragraph className="ab-klein">{t("domeinWeghalenUitleg")}</Paragraph>
          <RedenVeld id="w-reden" waarde={bewerk.reden} zet={(reden) => zetBewerk({ ...bewerk, reden })} />
          <div className="ab-knoppen">
            <PrimaryActionButton type="submit">{t("opslaan")}</PrimaryActionButton>
            <SecondaryActionButton type="button" onClick={() => zetBewerk(null)}>{t("annuleren")}</SecondaryActionButton>
          </div>
        </form>
      )}

      <form className="ab-kaart ab-blok ab-formulier" onSubmit={voegToe}>
        <Heading2>{t("gemeenteToevoegen")}</Heading2>
        <div className="ab-velden-twee">
          <FormField label={<FormLabel htmlFor="n-naam">{t("naam")}</FormLabel>} description={t("gemeenteNaamUitleg")}>
            <Textbox id="n-naam" required minLength={3} maxLength={100} placeholder="Gemeente Bloemendaal" value={nieuw.naam}
              onChange={(e) => zetNieuw({ ...nieuw, naam: e.target.value, id: idZelf ? nieuw.id : codeUit(e.target.value) })} />
          </FormField>
          <FormField label={<FormLabel htmlFor="n-id">{t("code")}</FormLabel>} description={t("gemeenteCodeUitleg")}>
            <Textbox id="n-id" required pattern="[a-z0-9-]{2,40}" maxLength={40} value={nieuw.id}
              onChange={(e) => { zetIdZelf(true); zetNieuw({ ...nieuw, id: e.target.value.toLowerCase() }); }} />
          </FormField>
        </div>
        <FormField label={<FormLabel htmlFor="n-domeinen">{t("domeinen")}</FormLabel>} description={t("domeinenUitleg")}>
          <Textbox id="n-domeinen" required placeholder="bloemendaal.nl" value={nieuw.domeinen} onChange={(e) => zetNieuw({ ...nieuw, domeinen: e.target.value })} />
        </FormField>
        <RedenVeld id="n-reden" waarde={nieuw.reden} zet={(reden) => zetNieuw({ ...nieuw, reden })} />
        <div><PrimaryActionButton type="submit">{t("gemeenteToevoegen")}</PrimaryActionButton></div>
      </form>
    </>
  );
}
