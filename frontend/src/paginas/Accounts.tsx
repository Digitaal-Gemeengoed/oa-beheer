import { useMemo, useState, type FormEvent } from "react";
import {
  Checkbox, FormField, FormLabel, Heading1, Heading2, Paragraph, PrimaryActionButton, SecondaryActionButton, Select, SelectOption,
  StatusBadge, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Textbox,
} from "@utrecht/component-library-react";
import { api, type Ik } from "../api";
import { t, tijd } from "../i18n";
import { ga, L } from "../App";
import { Avatar, foutTekst, MeldingVak, RedenVeld, relatief, useLaden, type Melding } from "./gedeeld";

interface AccountRij { id: string; email: string; naam: string; status: string; hoofdaccount: boolean; niveau: number; groepen: string[]; laatst_actief: string | null; gepland: number; beheerbaar: boolean; aangemaakt: string }
interface GroepRij { id: string; naam: string; niveau: number; toewijsbaar: boolean }

const STATUSKLEUR: Record<string, "safe" | "warning" | "danger"> = { actief: "safe", geblokkeerd: "danger", gedeactiveerd: "warning" };

function Status({ s }: { s: string }) {
  return <StatusBadge status={STATUSKLEUR[s]}>{t(s as "actief")}</StatusBadge>;
}

/** De lijst: zoeken en filteren gebeurt in de browser; de lijst is klein (tientallen tot honderden). */
export function Accounts({ ik }: { ik: Ik }) {
  const lijst = useLaden(() => api<AccountRij[]>("GET", "/api/accounts"));
  const q = new URLSearchParams(location.search);
  const [zoek, zetZoek] = useState("");
  const [status, zetStatus] = useState(q.get("status") ?? "");
  const [groep, zetGroep] = useState(q.get("groep") ?? "");
  const nooit = q.get("nooit") === "1";
  const melding = q.get("nieuw") ? { soort: "ok" as const, tekst: t("accountAangemaakt") } : null;

  const rijen = lijst.data ?? [];
  const groepen = useMemo(() => [...new Set(rijen.flatMap((a) => a.groepen))].sort(), [rijen]);
  const tel = (s: string) => rijen.filter((a) => !a.hoofdaccount && (s === "dicht" ? a.status !== "actief" : a.status === s)).length;
  const zichtbaar = rijen.filter((a) => {
    const z = zoek.trim().toLowerCase();
    if (z && !a.naam.toLowerCase().includes(z) && !a.email.includes(z)) return false;
    if (status === "dicht" ? a.status === "actief" : status && a.status !== status) return false;
    if (groep === "geen" ? a.groepen.length > 0 || a.hoofdaccount : groep && !a.groepen.includes(groep)) return false;
    if (nooit && (a.laatst_actief || a.hoofdaccount)) return false;
    return true;
  });

  const chips: [string, string, number][] = [
    ["", t("alle"), rijen.filter((a) => !a.hoofdaccount).length],
    ["actief", t("actief"), tel("actief")],
    ["geblokkeerd", t("geblokkeerd"), tel("geblokkeerd")],
    ["gedeactiveerd", t("gedeactiveerd"), tel("gedeactiveerd")],
  ];

  return (
    <>
      <div className="ab-paginakop">
        <Heading1>{t("accounts")}</Heading1>
        {ik.rechten.includes("accounts.manage") && <PrimaryActionButton onClick={() => ga("/accounts/nieuw")}>+ {t("accountNieuw")}</PrimaryActionButton>}
      </div>
      <MeldingVak m={melding ?? (lijst.fout ? { soort: "fout", tekst: lijst.fout } : null)} />
      <div className="ab-werkbalk">
        <div className="ab-zoek">
          <label className="ab-verborgen" htmlFor="a-zoek">{t("zoeken")}</label>
          <Textbox id="a-zoek" type="search" placeholder={t("zoeken")} value={zoek} onChange={(e) => zetZoek(e.target.value)} />
        </div>
        <div className="ab-chips" role="group" aria-label={t("status")}>
          {chips.map(([w, label, n]) => (
            <button key={w} type="button" className={`ab-chip${status === w ? " aan" : ""}`} aria-pressed={status === w} onClick={() => zetStatus(w)}>
              {label} <span className="ab-chip-n">{n}</span>
            </button>
          ))}
        </div>
        <div>
          <label className="ab-verborgen" htmlFor="a-groep">{t("groepen")}</label>
          <Select id="a-groep" value={groep} onChange={(e) => zetGroep(e.target.value)}>
            <SelectOption value="">{t("alleGroepen")}</SelectOption>
            {groepen.map((g) => <SelectOption key={g} value={g}>{g}</SelectOption>)}
            <SelectOption value="geen">{t("geenGroep")}</SelectOption>
          </Select>
        </div>
      </div>
      <div className="ab-tabel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("naam")}</TableHeaderCell>
              <TableHeaderCell>{t("status")}</TableHeaderCell>
              <TableHeaderCell>{t("niveau")}</TableHeaderCell>
              <TableHeaderCell>{t("groepen")}</TableHeaderCell>
              <TableHeaderCell>{t("laatstActief")}</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zichtbaar.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <span className="ab-persoon">
                    <Avatar naam={a.naam} />
                    <span>
                      {a.hoofdaccount ? <>{a.naam} <StatusBadge status="neutral">{t("hoofdaccount")}</StatusBadge></> : <L naar={`/accounts/${a.id}`}>{a.naam}</L>}
                      <span className="ab-klein ab-blok-regel">{a.email}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell><Status s={a.status} />{a.gepland > 0 && <> <StatusBadge status="warning">{t("gepland")}</StatusBadge></>}</TableCell>
                <TableCell>{a.niveau || "—"}</TableCell>
                <TableCell>{a.groepen.length ? <span className="ab-rechten">{a.groepen.map((g) => <span key={g} className="ab-recht">{g}</span>)}</span> : "—"}</TableCell>
                <TableCell><span title={tijd(a.laatst_actief)}>{relatief(a.laatst_actief)}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {lijst.data && !zichtbaar.length && <Paragraph className="ab-leeg">{t("geenResultaten")}</Paragraph>}
      </div>
      {lijst.data && <Paragraph className="ab-klein">{zichtbaar.length} {t("aantalVan")} {rijen.length}</Paragraph>}
    </>
  );
}

