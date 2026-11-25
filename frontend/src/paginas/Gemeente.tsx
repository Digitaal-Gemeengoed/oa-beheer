import { useState } from "react";
import { Checkbox, Select, SelectOption } from "@utrecht/component-library-react";
import { api, type Gemeenten, type Ik } from "../api";
import { t } from "../i18n";
import { useLaden } from "./gedeeld";
import { L } from "../App";

/**
 * In de kop: de gemeente die je beheert. Wie er meer mag beheren (GR), kiest
 * hier; de keuze geldt voor de sessie en voor alle pagina's.
 */
export function GemeenteKiezer({ ik }: { ik: Ik }) {
  const g = useLaden(() => api<Gemeenten>("GET", "/api/gemeenten"));
  const [bezig, zetBezig] = useState(false);
  if (!ik.gemeente) return null;
  if (ik.gemeenten <= 1 || !g.data) {
    // Eén gemeente: een label. Mag je gemeenten beheren, dan leidt het naar de pagina
    // Gemeenten: daar voeg je er een toe, waarna hier een keuzelijst staat.
    if (ik.grBreed && ik.rechten.includes("gemeenten.manage"))
      return <span title={t("gemeenteToevoegenOmTeWisselen")}><L naar="/gemeenten" className="ab-pil ab-pil-link">{ik.gemeente.naam}</L></span>;
    return <span className="ab-pil" title={t("gemeente")}>{ik.gemeente.naam}</span>;
  }
  return (
    <span className="ab-gemeente">
      <label className="ab-verborgen" htmlFor="kop-gemeente">{t("gemeenteKiezen")}</label>
      <Select
        id="kop-gemeente"
        value={ik.gemeente.id}
        disabled={bezig}
        onChange={async (e) => {
          zetBezig(true);
          await api("PUT", "/api/gemeente", { id: e.target.value }).catch(() => undefined);
          location.reload();
        }}
      >
        {g.data.keuze.map((x) => <SelectOption key={x.id} value={x.id}>{x.naam}</SelectOption>)}
      </Select>
    </span>
  );
}

/** Welke gemeenten een account beheert: een lijst, of null = alle (alleen als je zelf GR-breed beheert). */
export function BereikKeuze({ waarde, zet }: { waarde: string[] | null; zet: (w: string[] | null) => void }) {
  const g = useLaden(() => api<Gemeenten>("GET", "/api/gemeenten"));
  if (!g.data || g.data.inrichting.length <= 1) return null;
  const { keuze, grBreed } = g.data;
  return (
    <fieldset className="ab-vinkjes">
      <legend>{t("gemeenten")}</legend>
      <p className="ab-klein">{t("gemeentenUitleg")}</p>
      <div className="ab-rechtenraster">
        {grBreed && (
          <label>
            <Checkbox checked={waarde === null} onChange={(e) => zet(e.target.checked ? null : keuze.slice(0, 1).map((x) => x.id))} />
            <span>{t("alleGemeenten")}</span>
          </label>
        )}
        {keuze.map((x) => (
          <label key={x.id}>
            <Checkbox
              checked={waarde === null || waarde.includes(x.id)}
              disabled={waarde === null}
              onChange={(e) => {
                const nu = waarde ?? [];
                const nieuw = e.target.checked ? [...nu, x.id] : nu.filter((y) => y !== x.id);
                if (nieuw.length) zet(nieuw);
              }}
            />
            <span>{x.naam}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "Alle gemeenten" of de namen, voor in een overzicht. */
export function bereikTekst(bereik: string[] | null | undefined, namen: { id: string; naam: string }[]): string {
  if (bereik == null) return t("alleGemeenten");
  return bereik.map((id) => namen.find((n) => n.id === id)?.naam ?? id).join(", ");
}
