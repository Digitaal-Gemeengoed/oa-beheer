import { useState, type FormEvent } from "react";
import {
  Checkbox, FormField, FormLabel, Heading1, Heading2, PrimaryActionButton, SecondaryActionButton, Select, SelectOption,
  StatusBadge, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Textarea, Textbox,
} from "@utrecht/component-library-react";
import { api, type Ik } from "../api";
import { t } from "../i18n";
import { foutTekst, MeldingVak, RedenVeld, useLaden, type Melding } from "./gedeeld";

const RECHTEN = ["accounts.view", "accounts.manage", "groups.view", "groups.manage", "audit.view", "settings.view", "settings.manage", "metadata.view", "metadata.manage", "anonimiseren.view", "classificatie.view", "classificatie.manage", "bewaartermijn.afwijken"];

/** Leesbare naam van een recht: onderdeel en wat je mag. */
function rechtNaam(r: string): string {
  const [onderdeel, wat] = r.split(".");
  let o = onderdeel;
  try { o = t(`recht_${onderdeel}` as never); } catch { /* onbekend onderdeel: de technische naam */ }
  return `${o}: ${t(wat === "view" ? "rechtBekijken" : wat === "manage" ? "rechtBeheren" : "rechtAfwijken")}`;
}

function Rechten({ g }: { g: Groep }) {
  if (g.superadmin) return <span className="ab-recht alles">{t("alleRechten")}</span>;
  if (!g.rechten.length) return <>—</>;
  return (
    <span className="ab-rechten">
      {RECHTEN.filter((r) => g.rechten.includes(r)).map((r) => (
        <span key={r} className={`ab-recht${r.endsWith(".view") ? "" : " beheren"}`} title={r}>{rechtNaam(r)}</span>
      ))}
    </span>
  );
}
interface Groep { id: string; naam: string; omschrijving: string; rechten: string[]; niveau: number; superadmin: boolean; leden: number }
type Invoer = Omit<Groep, "id" | "leden"> & { reden: string };

export function Groepen({ ik }: { ik: Ik }) {
  const lijst = useLaden(() => api<Groep[]>("GET", "/api/groepen"));
  const [bewerk, zetBewerk] = useState<Groep | "nieuw" | null>(null);
  const [m, zetM] = useState<Melding>(null);
  const kan = ik.rechten.includes("groups.manage");
  return (
    <>
      <Heading1>{t("groepen")}</Heading1>
      <MeldingVak m={m ?? (lijst.fout ? { soort: "fout", tekst: lijst.fout } : null)} />
      {kan && !bewerk && <SecondaryActionButton onClick={() => zetBewerk("nieuw")}>{t("groepNieuw")}</SecondaryActionButton>}
      {bewerk && (
        <GroepFormulier
          groep={bewerk === "nieuw" ? null : bewerk}
          ik={ik}
          klaar={(melding) => { zetBewerk(null); zetM(melding); lijst.herlaad(); }}
        />
      )}
      <div className="ab-tabel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("naam")}</TableHeaderCell>
              <TableHeaderCell>{t("niveau")}</TableHeaderCell>
              <TableHeaderCell>{t("rechten")}</TableHeaderCell>
              <TableHeaderCell>{t("leden")}</TableHeaderCell>
              {kan && <TableHeaderCell><span className="ab-klein">{t("acties")}</span></TableHeaderCell>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lijst.data?.map((g) => (
              <TableRow key={g.id}>
                <TableCell>{g.naam} {g.superadmin && <StatusBadge status="danger">{t("superadmin")}</StatusBadge>}<div className="ab-klein">{g.omschrijving}</div></TableCell>
                <TableCell>{g.niveau}</TableCell>
                <TableCell><Rechten g={g} /></TableCell>
                <TableCell>{g.leden}</TableCell>
                {kan && <TableCell><SecondaryActionButton onClick={() => zetBewerk(g)} aria-label={`${t("bewerken")}: ${g.naam}`}>{t("bewerken")}</SecondaryActionButton></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function GroepFormulier({ groep, ik, klaar }: { groep: Groep | null; ik: Ik; klaar: (m: Melding) => void }) {
  const [v, zet] = useState<Invoer>({ naam: groep?.naam ?? "", omschrijving: groep?.omschrijving ?? "", rechten: groep?.rechten ?? [], niveau: groep?.niveau ?? 1, superadmin: groep?.superadmin ?? false, reden: "" });
  const [m, zetM] = useState<Melding>(null);
  const doe = async (f: () => Promise<unknown>) => {
    try {
      await f();
      klaar({ soort: "ok", tekst: t("opgeslagen") });
    } catch (x) {
      zetM({ soort: "fout", tekst: foutTekst(x) });
    }
  };
  const verstuur = (e: FormEvent) => {
    e.preventDefault();
    doe(() => (groep ? api("PUT", `/api/groepen/${groep.id}`, v) : api("POST", "/api/groepen", v)));
  };
  return (
    <form className="ab-formulier" onSubmit={verstuur}>
      <Heading2>{groep ? groep.naam : t("groepNieuw")}</Heading2>
      <MeldingVak m={m} />
      <FormField label={<FormLabel htmlFor="g-naam">{t("naam")}</FormLabel>}>
        <Textbox id="g-naam" required maxLength={100} value={v.naam} onChange={(e) => zet({ ...v, naam: e.target.value })} />
      </FormField>
      <FormField label={<FormLabel htmlFor="g-oms">{t("omschrijving")}</FormLabel>}>
        <Textarea id="g-oms" rows={2} maxLength={1000} value={v.omschrijving} onChange={(e) => zet({ ...v, omschrijving: e.target.value })} />
      </FormField>
      <FormField label={<FormLabel htmlFor="g-niveau">{t("niveau")}</FormLabel>}>
        <Select id="g-niveau" value={String(v.niveau)} onChange={(e) => zet({ ...v, niveau: Number(e.target.value) })}>
          {[1, 2, 3, 4].map((n) => <SelectOption key={n} value={String(n)}>{n}</SelectOption>)}
        </Select>
      </FormField>
      <fieldset className="ab-vinkjes">
        <legend>{t("rechten")}</legend>
        {ik.superadmin && (
          <label>
            <Checkbox checked={v.superadmin} onChange={(e) => zet({ ...v, superadmin: e.target.checked })} />
            <span><b>{t("superadmin")}</b> <span className="ab-klein">— {t("superadminUitleg")}</span></span>
          </label>
        )}
        <div className="ab-rechtenraster">
          {RECHTEN.map((r) => (
            <label key={r} title={r}>
              <Checkbox disabled={v.superadmin} checked={v.superadmin || v.rechten.includes(r)} onChange={(e) => zet({ ...v, rechten: e.target.checked ? [...v.rechten, r] : v.rechten.filter((x) => x !== r) })} />
              <span>{rechtNaam(r)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <RedenVeld id="g-reden" waarde={v.reden} zet={(reden) => zet({ ...v, reden })} />
      <div className="ab-knoppen">
        <PrimaryActionButton type="submit">{t("opslaan")}</PrimaryActionButton>
        <SecondaryActionButton type="button" onClick={() => klaar(null)}>{t("annuleren")}</SecondaryActionButton>
        {groep && <SecondaryActionButton type="button" onClick={() => doe(() => api("DELETE", `/api/groepen/${groep.id}`, { reden: v.reden }))}>{t("verwijderen")}</SecondaryActionButton>}
      </div>
    </form>
  );
}