function GroepKeuze({ geselecteerd, zet }: { geselecteerd: string[]; zet: (g: string[]) => void }) {
  const groepen = useLaden(() => api<GroepRij[]>("GET", "/api/groepen"));
  return (
    <fieldset className="ab-vinkjes">
      <legend>{t("groepen")}</legend>
      <div className="ab-rechtenraster">
        {groepen.data?.map((g) => (
          <label key={g.id}>
            <Checkbox
              checked={geselecteerd.includes(g.id)}
              disabled={!g.toewijsbaar}
              onChange={(e) => zet(e.target.checked ? [...geselecteerd, g.id] : geselecteerd.filter((x) => x !== g.id))}
            />
            <span>{g.naam} <span className="ab-klein">· {t("niveau")} {g.niveau}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Een account toevoegen: een eigen pagina, alleen voor wie accounts beheert. */
export function NieuwAccount() {
  const [v, zet] = useState({ email: "", naam: "", taal: "nl" as "nl" | "en", groepen: [] as string[], reden: "" });
  const [m, zetM] = useState<Melding>(null);
  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const { id } = await api<{ id: string }>("POST", "/api/accounts", v);
      ga(`/accounts/${id}?nieuw=1`);
    } catch (x) {
      zetM({ soort: "fout", tekst: foutTekst(x) });
    }
  };
  return (
    <>
      <Paragraph><L naar="/accounts">← {t("accounts")}</L></Paragraph>
      <Heading1>{t("accountNieuw")}</Heading1>
      <form className="ab-formulier" onSubmit={verstuur}>
        <Paragraph className="ab-klein">{t("accountUitleg")}</Paragraph>
        <MeldingVak m={m} />
        <div className="ab-velden-twee">
          <FormField label={<FormLabel htmlFor="n-naam">{t("naam")}</FormLabel>}>
            <Textbox id="n-naam" required maxLength={200} autoComplete="off" value={v.naam} onChange={(e) => zet({ ...v, naam: e.target.value })} />
          </FormField>
          <FormField label={<FormLabel htmlFor="n-email">{t("email")}</FormLabel>}>
            <Textbox id="n-email" type="email" required maxLength={254} autoComplete="off" value={v.email} onChange={(e) => zet({ ...v, email: e.target.value })} />
          </FormField>
        </div>
        <FormField label={<FormLabel htmlFor="n-taal">{t("taal")}</FormLabel>}>
          <Select id="n-taal" value={v.taal} onChange={(e) => zet({ ...v, taal: e.target.value as "nl" | "en" })}>
            <SelectOption value="nl">Nederlands</SelectOption>
            <SelectOption value="en">English</SelectOption>
          </Select>
        </FormField>
        <GroepKeuze geselecteerd={v.groepen} zet={(groepen) => zet({ ...v, groepen })} />
        <RedenVeld id="n-reden" waarde={v.reden} zet={(reden) => zet({ ...v, reden })} />
        <div className="ab-knoppen">
          <PrimaryActionButton type="submit">{t("accountNieuw")}</PrimaryActionButton>
          <SecondaryActionButton type="button" onClick={() => ga("/accounts")}>{t("annuleren")}</SecondaryActionButton>
        </div>
      </form>
    </>
  );
}

interface Gepland { id: string; status: string; reden: string; ingang: string; aangemaakt: string; door: string; account: string; naam: string; email: string; beheerbaar: boolean }

/** Een kleine bevestiging met reden, in de regel zelf. */
function MetReden({ knop, bevestig }: { knop: string; bevestig: (reden: string) => Promise<void> }) {
  const [open, zetOpen] = useState(false);
  const [reden, zetReden] = useState("");
  const [fout, zetFout] = useState<string | null>(null);
  if (!open) return <SecondaryActionButton onClick={() => zetOpen(true)}>{knop}</SecondaryActionButton>;
  return (
    <form className="ab-inline" onSubmit={async (e) => { e.preventDefault(); try { await bevestig(reden); } catch (x) { zetFout(foutTekst(x)); } }}>
      <label className="ab-verborgen" htmlFor="r-inline">{t("redenVraag")}</label>
      <Textbox id="r-inline" required minLength={5} maxLength={1000} placeholder={t("redenVraag")} value={reden} onChange={(e) => zetReden(e.target.value)} autoFocus />
      <PrimaryActionButton type="submit">{t("bevestigen")}</PrimaryActionButton>
      <SecondaryActionButton type="button" onClick={() => { zetOpen(false); zetFout(null); }}>{t("annuleren")}</SecondaryActionButton>
      {fout && <span className="ab-fouttekst">{fout}</span>}
    </form>
  );
}

export function GeplandeWijzigingen() {
  const lijst = useLaden(() => api<Gepland[]>("GET", "/api/accounts/gepland"));
  const [m, zetM] = useState<Melding>(null);
  return (
    <>
      <Heading1>{t("geplandeWijzigingen")}</Heading1>
      <Paragraph className="ab-lead">{t("geplandUitleg")}</Paragraph>
      <MeldingVak m={m ?? (lijst.fout ? { soort: "fout", tekst: lijst.fout } : null)} />
      <div className="ab-tabel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("ingangKort")}</TableHeaderCell>
              <TableHeaderCell>{t("naam")}</TableHeaderCell>
              <TableHeaderCell>{t("status")}</TableHeaderCell>
              <TableHeaderCell>{t("reden")}</TableHeaderCell>
              <TableHeaderCell>{t("door")}</TableHeaderCell>
              <TableHeaderCell><span className="ab-verborgen">{t("acties")}</span></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lijst.data?.map((w) => (
              <TableRow key={w.id}>
                <TableCell>{tijd(w.ingang)}</TableCell>
                <TableCell><L naar={`/accounts/${w.account}`}>{w.naam}</L><span className="ab-klein ab-blok-regel">{w.email}</span></TableCell>
                <TableCell><Status s={w.status} /></TableCell>
                <TableCell>{w.reden}</TableCell>
                <TableCell>{w.door}<span className="ab-klein ab-blok-regel">{tijd(w.aangemaakt)}</span></TableCell>
                <TableCell>
                  {w.beheerbaar && (
                    <MetReden
                      knop={t("annulerenWijziging")}
                      bevestig={async (reden) => {
                        await api("POST", `/api/accounts/gepland/${w.id}/annuleren`, { reden });
                        zetM({ soort: "ok", tekst: t("opgeslagen") });
                        lijst.herlaad();
                      }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {lijst.data && !lijst.data.length && <Paragraph className="ab-leeg">{t("geenGepland")}</Paragraph>}
      </div>
    </>
  );
}

interface Sessie { id: string; apparaat: string; ip: string; aangemaakt: string; laatst_actief: string; hard_einde: string; nood: boolean; account: string; naam: string; email: string; eigen: boolean; beheerbaar: boolean }

export function Sessies() {
  const lijst = useLaden(() => api<Sessie[]>("GET", "/api/sessies"));
  const [m, zetM] = useState<Melding>(null);
  return (
    <>
      <Heading1>{t("actieveSessies")}</Heading1>
      <Paragraph className="ab-lead">{t("sessiesUitleg")}</Paragraph>
      <MeldingVak m={m ?? (lijst.fout ? { soort: "fout", tekst: lijst.fout } : null)} />
      <div className="ab-tabel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("naam")}</TableHeaderCell>
              <TableHeaderCell>{t("apparaat")}</TableHeaderCell>
              <TableHeaderCell>IP</TableHeaderCell>
              <TableHeaderCell>{t("sinds")}</TableHeaderCell>
              <TableHeaderCell>{t("laatstActief")}</TableHeaderCell>
              <TableHeaderCell><span className="ab-verborgen">{t("acties")}</span></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lijst.data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <span className="ab-persoon">
                    <Avatar naam={s.naam} />
                    <span>
                      {s.eigen ? s.naam : <L naar={`/accounts/${s.account}`}>{s.naam}</L>}
                      {s.eigen && <> <StatusBadge status="neutral">{t("jij")}</StatusBadge></>}
                      {s.nood && <> <StatusBadge status="danger">{t("noodsessie")}</StatusBadge></>}
                      <span className="ab-klein ab-blok-regel">{s.email}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>{s.apparaat}</TableCell>
                <TableCell className="ab-mono">{s.ip}</TableCell>
                <TableCell>{tijd(s.aangemaakt)}</TableCell>
                <TableCell><span title={tijd(s.laatst_actief)}>{relatief(s.laatst_actief)}</span></TableCell>
                <TableCell>
                  {s.beheerbaar && (
                    <MetReden
                      knop={t("beeindigen")}
                      bevestig={async (reden) => {
                        await api("POST", `/api/sessies/${s.id}/beeindigen`, { reden });
                        zetM({ soort: "ok", tekst: t("opgeslagen") });
                        lijst.herlaad();
                      }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {lijst.data && !lijst.data.length && <Paragraph className="ab-leeg">{t("geenSessies")}</Paragraph>}
      </div>
    </>
  );
}

interface AccountDetailData {
  id: string; email: string; naam: string; status: string; hoofdaccount: boolean; niveau: number; taal?: "nl" | "en"; beheerbaar: boolean; laatst_actief: string | null;
  groepen: { id: string; naam: string; niveau: number }[];
  actieveSessies: number;
  wijzigingen: { id: string; status: string; reden: string; ingang: string; uitgevoerd: string | null; door: string; geannuleerd: string | null; reden_annulering: string | null; geannuleerd_door: string | null }[];
}

export function AccountDetail({ ik, id }: { ik: Ik; id: string }) {
  const a = useLaden(() => api<AccountDetailData>("GET", `/api/accounts/${id}`));
  const [m, zetM] = useState<Melding>(new URLSearchParams(location.search).get("nieuw") ? { soort: "ok", tekst: t("accountAangemaakt") } : null);
  const [status, zetStatus] = useState({ status: "geblokkeerd", ingang: "", reden: "" });
  const [groepen, zetGroepen] = useState<string[] | null>(null);
  const [groepReden, zetGroepReden] = useState("");
  const [gegevens, zetGegevens] = useState<{ naam: string; taal: "nl" | "en" } | null>(null);
  const [uitReden, zetUitReden] = useState("");
  const kan = ik.rechten.includes("accounts.manage") && a.data?.beheerbaar;

  const doe = async (f: () => Promise<unknown>, daarna?: () => void) => {
    try {
      await f();
      zetM({ soort: "ok", tekst: t("opgeslagen") });
      daarna?.();
      a.herlaad();
      scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) {
      zetM({ soort: "fout", tekst: foutTekst(x) });
      scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  if (!a.data) return <Paragraph>{a.fout ?? t("laden")}</Paragraph>;
  const d = a.data;
  const huidigeGroepen = groepen ?? d.groepen.map((g) => g.id);
  const gg = gegevens ?? { naam: d.naam, taal: d.taal ?? "nl" };

  return (
    <>
      <Paragraph><L naar="/accounts">← {t("accounts")}</L></Paragraph>
      <section className="ab-kaart ab-profielkop">
        <Avatar naam={d.naam} groot />
        <div className="ab-profielkop-tekst">
          <Heading1>{d.naam}</Heading1>
          <span className="ab-klein">{d.email}</span>
          <span className="ab-rechten">
            <Status s={d.status} />
            <span className="ab-recht">{t("niveau")} {d.niveau || "—"}</span>
            {d.groepen.map((g) => <span key={g.id} className="ab-recht beheren">{g.naam}</span>)}
          </span>
        </div>
        <dl className="ab-feiten ab-profielkop-feiten">
          <div><dt>{t("laatstActief")}</dt><dd title={tijd(d.laatst_actief)}>{relatief(d.laatst_actief)}</dd></div>
          <div><dt>{t("actieveSessies")}</dt><dd>{d.actieveSessies}</dd></div>
        </dl>
      </section>
      <MeldingVak m={m} />
      {!kan && <Paragraph className="ab-klein">{t("nietBeheerbaar")}</Paragraph>}
      {kan && (
        <div className="ab-twee">
          <div className="ab-kolom">
            <form className="ab-kaart ab-blok" onSubmit={(e) => { e.preventDefault(); doe(() => api("PUT", `/api/accounts/${id}/groepen`, { groepen: huidigeGroepen, reden: groepReden }), () => { zetGroepen(null); zetGroepReden(""); }); }}>
              <Heading2>{t("toegang")}</Heading2>
              <Paragraph className="ab-klein">{t("groepenUitleg")}</Paragraph>
              <GroepKeuze geselecteerd={huidigeGroepen} zet={zetGroepen} />
              <RedenVeld id="g-reden" waarde={groepReden} zet={zetGroepReden} />
              <div><PrimaryActionButton type="submit">{t("opslaan")}</PrimaryActionButton></div>
            </form>
            <form className="ab-kaart ab-blok" onSubmit={(e) => { e.preventDefault(); doe(() => api("PUT", `/api/accounts/${id}`, gg), () => zetGegevens(null)); }}>
              <Heading2>{t("gegevensWijzigen")}</Heading2>
              <div className="ab-velden-twee">
                <FormField label={<FormLabel htmlFor="d-naam">{t("naam")}</FormLabel>}>
                  <Textbox id="d-naam" required maxLength={200} value={gg.naam} onChange={(e) => zetGegevens({ ...gg, naam: e.target.value })} />
                </FormField>
                <FormField label={<FormLabel htmlFor="d-taal">{t("taal")}</FormLabel>}>
                  <Select id="d-taal" value={gg.taal} onChange={(e) => zetGegevens({ ...gg, taal: e.target.value as "nl" | "en" })}>
                    <SelectOption value="nl">Nederlands</SelectOption>
                    <SelectOption value="en">English</SelectOption>
                  </Select>
                </FormField>
              </div>
              <div><SecondaryActionButton type="submit">{t("opslaan")}</SecondaryActionButton></div>
            </form>
          </div>
          <div className="ab-kolom">
            <form className="ab-kaart ab-blok" onSubmit={(e) => { e.preventDefault(); doe(() => api("POST", `/api/accounts/${id}/status`, { status: status.status, reden: status.reden, ...(status.ingang ? { ingang: new Date(status.ingang).toISOString() } : {}) }), () => zetStatus({ status: "geblokkeerd", ingang: "", reden: "" })); }}>
              <Heading2>{t("statusWijzigen")}</Heading2>
              <Paragraph className="ab-klein">{t("statusUitleg")}</Paragraph>
              <div className="ab-velden-twee">
                <FormField label={<FormLabel htmlFor="s-status">{t("status")}</FormLabel>}>
                  <Select id="s-status" value={status.status} onChange={(e) => zetStatus({ ...status, status: e.target.value })}>
                    {["actief", "geblokkeerd", "gedeactiveerd"].map((s) => <SelectOption key={s} value={s}>{t(s as "actief")}</SelectOption>)}
                  </Select>
                </FormField>
                <FormField label={<FormLabel htmlFor="s-ingang">{t("ingang")}</FormLabel>}>
                  <Textbox id="s-ingang" type="datetime-local" value={status.ingang} onChange={(e) => zetStatus({ ...status, ingang: e.target.value })} />
                </FormField>
              </div>
              <RedenVeld id="s-reden" waarde={status.reden} zet={(reden) => zetStatus({ ...status, reden })} />
              <div><PrimaryActionButton type="submit">{t("opslaan")}</PrimaryActionButton></div>
            </form>
            <form className="ab-kaart ab-blok" onSubmit={(e) => { e.preventDefault(); doe(() => api("POST", `/api/accounts/${id}/uitloggen`, { reden: uitReden }), () => zetUitReden("")); }}>
              <Heading2>{t("overalUitloggen")}</Heading2>
              <Paragraph className="ab-klein">{t("overalUitloggenUitleg")}</Paragraph>
              <RedenVeld id="u-reden" waarde={uitReden} zet={zetUitReden} />
              <div><SecondaryActionButton type="submit">{t("overalUitloggen")}</SecondaryActionButton></div>
            </form>
          </div>
        </div>
      )}
      <Heading2>{t("geschiedenis")}</Heading2>
      <div className="ab-tabel">
        <Table>
          <TableHeader>
            <TableRow><TableHeaderCell>{t("ingangKort")}</TableHeaderCell><TableHeaderCell>{t("status")}</TableHeaderCell><TableHeaderCell>{t("reden")}</TableHeaderCell><TableHeaderCell>{t("door")}</TableHeaderCell></TableRow>
          </TableHeader>
          <TableBody>
            {d.wijzigingen.map((w) => (
              <TableRow key={w.id}>
                <TableCell>
                  {tijd(w.ingang)}
                  {w.geannuleerd ? <> <StatusBadge status="neutral">{t("geannuleerd")}</StatusBadge></> : !w.uitgevoerd && <> <StatusBadge status="warning">{t("gepland")}</StatusBadge></>}
                </TableCell>
                <TableCell><Status s={w.status} /></TableCell>
                <TableCell>
                  {w.reden}
                  {w.geannuleerd && <span className="ab-klein ab-blok-regel">{t("geannuleerd")}: {w.reden_annulering}</span>}
                </TableCell>
                <TableCell>{w.door}{w.geannuleerd_door && <span className="ab-klein ab-blok-regel">{t("geannuleerd")}: {w.geannuleerd_door}</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!d.wijzigingen.length && <Paragraph className="ab-leeg">—</Paragraph>}
      </div>
    </>
  );
}
