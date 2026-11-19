import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { boom, suggesties, zoek } from "../selectielijst";
import { OPZET, steunKlassen, volgendeCode, type Ondersteunend } from "../ondersteunend";
import { GROEPEN, nieuwStandaard, STANDAARDATTRIBUTEN, standaardVan, type StandaardAttribuut } from "../standaardattributen";
import {
  Alert, Checkbox, FormField, FormLabel, Heading1, Heading2, Heading3, Paragraph, PrimaryActionButton, SecondaryActionButton,
  Select, SelectOption, StatusBadge, SubtleButton, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Textarea, Textbox,
} from "@utrecht/component-library-react";
import { api, ApiFout, type Ik } from "../api";
import { t, taal, tijd } from "../i18n";
import { ga, L } from "../App";
import { foutTekst, MeldingVak, RedenVeld, useLaden, type Melding } from "./gedeeld";
import { GeplandWijzigen, IngangVeld, ingangInvoer, ingangVoorPlatform, isGepland, Keuzekaarten, ModelOverzicht, PlanningMelding, VersieKop, type Intrekking, type VersieRij } from "./Modelbeheer";

// ---------------------------------------------------------------------------
// Typen: zoals het platform ze geeft (oa-contract, classificatie.ts)
// ---------------------------------------------------------------------------

type Waardering = "vernietigen" | "blijvend-bewaren";
interface Procestype { nummer: number; naam: string; omschrijving: string; procesobject: string }
interface Resultaat {
  id: string;
  procestype: number;
  generiek: string | null;
  naam: string;
  omschrijving: string;
  waardering: Waardering;
  procestermijn: "nihil" | "procesobject" | "vervaldatum";
  bewaartermijn?: string;
  bewaartermijnTekst?: string;
  toelichting?: string;
}
interface Selectielijst { id: string; naam: string; toelichting: string; procestypen: Procestype[]; resultaten: Resultaat[] }
interface Afwijking { resultaat: string; waardering?: Waardering; bewaartermijn?: string; reden: string }
type AttribuutType = "tekst" | "keuze" | "ja-nee";
interface Attribuut { sleutel: string; label: string; type: AttribuutType; opties?: string[]; verplicht: boolean; beschrijving?: string; standaard?: string; koppeling?: Record<string, string> }
interface Config {
  naam?: string;
  selectielijst: string;
  uitgezet?: string[];
  afwijkingen?: Afwijking[];
  attributen: Attribuut[];
  vergrendelBij: string[];
  termijnStartBij: string;
  zoektermen?: { resultaat: string; termen: string[] }[];
  ondersteunend?: Ondersteunend | null;
}
interface Model { versie: number; config: Config; gepubliceerd: string; door: string | null; ingang?: string; ingetrokken?: Intrekking | null }
interface Stand {
  aan: boolean;
  gemeente?: string;
  selectielijsten?: Selectielijst[];
  statussen?: string[] | null;
  standaard?: Config;
  actief?: Model | null;
  versies?: Model[];
}
interface Probleem { sleutel?: string; ernst: "fout" | "waarschuwing"; melding: string }

const T = {
  titel: ["Classificatiemodel", "Classification model"],
  introOverzicht: [
    "Waar een stuk bij hoort in de selectielijst, en wat daaruit volgt: hoe lang het bewaard wordt en wanneer het vergrendeld is. De versie die in gebruik is, geldt voor nieuwe classificaties; stukken houden de versie waarmee ze zijn geclassificeerd. Een oudere versie kun je bekijken, niet meer aanpassen: bewerken maakt altijd een nieuwe versie.",
    "Where a document belongs in the retention schedule, and what follows: how long it is kept and when it is locked. The version in use applies to new classifications; documents keep the version they were classified with. You can view an older version but no longer change it: editing always makes a new version.",
  ],
  selectielijst: ["Selectielijst", "Retention schedule"],
  klassen: ["klassen in gebruik", "classes in use"],
  nieuwUitleg: ["Begin opnieuw vanaf een selectielijst, met alle klassen aan en zonder afwijkingen. Met publiceren wordt het de nieuwe versie voor nieuwe classificaties; stukken houden hun versie.", "Start again from a retention schedule, with all classes on and no deviations. Publishing makes it the new version for new classifications; documents keep their version."],
  uitgezet: ["Uitgezette klassen", "Classes switched off"],
  geen: ["geen", "none"],
  attributen: ["Eigen attributen", "Own attributes"],
  termijn: ["Termijn", "Period"],
  intro: [
    "Waar een stuk bij hoort in de selectielijst, en wat daaruit volgt: hoe lang het bewaard wordt en wanneer het vergrendeld is. Medewerkers kiezen in het paneel (Classificeren) een klasse; de assistent stelt er een voor. Publiceren maakt een nieuwe versie; stukken houden de versie waarmee ze zijn geclassificeerd.",
    "Where a document belongs in the retention schedule, and what follows: how long it is kept and when it is locked. Employees choose a class in the panel (Classify); the assistant suggests one. Publishing creates a new version; documents keep the version they were classified with.",
  ],
  uit: ["Het platform is niet gekoppeld aan dit portaal. Zie INRICHTING.md, stap 9.", "The platform is not connected to this portal. See INRICHTING.md, step 9."],
  nuActief: ["Nu in gebruik", "In use now"],
  geenModel: ["Nog geen classificatiemodel. Zonder model wordt geen stuk vergrendeld en krijgt geen stuk een bewaartermijn.", "No classification model yet. Without one, no document is locked and none gets a retention period."],
  versie: ["versie", "version"],
  door: ["door", "by"],
  gewijzigd: ["Gewijzigd, nog niet gepubliceerd", "Changed, not yet published"],
  terug: ["Wijzigingen weggooien", "Discard changes"],
  stap1: ["1. Naam en selectielijst", "1. Name and retention schedule"],
  naam: ["Naam van het model", "Name of the model"],
  naamUitleg: ["Zo heet het model in het paneel. Leeg: de naam van de selectielijst. Een andere naam is ook een nieuwe versie.", "This is what the model is called in the panel. Empty: the name of the schedule. A new name is also a new version."],
  stap2: ["2. Vergrendelen en bewaartermijn", "2. Locking and retention period"],
  vergrendel: ["Vergrendelen bij status", "Lock at status"],
  vergrendelUitleg: ["Bij deze statussen maakt het platform geen nieuwe versie meer. Een wijziging wordt een voorstel, dat een vrijgever beoordeelt (Keycloak-rol vrijgever). Kies ten minste één status.", "At these statuses the platform makes no new version. A change becomes a proposal, reviewed by a releaser (Keycloak role vrijgever). Choose at least one status."],
  start: ["De bewaartermijn gaat in bij status", "The retention period starts at status"],
  startUitleg: ["De dag waarop een stuk deze status voor het eerst krijgt, is de brondatum. Bij klassen waarvan de termijn ingaat als het procesobject vervalt (een vergunning), vult de medewerker die datum in.", "The day a document first gets this status is the source date. For classes whose period starts when the process object lapses (a permit), the employee enters that date."],
  geenStatus: ["Het metadatamodel heeft geen statusveld. Zet bij Metadatamodel een statusveld aan (RGBZ heeft er een); anders wordt niets vergrendeld en gaat geen termijn in.", "The metadata model has no status field. Switch one on in Metadata model (RGBZ has one); otherwise nothing is locked and no period starts."],
  stap3: ["3. Klassen uit de selectielijst", "3. Classes from the schedule"],
  stap3Uitleg: ["Zet uit wat je gemeente niet gebruikt; dat maakt de keuze in het paneel kleiner. Afwijken van een bewaartermijn kan alleen met een reden en het recht bewaartermijn.afwijken; vernietigen wat de selectielijst blijvend bewaart, meld je bij de archivaris.", "Switch off what your municipality does not use; that keeps the choice in the panel smaller. Deviating from a retention period requires a reason and the permission bewaartermijn.afwijken; destroying what the schedule keeps permanently must be reported to the archivist."],
  zoek: ["Zoek op nummer of woord", "Search by number or word"],
  inGebruik: ["in gebruik", "in use"],
  alles: ["Alles aan", "All on"],
  niets: ["Alles uit", "All off"],
  afwijken: ["Afwijken", "Deviate"],
  afwijking: ["afwijking", "deviation"],
  afwijkingen: ["Afwijkingen van de selectielijst", "Deviations from the schedule"],
  waardering: ["Waardering", "Appraisal"],
  vernietigen: ["vernietigen", "destroy"],
  bewaren: ["blijvend bewaren", "keep permanently"],
  jaren: ["Bewaartermijn in jaren", "Retention in years"],
  reden: ["Reden (verplicht)", "Reason (required)"],
  weg: ["Afwijking weghalen", "Remove deviation"],
  klaar: ["Klaar", "Done"],
  stap4: ["5. Attributen", "5. Attributes"],
  stap4Uitleg: ["Kenmerken die je gemeente bij het classificeren wil vastleggen. De medewerker vult ze in het paneel in.", "Characteristics your municipality wants to record when classifying. The employee fills them in in the panel."],
  standaardKop: ["Standaardattributen", "Standard attributes"],
  standaardUitleg: ["Attributen met een vaste betekenis, bij elke gemeente hetzelfde. Label, keuzes, hulptekst en verplicht pas je aan; de technische naam en de soort liggen vast. Daardoor kan de assistent er iets mee, zoals een keuze voorstellen of een veld alleen vragen waar het geldt. Een nieuwe versie van het model neemt ze mee zoals je ze instelde.", "Attributes with a fixed meaning, the same in every municipality. You adjust label, options, help text and required; the technical name and type are fixed. That lets the assistant use them, for instance to suggest a value or to ask only where it applies. A new version of the model keeps them as you set them."],
  eigenKop: ["Eigen attributen", "Own attributes"],
  bron: ["Bron", "Source"],
  alleenBlijvend: ["Alleen gevraagd bij blijvend bewaren.", "Only asked for documents kept permanently."],
  koppelingKop: ["Voorstel van de assistent", "Assistant's suggestion"],
  koppelingUitleg: ["Welke keuze de assistent voorstelt. Hernoem je een keuze, dan gaat de koppeling mee.", "Which option the assistant suggests. If you rename an option, the link follows."],
  geenVoorstel: ["(geen voorstel)", "(no suggestion)"],
  vasteSoort: ["ligt vast", "fixed"],
  standaardMerk: ["standaard", "standard"],
  label: ["Label", "Label"],
  sleutel: ["Technische naam", "Technical name"],
  soort: ["Soort", "Type"],
  tekst: ["tekst", "text"],
  keuze: ["keuzelijst", "choice"],
  janee: ["ja of nee", "yes or no"],
  opties: ["Keuzes, één per regel", "Options, one per line"],
  verplicht: ["Verplicht", "Required"],
  hulptekst: ["Hulptekst", "Help text"],
  toevoegen: ["Attribuut toevoegen", "Add attribute"],
  verwijder: ["Verwijderen", "Remove"],
  geenAttributen: ["Nog geen eigen attributen.", "No own attributes yet."],
  stap5: ["6. Controleren en publiceren", "6. Check and publish"],
  zoektermen: ["Zoektermen", "Search terms"],
  zoektermenUitleg: ["Woorden die medewerkers gebruiken en die de selectielijst niet noemt, zoals \"collegevoorstel\" of \"projectplan\". De assistent en het zoeken in het paneel vinden de klasse dan ook op deze woorden. Scheid ze met komma's; hoogstens 20.", "Words employees use that the schedule does not mention, such as \"council proposal\" or \"project plan\". The assistant and the search in the panel then also find the class by these words. Separate them with commas; at most 20."],
  stapOndersteunend: ["4. Ondersteunende stukken", "4. Supporting documents"],
  ondersteunendUitleg: ["Kopieën, kladversies, gedownloade stukken en stukken ter kennisname horen niet bij een proces en hebben geen archiefwaarde. Zet je dit aan, dan kan de medewerker zo'n stuk als ondersteunend classificeren; het mag dan na de termijn hieronder weg, gerekend vanaf het classificeren. Dit vraagt een grondslag: een besluit of richtlijn van je gemeente waarin staat wat hieronder valt. Stem het af met je archivaris.", "Copies, drafts, downloaded documents and documents received for information do not belong to a process and have no archival value. If you switch this on, employees can classify such a document as supporting; it may then be destroyed after the term below, counted from classification. This needs a basis: a decision or guideline of your municipality stating what falls under it. Agree it with your archivist."],
  ondersteunendRecht: ["Aanzetten en wijzigen vraagt het recht bewaartermijn.afwijken (informatiebeheer of archivaris).", "Switching this on or changing it requires the bewaartermijn.afwijken right (records management or archivist)."],
  ondersteunendAan: ["Ondersteunende stukken toestaan", "Allow supporting documents"],
  ondersteunendStandaard: ["Kopieën, kladversies, gedownloade stukken en stukken die je alleen ter kennisname kreeg, als ze niet in een zaak zijn gebruikt.", "Copies, drafts, downloaded documents and documents you only received for information, if they were not used in a case."],
  ondersteunendOms: ["Wat valt eronder", "What falls under it"],
  ondersteunendOmsUitleg: ["De medewerker ziet deze tekst in het paneel.", "The employee sees this text in the panel."],
  ondersteunendTermijn: ["Bewaartermijn", "Retention period"],
  ondersteunendTermijnUitleg: ["Gerekend vanaf het classificeren.", "Counted from classification."],
  ondersteunendGrondslag: ["Grondslag", "Basis"],
  ondersteunendGrondslagUitleg: ["Het besluit of de richtlijn van de gemeente.", "The municipality's decision or guideline."],
  ondersteunendGrondslagVoorbeeld: ["Richtlijn opschonen informatie 2026, art. 3", "Guideline on information clean-up 2026, art. 3"],
  opzetLaden: ["Opzet laden als vertrekpunt", "Load the draft set as a starting point"],
  opzetUitleg: ["Vijf categorieën en vijf toetsvragen naar de Archiefwet, de Handreiking Selectielijst 2020 en de Australische Normal Administrative Practice. Een vertrekpunt: pas de termijnen, voorbeelden en grondslag aan voor je gemeente. Laden vervangt wat hieronder staat.", "Five categories and five test questions after the Dutch Archives Act, the VNG guidance on the 2020 retention schedule and the Australian Normal Administrative Practice. A starting point: adjust the periods, examples and basis for your municipality. Loading replaces what is below."],
  opzetGeladen: ["De opzet is geladen. Pas aan wat nodig is en publiceer.", "The draft set is loaded. Adjust what is needed and publish."],
  categorieen: ["Categorieën", "Categories"],
  categorieenUitleg: ["De medewerker kiest een categorie; elke categorie heeft haar eigen termijn, gerekend vanaf het classificeren. Zonder categorieën is er één soort ondersteunend stuk met één termijn.", "The employee chooses a category; each has its own period, counted from classification. Without categories there is one kind of supporting document with one period."],
  code: ["Code", "Code"],
  naamKop: ["Naam", "Name"],
  voorbeelden: ["Wat valt eronder", "What falls under it"],
  categorieToevoegen: ["Categorie toevoegen", "Add category"],
  toetsvragen: ["Toetsvragen", "Test questions"],
  toetsvragenUitleg: ["Vragen waarop het antwoord nee moet zijn. De medewerker bevestigt in het paneel dat geen ervan geldt, voordat hij een categorie kiest. Bij ja hoort het stuk bij een zaak of een klasse uit de selectielijst.", "Questions to which the answer must be no. In the panel the employee confirms none applies before choosing a category. If one does, the document belongs to a case or a class from the schedule."],
  toetsvraagToevoegen: ["Toetsvraag toevoegen", "Add test question"],
  geenToetsvragen: ["Geen toetsvragen: de medewerker kiest meteen een categorie.", "No test questions: the employee chooses a category straight away."],
  nietOndersteunend: ["Is het antwoord op een van deze vragen ja, dan is het stuk niet ondersteunend.", "If the answer to any of these is yes, the document is not supporting."],
  geenVanDeze: ["Geen van deze vragen geldt voor dit stuk", "None of these questions applies to this document"],
  naClassificeren: ["na het classificeren", "after classification"],
  eenheid: ["Eenheid", "Unit"],
  maanden: ["maanden", "months"],
  jaarEenheid: ["jaar", "years"],
  boomUitleg: ["Elke regel is een klasse die de medewerker kan kiezen; met het vinkje bepaal je of hij in het paneel voorkomt. De lijst volgt de selectielijst: procestype, dan het resultaat, dan eventueel uitwerkingen. Een vinkje bij een procestype of resultaat zet alles eronder aan of uit; daarna kun je per regel bijstellen.", "Each line is a class the user can choose; the checkbox decides whether it appears in the panel. The list follows the retention schedule: process type, then result, then any refinements. A checkbox on a process type or result switches everything below it; you can then adjust per line."],
  allesUitklappen: ["Alles uitklappen", "Expand all"],
  allesInklappen: ["Alles inklappen", "Collapse all"],
  vanKiesbaar: ["van", "of"],
  klassenKiesbaar: ["klassen kiesbaar", "classes selectable"],
  allesKiesbaar: ["alles eronder kiesbaar", "everything below selectable"],
  kiesbaar: ["kiesbaar in het paneel", "selectable in the panel"],
  uitwerking: ["uitwerking", "refinement"],
  uitwerkingen: ["uitwerkingen", "refinements"],
  groepZelfUit: ["Het resultaat zelf staat niet in deze selectielijst; alleen de uitwerkingen.", "The result itself is not in this schedule; only its refinements."],
  voorbeeld: ["Zo ziet de medewerker het", "What the user sees"],
  voorbeeldUitleg: ["Het paneel Classificeren in de Office Assistent, met dit model. Probeer het: zoek, kies in stappen, of verander de voorbeeldtekst.", "The Classify panel in the Office Assistant, with this model. Try it: search, choose step by step, or change the sample text."],
  voorbeeldTekst: ["Voorbeeldtekst van een stuk", "Sample text of a document"],
  voorbeeldTekstUitleg: ["De assistent leest het stuk en stelt drie klassen voor. Verander de tekst om te zien wat hij voorstelt.", "The assistant reads the document and suggests three classes. Change the text to see what it suggests."],
  versieNieuw: ["nieuwe versie", "new version"],
  klopt: ["Het model klopt.", "The model is valid."],
  publiceren: ["Publiceren als nieuwe versie", "Publish as a new version"],
  publiceerUitleg: ["Nieuwe classificaties gebruiken dit model zodra het ingaat: meteen, of op de ingangsdatum als je die invult. Vanaf dat moment volgt ook het vergrendelen het nieuwe model. Stukken houden de bewaartermijn van de versie waarmee ze zijn geclassificeerd.", "New classifications use this model once it takes effect: straight away, or on the effective date if you fill one in. From then on locking follows the new model too. Documents keep the retention of the version they were classified with."],
  gepubliceerd: ["Gepubliceerd als versie", "Published as version"],
  versies: ["Versies", "Versions"],
  alsBasis: ["Als begin nemen", "Use as starting point"],
  alleenLezen: ["Je kunt het model bekijken, niet wijzigen (recht classificatie.manage).", "You can view the model, not change it (permission classificatie.manage)."],
  geenAfwijken: ["Afwijken van bewaartermijnen vraagt het recht bewaartermijn.afwijken.", "Deviating from retention periods requires the permission bewaartermijn.afwijken."],
  bezig: ["Bezig…", "Working…"],
} as const;
const tt = (k: keyof typeof T): string => T[k][taal() === "en" ? 1 : 0];

function duur(d?: string): string {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(d ?? "");
  if (!m) return d ?? "";
  const delen = [m[1] && `${m[1]} jaar`, m[2] && `${m[2]} mnd`, m[3] && `${m[3]} wk`, m[4] && `${m[4]} dagen`].filter(Boolean);
  return delen.length ? delen.join(" ") : "direct";
}
function termijn(r: Pick<Resultaat, "waardering" | "bewaartermijn" | "bewaartermijnTekst">): string {
  if (r.waardering === "blijvend-bewaren") return tt("bewaren");
  return `${tt("vernietigen")} ${r.bewaartermijn ? `na ${duur(r.bewaartermijn)}` : `(${r.bewaartermijnTekst ?? "zie toelichting"})`}`;
}

/** Vaste volgorde en vorm, om te vergelijken met wat in gebruik is. */
function vast(c: Config): string {
  return JSON.stringify({
    naam: c.naam?.trim() || undefined,
    selectielijst: c.selectielijst,
    uitgezet: [...(c.uitgezet ?? [])].sort(),
    afwijkingen: [...(c.afwijkingen ?? [])].map((a) => ({ resultaat: a.resultaat, waardering: a.waardering, bewaartermijn: a.bewaartermijn, reden: a.reden })).sort((a, b) => a.resultaat.localeCompare(b.resultaat)),
    attributen: c.attributen.map((a) => ({ sleutel: a.sleutel, label: a.label, type: a.type, opties: a.opties, verplicht: a.verplicht, beschrijving: a.beschrijving || undefined, standaard: a.standaard, koppeling: a.koppeling })),
    vergrendelBij: [...c.vergrendelBij].sort(),
    termijnStartBij: c.termijnStartBij,
    zoektermen: [...(c.zoektermen ?? [])].filter((z) => z.termen.length).map((z) => ({ resultaat: z.resultaat, termen: z.termen })).sort((a, b) => a.resultaat.localeCompare(b.resultaat)),
    ondersteunend: c.ondersteunend ?? null,
  });
}

function sleutelUit(label: string): string {
  const w = label.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  const s = w.map((x, i) => (i === 0 ? x.toLowerCase() : x[0]!.toUpperCase() + x.slice(1).toLowerCase())).join("");
  return /^[a-z]/.test(s) ? s.slice(0, 40) : `attr${s}`.slice(0, 40);
}

// ---------------------------------------------------------------------------
// De pagina
// ---------------------------------------------------------------------------

export function Classificatie({ ik, deel = "" }: { ik: Ik; deel?: string }) {
  const stand = useLaden(() => api<Stand>("GET", "/api/classificatie"));
  if (stand.fout) return <><Heading1>{tt("titel")}</Heading1><MeldingVak m={{ soort: "fout", tekst: stand.fout }} /></>;
  if (!stand.data) return <Heading1>{tt("titel")}</Heading1>;
  if (!stand.data.aan) return <><Heading1>{tt("titel")}</Heading1><Alert type="info"><Paragraph>{tt("uit")}</Paragraph></Alert></>;
  const s = stand.data;
  const kan = ik.rechten.includes("classificatie.manage");
  if (deel === "bewerken" && kan && s.actief) return <Bewerker key={s.actief.versie} ik={ik} s={s} herlaad={stand.herlaad} />;
  if (deel === "nieuw" && kan) return <NieuwModel ik={ik} s={s} herlaad={stand.herlaad} />;
  const v = /^versie\/(\d+)$/.exec(deel);
  if (v) return <VersieBekijken ik={ik} s={s} versie={Number(v[1])} herlaad={stand.herlaad} />;
  return <Overzicht s={s} kan={kan} />;
}

const PAD = "/classificatiemodel";

function rijenVan(s: Stand): VersieRij[] {
  return (s.versies ?? []).map((v) => {
    const lijst = s.selectielijsten!.find((l) => l.id === v.config.selectielijst);
    const totaal = lijst?.resultaten.length ?? 0;
    return {
      versie: v.versie,
      naam: v.config.naam?.trim() || lijst?.naam || v.config.selectielijst,
      basis: lijst?.naam ?? v.config.selectielijst,
      omvang: `${totaal - (v.config.uitgezet?.length ?? 0)} ${tt("klassen")}${v.config.afwijkingen?.length ? ` · ${v.config.afwijkingen.length} ${tt("afwijking")}${v.config.afwijkingen.length === 1 ? "" : "en"}` : ""}`,
      gepubliceerd: v.gepubliceerd,
      door: v.door,
      actief: v.versie === s.actief?.versie,
      teBekijken: true,
      ingang: v.ingang ?? null,
      gepland: isGepland(v),
      ingetrokken: v.ingetrokken ?? null,
    };
  });
}

function Overzicht({ s, kan }: { s: Stand; kan: boolean }) {
  const rijen = rijenVan(s);
  const nr = new URLSearchParams(location.search).get("gepubliceerd");
  return (
    <ModelOverzicht
      titel={tt("titel")}
      intro={tt("introOverzicht")}
      pad={PAD}
      kan={kan}
      rijen={rijen}
      actief={rijen.find((r) => r.actief) ?? null}
      basisLabel={tt("selectielijst")}
      melding={nr ? { soort: "ok", tekst: `${tt("gepubliceerd")} ${nr}.` } : null}
    />
  );
}

/** Eén versie, alleen lezen. */
function VersieBekijken({ ik, s, versie, herlaad }: { ik: Ik; s: Stand; versie: number; herlaad: () => void }) {
  const rij = rijenVan(s).find((r) => r.versie === versie);
  const v = (s.versies ?? []).find((x) => x.versie === versie);
  const lijst = v ? s.selectielijsten!.find((l) => l.id === v.config.selectielijst) : undefined;
  const naamVan = (id: string) => lijst?.resultaten.find((r) => r.id === id)?.naam ?? "";
  const [basis, zetBasis] = useState<Config | null>(null);
  if (basis) return <Bewerker ik={ik} s={s} herlaad={herlaad} start={basis} />;
  // Een geplande versie is nog niet in gebruik: die kun je nog wijzigen.
  if (rij?.gepland && v && ik.rechten.includes("classificatie.manage")) return <Bewerker key={versie} ik={ik} s={s} herlaad={herlaad} start={v.config} vervangt={rij} />;
  return (
    <>
      <VersieKop titel={tt("titel")} pad={PAD} rij={rij} herlaad={herlaad} intrekPad={ik.rechten.includes("classificatie.manage") ? `/api/classificatie/versies/${versie}/intrekken` : undefined} />
      {ik.rechten.includes("classificatie.manage") && v && !rij?.actief && !rij?.gepland && (
        <div className="ab-knoppen ab-ruimte"><SecondaryActionButton onClick={() => zetBasis(v.config)}>{t("alsBasisNieuw")}</SecondaryActionButton></div>
      )}
      {!v && <Alert type="warning"><Paragraph>{t("versieOnbekend")}</Paragraph></Alert>}
      {v && (
        <div className="ab-twee">
          <div className="ab-kolom">
            <section className="ab-kaart ab-blok">
              <dl className="ab-feiten">
                <div><dt>{tt("selectielijst")}</dt><dd>{lijst?.naam ?? v.config.selectielijst}</dd></div>
                <div><dt>{t("inhoud")}</dt><dd>{rij?.omvang}</dd></div>
                <div><dt>{tt("vergrendel")}</dt><dd>{v.config.vergrendelBij.join(", ") || tt("geen")}</dd></div>
                <div><dt>{tt("start")}</dt><dd>{v.config.termijnStartBij || "—"}</dd></div>
              </dl>
            </section>
            {!!v.config.afwijkingen?.length && (
              <section className="ab-kaart ab-blok">
                <Heading2>{tt("afwijkingen")}</Heading2>
                <ul className="ab-lijst">
                  {v.config.afwijkingen.map((a) => (
                    <li key={a.resultaat}>
                      <b>{a.resultaat}</b> {naamVan(a.resultaat)}: {a.waardering ? tt(a.waardering === "vernietigen" ? "vernietigen" : "bewaren") : ""}{a.bewaartermijn ? ` · ${duur(a.bewaartermijn)}` : ""}
                      <span className="ab-klein ab-blok-regel">{a.reden}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <div className="ab-kolom">
            <section className="ab-kaart ab-blok">
              <Heading2>{tt("attributen")}</Heading2>
              {v.config.attributen.length ? (
                <ul className="ab-lijst">
                  {v.config.attributen.map((a) => <li key={a.sleutel}><b>{a.label}</b> <span className="ab-klein">{a.standaard ? ` · ${tt("standaardMerk")}` : ""} · {a.type}{a.verplicht ? ` · ${tt("verplicht").toLowerCase()}` : ""}</span>{a.opties?.length ? <span className="ab-klein ab-blok-regel">{a.opties.join(", ")}</span> : null}</li>)}
                </ul>
              ) : <Paragraph className="ab-klein">{tt("geenAttributen")}</Paragraph>}
            </section>
            <section className="ab-kaart ab-blok">
              <Heading2>{tt("uitgezet")}</Heading2>
              {v.config.uitgezet?.length ? (
                <ul className="ab-lijst">{v.config.uitgezet.map((id) => <li key={id}><b>{id}</b> {naamVan(id)}</li>)}</ul>
              ) : <Paragraph className="ab-klein">{tt("geen")}</Paragraph>}
            </section>
            <section className="ab-kaart ab-blok">
              <Heading2>{tt("stapOndersteunend").replace(/^\d+\. /, "")}</Heading2>
              {v.config.ondersteunend ? (
                <>
                  <dl className="ab-feiten">
                    <div><dt>{tt("ondersteunendOms")}</dt><dd>{v.config.ondersteunend.omschrijving}</dd></div>
                    {!v.config.ondersteunend.categorieen?.length && <div><dt>{tt("ondersteunendTermijn")}</dt><dd>{duur(v.config.ondersteunend.bewaartermijn)} {tt("naClassificeren")}</dd></div>}
                    <div><dt>{tt("ondersteunendGrondslag")}</dt><dd>{v.config.ondersteunend.grondslag}</dd></div>
                  </dl>
                  {!!v.config.ondersteunend.categorieen?.length && (
                    <ul className="ab-lijst">
                      {v.config.ondersteunend.categorieen.map((k) => <li key={k.code}><b>{k.code}</b> {k.naam} · {duur(k.bewaartermijn)} {tt("naClassificeren")}</li>)}
                    </ul>
                  )}
                  {!!v.config.ondersteunend.toetsvragen?.length && (
                    <>
                      <Heading3>{tt("toetsvragen")}</Heading3>
                      <ol className="ab-lijst">{v.config.ondersteunend.toetsvragen.map((q, i) => <li key={i}>{q}</li>)}</ol>
                    </>
                  )}
                </>
              ) : <Paragraph className="ab-klein">{taal() === "en" ? "Not allowed in this version." : "Niet toegestaan in deze versie."}</Paragraph>}
            </section>
            <section className="ab-kaart ab-blok">
              <Heading2>{tt("zoektermen")}</Heading2>
              {v.config.zoektermen?.length ? (
                <ul className="ab-lijst">{v.config.zoektermen.map((z) => <li key={z.resultaat}><b>{z.resultaat}</b> {naamVan(z.resultaat)}<span className="cl-termen">{z.termen.map((t) => <span key={t} className="cl-term">{t}</span>)}</span></li>)}</ul>
              ) : <Paragraph className="ab-klein">{tt("geen")}</Paragraph>}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

/** Een nieuw model: kies de selectielijst en een naam; daarna verder in de bewerker. */
function NieuwModel({ ik, s, herlaad }: { ik: Ik; s: Stand; herlaad: () => void }) {
  const [lijst, zetLijst] = useState<string | null>(s.selectielijsten!.length === 1 ? s.selectielijsten![0]!.id : null);
  const [naam, zetNaam] = useState("");
  const [start, zetStart] = useState<Config | null>(null);
  if (start) return <Bewerker ik={ik} s={s} herlaad={herlaad} start={start} />;
  return (
    <>
      <Paragraph><L naar={PAD}>← {tt("titel")}</L></Paragraph>
      <Heading1>{t("nieuwModel")}</Heading1>
      <Paragraph className="ab-lead">{tt("nieuwUitleg")}</Paragraph>
      <form className="ab-formulier ab-formulier-breed" onSubmit={(e) => { e.preventDefault(); if (lijst) zetStart({ ...s.standaard!, selectielijst: lijst, uitgezet: [], afwijkingen: [], ...(naam.trim() ? { naam: naam.trim() } : { naam: undefined }) }); }}>
        <Heading2>{tt("stap1")}</Heading2>
        <Keuzekaarten opties={s.selectielijsten!.map((l) => ({ id: l.id, naam: l.naam, uitleg: `${l.toelichting} ${l.resultaten.length} resultaten in ${l.procestypen.length} procestypen.` }))} gekozen={lijst} kies={zetLijst} />
        <FormField label={<FormLabel htmlFor="nc-naam">{tt("naam")}</FormLabel>} description={tt("naamUitleg")}>
          <Textbox id="nc-naam" value={naam} maxLength={80} onChange={(e) => zetNaam(e.target.value)} />
        </FormField>
        <div className="ab-knoppen">
          <PrimaryActionButton type="submit" disabled={!lijst}>{t("verder")}</PrimaryActionButton>
          <SecondaryActionButton type="button" onClick={() => ga(PAD)}>{t("annuleren")}</SecondaryActionButton>
        </div>
      </form>
    </>
  );
}

function Bewerker({ ik, s, herlaad, start, vervangt }: { ik: Ik; s: Stand; herlaad: () => void; start?: Config; vervangt?: VersieRij }) {
  const kan = ik.rechten.includes("classificatie.manage");
  const magAfwijken = kan && ik.rechten.includes("bewaartermijn.afwijken");
  const vanActief = useMemo<Config>(() => s.actief?.config ?? s.standaard!, [s]);
  const [config, zetConfig] = useState<Config>(start ?? vanActief);
  const [problemen, zetProblemen] = useState<Probleem[] | null>(null);
  const [reden, zetReden] = useState("");
  const [ingang, zetIngang] = useState(ingangInvoer(vervangt?.ingang));
  // Bij het wijzigen van een geplande versie staat die zelf in de bewerker; geen blokkade.
  const gepland = vervangt ? undefined : rijenVan(s).find((r) => r.gepland);
  const [m, zetM] = useState<Melding>(null);
  const [bezig, zetBezig] = useState(false);
  const [vraag, zetVraag] = useState("");
  const [open, zetOpen] = useState<string | null>(null);
  const lijst = s.selectielijsten!.find((l) => l.id === config.selectielijst) ?? s.selectielijsten![0]!;
  const takken = useMemo(() => boom(lijst.resultaten, lijst.procestypen), [lijst]);
  const [uitgeklapt, zetUitgeklapt] = useState<Set<string>>(new Set());
  const klap = (k: string) => zetUitgeklapt((u) => { const n = new Set(u); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const gewijzigd = vervangt
    ? vast(config) !== vast(start!) || ingangVoorPlatform(ingang) !== ingangVoorPlatform(ingangInvoer(vervangt.ingang))
    : !s.actief || !!start || vast(config) !== vast(vanActief);
  const eerste = useRef(true);

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ problemen: Probleem[] }>("POST", "/api/classificatie/controle", { config }).then((r) => zetProblemen(r.problemen), (e) => zetM({ soort: "fout", tekst: foutTekst(e) }));
    }, eerste.current ? 0 : 300);
    eerste.current = false;
    return () => clearTimeout(t);
  }, [config]);

  const uit = useMemo(() => new Set(config.uitgezet ?? []), [config.uitgezet]);
  const afw = useMemo(() => new Map((config.afwijkingen ?? []).map((a) => [a.resultaat, a])), [config.afwijkingen]);
  const zetUit = (ids: string[], weg: boolean) =>
    zetConfig((c) => {
      const u = new Set(c.uitgezet ?? []);
      for (const i of ids) (weg ? u.add(i) : u.delete(i));
      return { ...c, uitgezet: [...u].sort() };
    });
  const zetAfwijking = (id: string, a: Partial<Afwijking> | null) =>
    zetConfig((c) => {
      const rest = (c.afwijkingen ?? []).filter((x) => x.resultaat !== id);
      if (!a) return { ...c, afwijkingen: rest };
      const oud = (c.afwijkingen ?? []).find((x) => x.resultaat === id) ?? { resultaat: id, reden: "" };
      return { ...c, afwijkingen: [...rest, { ...oud, ...a }] };
    });

  const termenVan = useMemo(() => new Map((config.zoektermen ?? []).map((z) => [z.resultaat, z.termen])), [config.zoektermen]);
  const zetTermen = (id: string, termen: string[]) =>
    zetConfig((c) => {
      const rest = (c.zoektermen ?? []).filter((z) => z.resultaat !== id);
      return { ...c, zoektermen: termen.length ? [...rest, { resultaat: id, termen }] : rest };
    });

  const q = vraag.trim().toLowerCase();
  const zichtbaar = (r: Resultaat) => !q || r.id === q || r.id.startsWith(`${q}.`) || `${r.naam} ${r.omschrijving} ${r.toelichting ?? ""} ${(termenVan.get(r.id) ?? []).join(" ")}`.toLowerCase().includes(q);
  const fouten = (problemen ?? []).filter((p) => p.ernst === "fout");

  // Eén klasse in de boom: vinkje (kiesbaar), naam en termijn, afwijken.
  const rij = (r: Resultaat, o: { kop?: ReactNode; vink?: { aan: boolean; half: boolean; ids: string[] }; extra?: ReactNode; diep?: boolean } = {}) => {
    const { kop, vink, extra, diep } = o;
    const a = afw.get(r.id);
    const isOpen = open === r.id;
    const termen = termenVan.get(r.id) ?? [];
    const termenOpen = open === `z:${r.id}`;
    return (
      <li key={r.id} className={`cl-resultaat${uit.has(r.id) ? " uit" : ""}${diep ? " diep" : ""}`}>
        <div className="cl-regel">
          {kop ?? <span className="cl-boom-ruimte" aria-hidden="true" />}
          <label className="cl-vink" title={tt("kiesbaar")}>
            <Vinkje aan={vink?.aan ?? !uit.has(r.id)} half={vink?.half ?? false} disabled={!kan} zet={(aan) => zetUit(vink?.ids ?? [r.id], !aan)} label={`${r.id} ${tt("kiesbaar")}`} />
          </label>
          <div className="cl-naam">
            <span><b>{r.id}</b> {r.naam}{r.omschrijving ? ` · ${r.omschrijving}` : ""}{extra}</span>
            <span className="ab-klein">
              {termijn(r)}
              {r.procestermijn !== "nihil" ? " · gaat in als het procesobject vervalt" : ""}
              {a && <> → <b>{termijn({ waardering: a.waardering ?? r.waardering, bewaartermijn: a.bewaartermijn ?? r.bewaartermijn })}</b> ({tt("afwijking")})</>}
            </span>
            {termen.length > 0 && (
              <span className="cl-termen" aria-label={tt("zoektermen")}>
                {termen.map((t) => <span key={t} className="cl-term">{t}</span>)}
              </span>
            )}
          </div>
          <div className="cl-regel-knoppen">
            {kan && <SubtleButton onClick={() => zetOpen(termenOpen ? null : `z:${r.id}`)} aria-expanded={termenOpen}>{termenOpen ? tt("klaar") : tt("zoektermen")}</SubtleButton>}
            {magAfwijken && <SubtleButton onClick={() => zetOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>{isOpen ? tt("klaar") : tt("afwijken")}</SubtleButton>}
          </div>
        </div>
        {termenOpen && <TermenBewerken id={r.id} termen={termen} zet={(t) => zetTermen(r.id, t)} />}
        {isOpen && (
          <div className="md-bewerk">
            <div className="md-twee">
              <FormField label={<FormLabel htmlFor={`cl-w-${r.id}`}>{tt("waardering")}</FormLabel>}>
                <Select id={`cl-w-${r.id}`} value={a?.waardering ?? r.waardering} onChange={(e) => zetAfwijking(r.id, { waardering: e.target.value as Waardering })}>
                  <SelectOption value="vernietigen">{tt("vernietigen")}</SelectOption>
                  <SelectOption value="blijvend-bewaren">{tt("bewaren")}</SelectOption>
                </Select>
              </FormField>
              {(a?.waardering ?? r.waardering) === "vernietigen" && (
                <FormField label={<FormLabel htmlFor={`cl-j-${r.id}`}>{tt("jaren")}</FormLabel>} description={r.bewaartermijn ? `Selectielijst: ${duur(r.bewaartermijn)}` : undefined}>
                  <Textbox
                    id={`cl-j-${r.id}`}
                    type="number"
                    min={0}
                    max={200}
                    value={/^P(\d+)Y$/.exec(a?.bewaartermijn ?? "")?.[1] ?? ""}
                    onChange={(e) => zetAfwijking(r.id, { bewaartermijn: e.target.value === "" ? undefined : `P${Math.max(0, Math.round(Number(e.target.value)))}Y` })}
                  />
                </FormField>
              )}
            </div>
            <FormField label={<FormLabel htmlFor={`cl-r-${r.id}`}>{tt("reden")}</FormLabel>}>
              <Textarea id={`cl-r-${r.id}`} rows={2} maxLength={1000} value={a?.reden ?? ""} onChange={(e) => zetAfwijking(r.id, { reden: e.target.value })} />
            </FormField>
            {a && <div><SubtleButton onClick={() => { zetAfwijking(r.id, null); zetOpen(null); }}>{tt("weg")}</SubtleButton></div>}
          </div>
        )}
        {(problemen ?? []).filter((p) => p.sleutel === r.id).map((p, i) => <p key={i} className={`md-probleem ${p.ernst}`}>{p.melding}</p>)}
      </li>
    );
  };

  const publiceer = async () => {
    zetBezig(true);
    zetM(null);
    try {
      const op = ingangVoorPlatform(ingang);
      const r = await api<{ versie: number }>("POST", "/api/classificatie/publiceer", { config, reden, ...(op ? { ingang: op } : {}), ...(vervangt ? { vervangt: vervangt.versie } : {}) });
      zetReden("");
      ga(`${PAD}?${op ? "gepland" : "gepubliceerd"}=${r.versie}${vervangt ? `&vervangt=${vervangt.versie}` : ""}`);
      herlaad();
    } catch (e) {
      const details = e instanceof ApiFout ? e.details : undefined;
      zetM({ soort: "fout", tekst: foutTekst(e) + (details?.length ? ` ${details.map((d) => d.melding).join(" ")}` : "") });
    } finally {
      zetBezig(false);
    }
  };

  return (
    <>
      <Paragraph><L naar={PAD}>← {tt("titel")}</L></Paragraph>
      <Heading1>{vervangt ? `${vervangt.naam} · ${t("versie")} ${vervangt.versie} ${t("bewerken").toLowerCase()}` : start ? t("nieuwModel") : `${tt("titel")} ${t("bewerken").toLowerCase()}`}</Heading1>
      {vervangt ? (
        <GeplandWijzigen rij={vervangt} actief={rijenVan(s).find((r) => r.actief) ?? null} pad={PAD} intrekPad={`/api/classificatie/versies/${vervangt.versie}/intrekken`} herlaad={herlaad} />
      ) : (
        <Paragraph className="ab-lead">{tt("intro")}</Paragraph>
      )}

      <div className="md-status">
        <div>
          <span className="ab-klein">{tt("nuActief")}</span>
          <div>
            {s.actief ? (
              <>
                <b>{tt("versie")} {s.actief.versie}</b> · {s.actief.config.naam?.trim() || lijst.naam} · {tijd(s.actief.gepubliceerd)}
                {s.actief.door ? ` ${tt("door")} ${s.actief.door}` : ""}
              </>
            ) : (
              tt("geenModel")
            )}
          </div>
        </div>
        {s.actief && gewijzigd && (
          <div className="md-concept">
            <StatusBadge status="warning">{tt("gewijzigd")}</StatusBadge>
            {kan && <SubtleButton onClick={() => zetConfig(vervangt ? start! : vanActief)}>{vervangt ? t("terugNaarGepland") : tt("terug")}</SubtleButton>}
          </div>
        )}
      </div>
      {!kan && <Alert type="info"><Paragraph>{tt("alleenLezen")}</Paragraph></Alert>}
      <MeldingVak m={m} />

      <div className="md-raster">
      <div className="md-hoofd">
      <div className="cl-kolommen">
        {/* 1. Naam en selectielijst */}
        <section aria-labelledby="cl-stap1">
          <Heading2 id="cl-stap1">{tt("stap1")}</Heading2>
          <div className="md-model gekozen cl-lijst" aria-label={lijst.naam}>
            <span className="md-model-kop"><b>{lijst.naam}</b></span>
            <span className="ab-klein">{lijst.toelichting} {lijst.resultaten.length} resultaten in {lijst.procestypen.length} procestypen.</span>
          </div>
          <FormField label={<FormLabel htmlFor="cl-naam">{tt("naam")}</FormLabel>} description={tt("naamUitleg")}>
            <Textbox id="cl-naam" value={config.naam ?? ""} placeholder={lijst.naam} maxLength={80} disabled={!kan} onChange={(e) => zetConfig((c) => ({ ...c, naam: e.target.value || undefined }))} />
          </FormField>
        </section>

        {/* 2. Vergrendelen en bewaartermijn */}
        <section aria-labelledby="cl-stap2">
          <Heading2 id="cl-stap2">{tt("stap2")}</Heading2>
          {!s.statussen ? (
            <Alert type="warning"><Paragraph>{tt("geenStatus")}</Paragraph></Alert>
          ) : (
            <>
              <fieldset className="cl-statussen">
                <legend>{tt("vergrendel")}</legend>
                <p className="ab-klein">{tt("vergrendelUitleg")}</p>
                {s.statussen.map((st) => (
                  <label key={st} className="cl-vink">
                    <Checkbox
                      checked={config.vergrendelBij.includes(st)}
                      disabled={!kan}
                      onChange={(e) => zetConfig((c) => ({ ...c, vergrendelBij: e.target.checked ? [...c.vergrendelBij, st] : c.vergrendelBij.filter((x) => x !== st) }))}
                    />
                    {st}
                  </label>
                ))}
              </fieldset>
              <FormField label={<FormLabel htmlFor="cl-start">{tt("start")}</FormLabel>} description={tt("startUitleg")}>
                <Select id="cl-start" value={config.termijnStartBij} disabled={!kan} onChange={(e) => zetConfig((c) => ({ ...c, termijnStartBij: e.target.value }))}>
                  {s.statussen.map((st) => <SelectOption key={st} value={st}>{st}</SelectOption>)}
                </Select>
              </FormField>
            </>
          )}
        </section>
      </div>

      {/* 3. Klassen */}
      <section aria-labelledby="cl-stap3" className="cl-sectie">
        <Heading2 id="cl-stap3">{tt("stap3")}</Heading2>
        <Paragraph className="ab-klein">{tt("stap3Uitleg")}</Paragraph>
        {kan && !magAfwijken && <Paragraph className="ab-klein">{tt("geenAfwijken")}</Paragraph>}
        {(config.afwijkingen?.length ?? 0) > 0 && (
          <div className="cl-afwijkingen">
            <Heading3>{tt("afwijkingen")} ({config.afwijkingen!.length})</Heading3>
            <ul>
              {config.afwijkingen!.map((a) => {
                const r = lijst.resultaten.find((x) => x.id === a.resultaat);
                return (
                  <li key={a.resultaat}>
                    <b>{a.resultaat}</b> {r?.naam} {r?.omschrijving ? `(${r.omschrijving})` : ""}: {r ? termijn(r) : ""} → <b>{termijn({ waardering: a.waardering ?? r?.waardering ?? "vernietigen", bewaartermijn: a.bewaartermijn ?? r?.bewaartermijn })}</b>
                    <span className="ab-klein"> · {a.reden || "geen reden"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <Paragraph className="ab-klein">{tt("boomUitleg")}</Paragraph>
        <FormField label={<FormLabel htmlFor="cl-zoek">{tt("zoek")}</FormLabel>}>
          <Textbox id="cl-zoek" type="search" value={vraag} onChange={(e) => zetVraag(e.target.value)} autoComplete="off" />
        </FormField>
        <div className="ab-knoppen cl-boom-knoppen">
          <SubtleButton onClick={() => zetUitgeklapt(new Set(takken.flatMap((tk) => [`p${tk.procestype.nummer}`, ...tk.groepen.map((g) => `g${g.id}`)])))}>{tt("allesUitklappen")}</SubtleButton>
          <SubtleButton onClick={() => zetUitgeklapt(new Set())}>{tt("allesInklappen")}</SubtleButton>
          <span className="ab-klein">{lijst.resultaten.length - uit.size} {tt("vanKiesbaar")} {lijst.resultaten.length} {tt("klassenKiesbaar")}</span>
        </div>
        <ul className="cl-boom" role="tree" aria-label={tt("stap3")}>
          {takken.map((tk) => {
            const ids = [...tk.groepen.flatMap((g) => [...(g.zelf ? [g.zelf.id] : []), ...g.uitwerkingen.map((r) => r.id)])];
            const zichtbareGroepen = tk.groepen.filter((g) => (g.zelf && zichtbaar(g.zelf)) || g.uitwerkingen.some(zichtbaar));
            if (!zichtbareGroepen.length) return null;
            const aan = ids.filter((i) => !uit.has(i)).length;
            const open = !!q || uitgeklapt.has(`p${tk.procestype.nummer}`);
            return (
              <li key={tk.procestype.nummer} role="treeitem" aria-expanded={open} className="cl-tak">
                <div className="cl-tak-kop">
                  <Klapper open={open} wissel={() => klap(`p${tk.procestype.nummer}`)} label={tk.procestype.naam} />
                  <label className="cl-vink"><Vinkje aan={aan === ids.length} half={aan > 0 && aan < ids.length} disabled={!kan} zet={(x) => zetUit(ids, !x)} label={`${tk.procestype.nummer}. ${tk.procestype.naam}: ${tt("allesKiesbaar")}`} /></label>
                  <button type="button" className="cl-tak-naam" onClick={() => klap(`p${tk.procestype.nummer}`)}>
                    <b>{tk.procestype.nummer}. {tk.procestype.naam}</b> <span className="ab-klein">({aan} {tt("vanKiesbaar")} {ids.length})</span>
                  </button>
                </div>
                {open && (
                  <>
                    <p className="ab-klein cl-tak-uitleg">{tk.procestype.omschrijving}{tk.procestype.procesobject ? ` · Procesobject: ${tk.procestype.procesobject}` : ""}</p>
                    <ul className="cl-resultaten" role="group">
                      {zichtbareGroepen.map((g) => {
                        const gIds = [...(g.zelf ? [g.zelf.id] : []), ...g.uitwerkingen.map((r) => r.id)];
                        const gAan = gIds.filter((i) => !uit.has(i)).length;
                        const gOpen = !!q || uitgeklapt.has(`g${g.id}`);
                        const heeftKinderen = g.uitwerkingen.length > 0;
                        const groepVink = heeftKinderen ? { aan: gAan === gIds.length, half: gAan > 0 && gAan < gIds.length, ids: gIds } : undefined;
                        const klapKnop = heeftKinderen ? <Klapper open={gOpen} wissel={() => klap(`g${g.id}`)} label={`${g.id} ${g.naam}`} /> : undefined;
                        const tel = heeftKinderen ? <span className="ab-klein"> · {g.uitwerkingen.length} {g.uitwerkingen.length === 1 ? tt("uitwerking") : tt("uitwerkingen")}</span> : null;
                        return (
                          <Fragment key={g.id}>
                            {g.zelf
                              ? rij(g.zelf, { kop: klapKnop, vink: groepVink, extra: tel })
                              : (
                                <li className={`cl-resultaat cl-groep-zonder${gAan ? "" : " uit"}`}>
                                  <div className="cl-regel">
                                    {klapKnop}
                                    <label className="cl-vink"><Vinkje aan={gAan === gIds.length} half={gAan > 0 && gAan < gIds.length} disabled={!kan} zet={(x) => zetUit(gIds, !x)} label={`${g.id} ${tt("allesKiesbaar")}`} /></label>
                                    <div className="cl-naam"><span><b>{g.id}</b> {g.naam}{tel}</span><span className="ab-klein">{tt("groepZelfUit")}</span></div>
                                  </div>
                                </li>
                              )}
                            {heeftKinderen && gOpen && g.uitwerkingen.filter(zichtbaar).map((r) => rij(r, { diep: true }))}
                          </Fragment>
                        );
                      })}
                    </ul>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* 4. Eigen attributen */}
      <section aria-labelledby="cl-stap-ond" className="cl-sectie">
        <Heading2 id="cl-stap-ond">{tt("stapOndersteunend")}</Heading2>
        <Paragraph className="ab-klein">{tt("ondersteunendUitleg")}</Paragraph>
        {kan && !magAfwijken && <Paragraph className="ab-klein">{tt("ondersteunendRecht")}</Paragraph>}
        <label className="cl-vink">
          <Checkbox
            checked={!!config.ondersteunend}
            disabled={!magAfwijken}
            onChange={(e) => zetConfig((c) => ({ ...c, ondersteunend: e.target.checked ? (c.ondersteunend ?? { omschrijving: tt("ondersteunendStandaard"), bewaartermijn: "P1Y", grondslag: "" }) : null }))}
          />
          {tt("ondersteunendAan")}
        </label>
        {config.ondersteunend && (
          <OndersteunendBewerken
            o={config.ondersteunend}
            kan={magAfwijken}
            zet={(f) => zetConfig((c) => ({ ...c, ondersteunend: c.ondersteunend ? f(c.ondersteunend) : c.ondersteunend }))}
          />
        )}
        {(problemen ?? []).filter((p) => p.sleutel === "ondersteunend").map((p, i) => <p key={i} className={`md-probleem ${p.ernst}`}>{p.melding}</p>)}
      </section>

      <section aria-labelledby="cl-stap4" className="cl-sectie">
        <Heading2 id="cl-stap4">{tt("stap4")}</Heading2>
        <Paragraph className="ab-klein">{tt("stap4Uitleg")}</Paragraph>
        <Heading3>{tt("standaardKop")}</Heading3>
        <Paragraph className="ab-klein">{tt("standaardUitleg")}</Paragraph>
        {/* Twee vaste kolommen: een groep die groeit als je een attribuut aanzet, verspringt dan niet naar de andere kolom. */}
        <div className="cl-standaard">
          {[GROEPEN.slice(0, Math.ceil(GROEPEN.length / 2)), GROEPEN.slice(Math.ceil(GROEPEN.length / 2))].map((kolom, k) => (
          <div key={k} className="cl-st-kolom">
          {kolom.map((g) => (
            <fieldset key={g} className="cl-st-groep">
              <legend>{g}</legend>
              <ul>
                {STANDAARDATTRIBUTEN.filter((x) => x.groep === g).map((st) => {
                  const i = config.attributen.findIndex((a) => a.standaard === st.sleutel);
                  const a = i >= 0 ? config.attributen[i]! : null;
                  return (
                    <li key={st.sleutel} className={`cl-st${a ? " aan" : ""}`}>
                      <label className="cl-st-kop">
                        <Checkbox
                          checked={!!a}
                          disabled={!kan}
                          onChange={(e) => zetConfig((c) => ({ ...c, attributen: e.target.checked ? [...c.attributen, nieuwStandaard(st)] : c.attributen.filter((x) => x.standaard !== st.sleutel) }))}
                        />
                        <span>
                          <b>{st.label}</b>
                          <span className="ab-klein ab-blok-regel">{st.toelichting}{st.alleenBijBlijvend ? ` ${tt("alleenBlijvend")}` : ""}</span>
                          <span className="ab-klein ab-grijs ab-blok-regel">{tt("bron")}: {st.bron}</span>
                        </span>
                      </label>
                      {a && (
                        <>
                          <AttribuutBewerken
                            a={a}
                            st={st}
                            kan={kan}
                            zet={(n) => zetConfig((c) => ({ ...c, attributen: c.attributen.map((x) => (x.standaard === st.sleutel ? n : x)) }))}
                            weg={() => zetConfig((c) => ({ ...c, attributen: c.attributen.filter((x) => x.standaard !== st.sleutel) }))}
                          />
                          {(problemen ?? []).filter((p) => p.sleutel === a.sleutel).map((p, k) => <p key={k} className={`md-probleem ${p.ernst}`}>{p.melding}</p>)}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
          </div>
          ))}
        </div>

        <Heading3>{tt("eigenKop")}</Heading3>
        {config.attributen.filter((a) => !a.standaard).length === 0 && <Paragraph className="ab-klein">{tt("geenAttributen")}</Paragraph>}
        <ol className="md-velden">
          {config.attributen.map((a, i) => a.standaard ? null : (
            <li key={a.sleutel} className="md-veld">
              <AttribuutBewerken
                a={a}
                kan={kan}
                zet={(n) => zetConfig((c) => ({ ...c, attributen: c.attributen.map((x, j) => (j === i ? n : x)) }))}
                weg={() => zetConfig((c) => ({ ...c, attributen: c.attributen.filter((_, j) => j !== i) }))}
              />
              {(problemen ?? []).filter((p) => p.sleutel === a.sleutel).map((p, k) => <p key={k} className={`md-probleem ${p.ernst}`}>{p.melding}</p>)}
            </li>
          ))}
        </ol>
        {kan && <NieuwAttribuut bestaand={new Set([...config.attributen.map((a) => a.sleutel), ...STANDAARDATTRIBUTEN.map((x) => x.sleutel)])} voegToe={(a) => zetConfig((c) => ({ ...c, attributen: [...c.attributen, a] }))} />}
      </section>

      {/* 5. Controleren en publiceren */}
      <section aria-labelledby="cl-stap5" className="cl-sectie">
        <Heading2 id="cl-stap5">{tt("stap5")}</Heading2>
        {problemen && (problemen.length === 0 ? (
          <Alert type="ok"><Paragraph>{tt("klopt")}</Paragraph></Alert>
        ) : (
          <ul className="md-problemen">
            {problemen.map((p, n) => (
              <li key={n} className={p.ernst}>
                <StatusBadge status={p.ernst === "fout" ? "danger" : "warning"}>{p.ernst}</StatusBadge> {p.sleutel && /^\d/.test(p.sleutel) ? `${p.sleutel}: ` : ""}{p.melding}
              </li>
            ))}
          </ul>
        ))}
        {kan && (
          <div className="ab-formulier">
            <Paragraph className="ab-klein">{tt("publiceerUitleg")}</Paragraph>
            {gepland && <PlanningMelding gepland={gepland} actief={rijenVan(s).find((r) => r.actief) ?? null} pad={PAD} />}
            {!gepland && (
              <>
                <RedenVeld id="cl-reden" waarde={reden} zet={zetReden} />
                <IngangVeld id="cl-ingang" waarde={ingang} zet={zetIngang} />
                <div>
                  <PrimaryActionButton onClick={publiceer} disabled={bezig || !gewijzigd || fouten.length > 0 || reden.trim().length < 5}>
                    {bezig ? tt("bezig") : vervangt ? t("wijzigingOpslaan") : ingangVoorPlatform(ingang) ? t("plannen") : tt("publiceren")}
                  </PrimaryActionButton>
                </div>
              </>
            )}
          </div>
        )}
      </section>
      </div>

      <aside className="md-voorbeeld" aria-labelledby="cl-voorbeeld-titel">
        <Heading2 id="cl-voorbeeld-titel">{tt("voorbeeld")}</Heading2>
        <p className="ab-klein">{tt("voorbeeldUitleg")}</p>
        <Voorbeeld config={config} lijst={lijst} versie={vervangt ? `${tt("versie")} ${vervangt.versie}, ${taal() === "en" ? "changed" : "gewijzigd"}` : gewijzigd ? tt("versieNieuw") : `${tt("versie")} ${s.actief?.versie ?? ""}`} />
      </aside>
      </div>
    </>
  );
}

/**
 * Wat de medewerker in het paneel van de Office Assistent ziet bij
 * Classificeren, met dit model: de voorstellen van de assistent bij een
 * voorbeeldtekst, zoeken, en kiezen in stappen (procestype, resultaat,
 * uitwerking), zoals in oa-paneel. Daarna de gekozen klasse met de
 * bewaartermijn (met de afwijkingen van de gemeente), de eigen attributen en
 * wanneer het stuk vergrendeld wordt.
 */
type PvKlasse = Resultaat & { eigen: boolean };

const VOORBEELDTEKST = "Besluit op de aanvraag omgevingsvergunning voor het kappen van twee bomen aan de Kleverparkweg, met herplantplicht.";

function Voorbeeld({ config, lijst, versie }: { config: Config; lijst: Selectielijst; versie: string }) {
  const en = taal() === "en";
  const afw = useMemo(() => new Map((config.afwijkingen ?? []).map((a) => [a.resultaat, a])), [config.afwijkingen]);
  // Wat de medewerker kan kiezen: aan staan, met de termijn van de gemeente.
  const beschikbaar = useMemo<PvKlasse[]>(() => {
    const uit = new Set(config.uitgezet ?? []);
    const termen = new Map((config.zoektermen ?? []).map((z) => [z.resultaat, z.termen]));
    return lijst.resultaten.filter((r) => !uit.has(r.id)).map((r) => {
      const a = afw.get(r.id);
      const z = termen.get(r.id)?.length ? { zoektermen: termen.get(r.id) } : {};
      return a ? { ...r, ...z, waardering: a.waardering ?? r.waardering, bewaartermijn: (a.waardering ?? r.waardering) === "blijvend-bewaren" ? undefined : (a.bewaartermijn ?? r.bewaartermijn), eigen: true } : { ...r, ...z, eigen: false };
    });
  }, [lijst, config.uitgezet, config.zoektermen, afw]);
  // Ondersteunend: per categorie een klasse (ondersteunend.O3), of één zonder categorieën.
  const steun = useMemo<(PvKlasse & { code: string | null })[]>(
    () => steunKlassen(config.ondersteunend).map((k) => ({ id: k.id, code: k.code, procestype: 0, generiek: null, naam: k.naam, omschrijving: k.code ?? "", waardering: "vernietigen", procestermijn: "nihil", bewaartermijn: k.bewaartermijn, toelichting: k.voorbeelden, eigen: false })),
    [config.ondersteunend],
  );
  const vragen = config.ondersteunend?.toetsvragen ?? [];
  const [bevestigd, zetBevestigd] = useState(false);
  const takken = useMemo(() => boom(beschikbaar, lijst.procestypen), [beschikbaar, lijst]);
  const pt = useMemo(() => new Map(lijst.procestypen.map((p) => [p.nummer, p])), [lijst]);
  const [tekst, zetTekst] = useState(VOORBEELDTEKST);
  const voorstellen = useMemo(() => suggesties(tekst, beschikbaar, lijst.procestypen), [tekst, beschikbaar, lijst]);
  const [vraag, zetVraag] = useState("");
  const gevonden = useMemo(() => zoek(beschikbaar, lijst.procestypen, vraag), [beschikbaar, lijst, vraag]);
  const [pad, zetPad] = useState<{ procestype: number | null; groep: string | null }>({ procestype: null, groep: null });
  const [keuze, zetKeuze] = useState<string | null>(null);
  const isSteun = (id: string | null | undefined) => !!id && (id === "ondersteunend" || id.startsWith("ondersteunend."));
  const gekozenSteun = steun.find((k) => k.id === keuze) ?? null;
  const gekozen: PvKlasse | null = (isSteun(keuze) ? gekozenSteun : beschikbaar.find((r) => r.id === keuze)) ?? null;
  const steunKop = (k: { code: string | null; naam: string }) => (k.code ? `${en ? "Supporting" : "Ondersteunend"} · ${k.code} ${k.naam}` : en ? "Supporting, without archival value" : "Ondersteunend, zonder archiefwaarde");
  const kies = (r: PvKlasse) => {
    zetKeuze(r.id);
    if (vraag) {
      zetPad({ procestype: r.procestype, groep: r.generiek ?? (beschikbaar.some((x) => x.generiek === r.id) ? r.id : null) });
      zetVraag("");
    }
  };
  const tak = takken.find((t) => t.procestype.nummer === pad.procestype);
  const groep = tak?.groepen.find((g) => g.id === pad.groep);
  const procesobject = gekozen && pt.get(gekozen.procestype)?.procesobject;

  const klasse = (r: PvKlasse, onder?: string) => (
    <li key={r.id}>
      <button type="button" className={r.id === keuze ? "gekozen" : ""} aria-pressed={r.id === keuze} onClick={() => kies(r)}>
        <span><b>{r.id}</b> {r.naam}{r.omschrijving ? ` · ${r.omschrijving}` : ""}</span>
        <span className="cl-pv-klein">{pt.get(r.procestype)?.naam} · {termijn(r)}{r.eigen ? (en ? " (own term)" : " (eigen termijn)") : ""}</span>
        {onder && <span className="cl-pv-klein cl-pv-waarom">{onder}</span>}
      </button>
    </li>
  );
  const stap = (sleutel: string, kop: ReactNode, onder: string, ga: () => void) => (
    <li key={sleutel}>
      <button type="button" className="cl-pv-stap" onClick={ga}>
        <span>{kop}</span>
        <span className="cl-pv-klein">{onder}</span>
      </button>
    </li>
  );

  const bewaren = !gekozen
    ? ""
    : gekozenSteun
      ? `${en ? "Destroy" : "Vernietigen"} ${duur(gekozen.bewaartermijn)} ${tt("naClassificeren")} (${config.ondersteunend?.grondslag || "—"}).`
    : gekozen.waardering === "blijvend-bewaren"
      ? en ? "Keep permanently: the document goes to the archive." : "Blijvend bewaren: het stuk gaat naar het archief."
      : `${en ? "Destroy" : "Vernietigen"} ${gekozen.bewaartermijn ? (en ? `after ${duur(gekozen.bewaartermijn)}` : `na ${duur(gekozen.bewaartermijn)}`) : `(${gekozen.bewaartermijnTekst ?? "zie toelichting"})`}, ${
          gekozen.procestermijn === "nihil"
            ? en ? `counted from status "${config.termijnStartBij}".` : `te rekenen vanaf de status ‘${config.termijnStartBij}’.`
            : en ? "counted from the end date of the process object." : `te rekenen vanaf de einddatum van ${procesobject ? procesobject.toLowerCase() : "het procesobject"}.`
        }`;

  return (
    <>
      <FormField label={<FormLabel htmlFor="cl-pv-tekst">{tt("voorbeeldTekst")}</FormLabel>} description={tt("voorbeeldTekstUitleg")}>
        <Textarea id="cl-pv-tekst" rows={3} value={tekst} onChange={(e) => zetTekst(e.target.value)} />
      </FormField>
      <div className="md-paneel cl-paneel">
        <div className="md-paneel-kop">{en ? "Classify" : "Classificeren"}</div>
        <div className="md-paneel-sub">{en ? "Where it belongs, and how long we keep it" : "Waar het hoort, en hoe lang we het bewaren"}</div>
        <div className="md-paneel-model">{config.naam?.trim() || lijst.naam} · {versie}</div>
        {beschikbaar.length === 0 ? (
          <p className="md-paneel-hulp">{en ? "No classes are switched on: the user cannot classify." : "Er staan geen klassen aan: de medewerker kan niet classificeren."}</p>
        ) : (
          <>
            <div className="cl-pv-kop">{en ? "Suggested by the assistant" : "Voorstel van de assistent"}</div>
            {voorstellen.length ? (
              <ul className="cl-pv-klassen">{voorstellen.map((v) => klasse(v.resultaat, `${en ? "Based on" : "Op grond van"}: ${v.woorden.join(", ")}`))}</ul>
            ) : (
              <p className="md-paneel-hulp">{en ? "No suggestion: no words that fit a class. Search or choose below." : "Geen voorstel: de assistent vond geen woorden die bij een klasse passen. Zoek of kies hieronder."}</p>
            )}

            <div className="cl-pv-kop">{en ? "Choose yourself" : "Zelf kiezen"}</div>
            <label className="md-paneel-label" htmlFor="cl-pv-zoek">{en ? "Search the retention schedule" : "Zoek in de selectielijst"}</label>
            <input id="cl-pv-zoek" type="search" className="cl-pv-zoek" value={vraag} placeholder={en ? "12.2 or: permit felling" : "12.2 of: vergunning kappen"} onChange={(e) => zetVraag(e.target.value)} autoComplete="off" />
            {vraag ? (
              gevonden.length ? <ul className="cl-pv-klassen">{gevonden.slice(0, 12).map((r) => klasse(r, `${r.procestype}. ${pt.get(r.procestype)?.naam ?? ""}`))}</ul> : <p className="md-paneel-hulp">{en ? "Nothing found." : "Niets gevonden."}</p>
            ) : (
              <>
                <nav className="cl-pv-kruimel" aria-label={en ? "Where you are" : "Waar je bent"}>
                  <button type="button" disabled={!tak} onClick={() => zetPad({ procestype: null, groep: null })}>{en ? "All process types" : "Alle procestypen"}</button>
                  {tak && <>› <button type="button" disabled={!groep} onClick={() => zetPad({ procestype: tak.procestype.nummer, groep: null })}>{tak.procestype.nummer}. {tak.procestype.naam}</button></>}
                  {groep && <>› <b>{groep.id} {groep.naam}</b></>}
                </nav>
                <ul className="cl-pv-klassen cl-pv-lijst">
                  {!tak
                    ? takken.map((t) => stap(`p${t.procestype.nummer}`, <><b>{t.procestype.nummer}.</b> {t.procestype.naam}</>, `${t.aantal} ${t.aantal === 1 ? (en ? "class" : "klasse") : (en ? "classes" : "klassen")}`, () => zetPad({ procestype: t.procestype.nummer, groep: null })))
                    : !groep
                      ? tak.groepen.map((g) =>
                          g.uitwerkingen.length === 0 && g.zelf
                            ? klasse(g.zelf)
                            : stap(`g${g.id}`, <><b>{g.id}</b> {g.naam}{g.omschrijving ? ` · ${g.omschrijving}` : ""}</>, `${g.uitwerkingen.length} ${g.uitwerkingen.length === 1 ? (en ? "refinement" : "uitwerking") : (en ? "refinements" : "uitwerkingen")}${g.zelf ? (en ? " and the result in general" : " en het resultaat in het algemeen") : ""}`, () => zetPad({ procestype: tak.procestype.nummer, groep: g.id })))
                      : [...(groep.zelf ? [klasse(groep.zelf, en ? "In general: if no refinement below fits" : "In het algemeen: als geen uitwerking hieronder past")] : []), ...groep.uitwerkingen.map((r) => klasse(r))]}
                </ul>
              </>
            )}
            {steun.length > 0 && (
              <>
                <div className="cl-pv-kop">{en ? "Not part of a process?" : "Geen onderdeel van een proces?"}</div>
                <p className="md-paneel-hulp">{config.ondersteunend?.omschrijving}</p>
                {vragen.length > 0 && (
                  <div className="cl-pv-toets">
                    <p className="md-paneel-hulp"><b>{en ? "Check first." : "Eerst nagaan."}</b> {tt("nietOndersteunend")}</p>
                    <ol>{vragen.map((q, i) => <li key={i}>{q || "…"}</li>)}</ol>
                    <label className="cl-pv-vink">
                      <input type="checkbox" checked={bevestigd} onChange={(e) => { zetBevestigd(e.target.checked); if (!e.target.checked && isSteun(keuze)) zetKeuze(null); }} />
                      <span>{tt("geenVanDeze")}</span>
                    </label>
                  </div>
                )}
                {(bevestigd || vragen.length === 0) && (
                  <ul className="cl-pv-klassen">
                    {steun.map((k) => (
                      <li key={k.id}>
                        <button type="button" className={keuze === k.id ? "gekozen" : ""} aria-pressed={keuze === k.id} onClick={() => zetKeuze(k.id)}>
                          <span>{k.code ? <><b>{k.code}</b> {k.naam || "…"}</> : <><b>{en ? "Supporting" : "Ondersteunend"}</b>, {en ? "without archival value" : "zonder archiefwaarde"}</>}</span>
                          {k.code && <span className="cl-pv-klein">{k.toelichting}</span>}
                          <span className="cl-pv-klein">{en ? "destroy" : "vernietigen"} {duur(k.bewaartermijn)} {tt("naClassificeren")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {gekozen && (
              <div className="cl-pv-gekozen">
                <div className="cl-pv-titel">{gekozenSteun ? steunKop(gekozenSteun) : `${gekozen.id} ${gekozen.naam}`}</div>
                {gekozenSteun
                  ? <div className="md-paneel-hulp">{gekozenSteun.code && <>{gekozenSteun.toelichting} </>}{en ? "Basis" : "Grondslag"}: {config.ondersteunend?.grondslag || "—"}</div>
                  : <div className="md-paneel-hulp">{gekozen.procestype}. {pt.get(gekozen.procestype)?.naam}{gekozen.omschrijving ? ` · ${gekozen.omschrijving}` : ""}</div>}
                <span className={`cl-pv-badge${gekozen.waardering === "blijvend-bewaren" ? " bewaren" : ""}`}>{termijn(gekozen)}</span>
                {gekozen.eigen && <div className="md-paneel-hulp">{en ? "Deviation from the schedule" : "Afwijking van de selectielijst"}: {afw.get(gekozen.id)?.reden || "—"}</div>}
                {gekozen.waardering === "vernietigen" && gekozen.procestermijn !== "nihil" && (
                  <div className="md-paneel-veld">
                    <div className="md-paneel-label">{gekozen.procestermijn === "vervaldatum" ? (en ? "Expiry date" : "Vervaldatum") : (en ? "End date of the process object" : "Einddatum van het procesobject")}</div>
                    <div className="md-paneel-invoer datum">dd-mm-jjjj</div>
                  </div>
                )}
                {config.attributen.filter((a) => !standaardVan(a)?.alleenBijBlijvend || gekozen.waardering === "blijvend-bewaren").map((a) => (
                  <div key={a.sleutel} className="md-paneel-veld">
                    <div className="md-paneel-label">{a.label || a.sleutel}{a.verplicht ? (en ? " (required)" : " (verplicht)") : ""}</div>
                    {a.beschrijving && <div className="md-paneel-hulp">{a.beschrijving}</div>}
                    {a.standaard === "persoonsgegevens" && a.koppeling && Object.keys(a.koppeling).length > 0 && (
                      <div className="md-paneel-hulp cl-pv-voorstel">{en ? "The assistant suggests an option from the personal data it finds." : "De assistent stelt een keuze voor op grond van de persoonsgegevens die hij vindt."}</div>
                    )}
                    {a.type === "tekst" ? <div className="md-paneel-invoer" /> : <div className="md-paneel-invoer keuze">{en ? "Choose…" : "Kies…"}</div>}
                  </div>
                ))}
                <p className="cl-pv-bewaren">{bewaren}</p>
                {config.vergrendelBij.length > 0 && (
                  <p className="md-paneel-hulp">🔒 {en ? "Locked once the status is" : "Vergrendeld zodra de status"} {config.vergrendelBij.map((x) => `‘${x}’`).join(en ? " or " : " of ")}{en ? "." : " is."}</p>
                )}
                <div className="md-paneel-knop">{en ? "Record classification" : "Classificatie vastleggen"}</div>
              </div>
            )}
            <p className="md-paneel-hulp cl-pv-voet">
              {en ? "The retention period comes from the" : "De bewaartermijn komt uit de"} {lijst.naam}{(config.afwijkingen?.length ?? 0) > 0 ? (en ? ", with your municipality's deviations." : ", met de afwijkingen van je gemeente.") : "."}
            </p>
          </>
        )}
      </div>
    </>
  );
}

function AttribuutBewerken({ a, st, kan, zet, weg }: { a: Attribuut; st?: StandaardAttribuut; kan: boolean; zet: (a: Attribuut) => void; weg: () => void }) {
  const id = `cl-a-${a.sleutel}`;
  // Een keuze hernoemen: de koppeling gaat mee (zelfde plek in de lijst).
  const zetOpties = (nieuw: string[]) => {
    const oud = a.opties ?? [];
    const koppeling = a.koppeling && nieuw.length === oud.length
      ? Object.fromEntries(Object.entries(a.koppeling).map(([k, w]) => [k, oud.indexOf(w) >= 0 ? nieuw[oud.indexOf(w)]! : w]))
      : a.koppeling;
    zet({ ...a, opties: nieuw, ...(koppeling ? { koppeling } : {}) });
  };
  return (
    <div className={`cl-attribuut${st ? " cl-attribuut-st" : ""}`}>
      <div className="md-twee">
        <FormField label={<FormLabel htmlFor={`${id}-label`}>{tt("label")}</FormLabel>} description={`${tt("sleutel")}: ${a.sleutel}`}>
          <Textbox id={`${id}-label`} value={a.label} maxLength={100} disabled={!kan} onChange={(e) => zet({ ...a, label: e.target.value })} />
        </FormField>
        <FormField label={<FormLabel htmlFor={`${id}-soort`}>{tt("soort")}</FormLabel>} description={st ? tt("vasteSoort") : undefined}>
          <Select id={`${id}-soort`} value={a.type} disabled={!kan || !!st} onChange={(e) => zet({ ...a, type: e.target.value as AttribuutType })}>
            <SelectOption value="tekst">{tt("tekst")}</SelectOption>
            <SelectOption value="keuze">{tt("keuze")}</SelectOption>
            <SelectOption value="ja-nee">{tt("janee")}</SelectOption>
          </Select>
        </FormField>
      </div>
      {a.type === "keuze" && (
        <FormField label={<FormLabel htmlFor={`${id}-opties`}>{tt("opties")}</FormLabel>}>
          <Textarea id={`${id}-opties`} rows={Math.min(6, Math.max(3, (a.opties ?? []).length))} disabled={!kan} value={(a.opties ?? []).join("\n")} onChange={(e) => zetOpties(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
        </FormField>
      )}
      {!!st?.betekenissen?.length && (
        <div className="cl-koppeling">
          <div className="cl-koppeling-kop"><b>{tt("koppelingKop")}</b> <span className="ab-klein">{tt("koppelingUitleg")}</span></div>
          {st.betekenissen.map((b) => (
            <label key={b.code} className="cl-koppeling-regel">
              <span>{b.uitleg}</span>
              <span aria-hidden="true">→</span>
              <Select
                value={a.koppeling?.[b.code] ?? ""}
                disabled={!kan}
                onChange={(e) => {
                  const k = { ...(a.koppeling ?? {}) };
                  if (e.target.value) k[b.code] = e.target.value; else delete k[b.code];
                  zet({ ...a, koppeling: k });
                }}
              >
                <SelectOption value="">{tt("geenVoorstel")}</SelectOption>
                {(a.opties ?? []).map((o) => <SelectOption key={o} value={o}>{o}</SelectOption>)}
              </Select>
            </label>
          ))}
        </div>
      )}
      <FormField label={<FormLabel htmlFor={`${id}-hulp`}>{tt("hulptekst")}</FormLabel>}>
        <Textbox id={`${id}-hulp`} value={a.beschrijving ?? ""} maxLength={500} disabled={!kan} onChange={(e) => zet({ ...a, beschrijving: e.target.value || undefined })} />
      </FormField>
      <div className="ab-knoppen">
        <label className="cl-vink">
          <Checkbox checked={a.verplicht} disabled={!kan} onChange={(e) => zet({ ...a, verplicht: e.target.checked })} /> {tt("verplicht")}
        </label>
        {kan && !st && <SecondaryActionButton onClick={weg}>{tt("verwijder")}</SecondaryActionButton>}
      </div>
    </div>
  );
}

function NieuwAttribuut({ bestaand, voegToe }: { bestaand: Set<string>; voegToe: (a: Attribuut) => void }) {
  const [label, zetLabel] = useState("");
  const [type, zetType] = useState<AttribuutType>("keuze");
  const sleutel = sleutelUit(label);
  const dubbel = bestaand.has(sleutel);
  return (
    <div className="md-nieuw">
      <Heading3>{tt("toevoegen")}</Heading3>
      <div className="md-twee">
        <FormField label={<FormLabel htmlFor="cl-nieuw-label">{tt("label")}</FormLabel>} description={label ? `${tt("sleutel")}: ${sleutel}` : undefined}>
          <Textbox id="cl-nieuw-label" value={label} maxLength={100} onChange={(e) => zetLabel(e.target.value)} />
        </FormField>
        <FormField label={<FormLabel htmlFor="cl-nieuw-soort">{tt("soort")}</FormLabel>}>
          <Select id="cl-nieuw-soort" value={type} onChange={(e) => zetType(e.target.value as AttribuutType)}>
            <SelectOption value="keuze">{tt("keuze")}</SelectOption>
            <SelectOption value="tekst">{tt("tekst")}</SelectOption>
            <SelectOption value="ja-nee">{tt("janee")}</SelectOption>
          </Select>
        </FormField>
      </div>
      <div>
        <SecondaryActionButton
          disabled={!label.trim() || dubbel}
          onClick={() => {
            voegToe({ sleutel, label: label.trim(), type, verplicht: false, ...(type === "keuze" ? { opties: [] } : {}) });
            zetLabel("");
          }}
        >
          {tt("toevoegen")}
        </SecondaryActionButton>
      </div>
    </div>
  );
}

/** Een vinkje dat ook "deels" kan tonen (een groep waarvan een deel kiesbaar is). */
function Vinkje({ aan, half, disabled, zet, label }: { aan: boolean; half: boolean; disabled: boolean; zet: (aan: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = half; }, [half]);
  return <Checkbox ref={ref} checked={aan} disabled={disabled} aria-checked={half ? "mixed" : aan} aria-label={label} onChange={(e) => zet(half ? true : e.target.checked)} />;
}

/** Het pijltje om een tak van de boom open of dicht te klappen. */
function Klapper({ open, wissel, label }: { open: boolean; wissel: () => void; label: string }) {
  return <button type="button" className={`cl-klapper${open ? " open" : ""}`} aria-expanded={open} aria-label={`${label} ${open ? "inklappen" : "uitklappen"}`} onClick={wissel} />;
}

/** Zoektermen bij één klasse, gescheiden door komma's. */
function TermenBewerken({ id, termen, zet }: { id: string; termen: string[]; zet: (t: string[]) => void }) {
  const [tekst, zetTekst] = useState(termen.join(", "));
  const lees = (t: string) => [...new Set(t.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 20);
  return (
    <div className="md-bewerk">
      <FormField label={<FormLabel htmlFor={`cl-z-${id}`}>{tt("zoektermen")}</FormLabel>} description={tt("zoektermenUitleg")}>
        <Textbox id={`cl-z-${id}`} value={tekst} maxLength={900} placeholder="collegevoorstel, nota" onChange={(e) => { zetTekst(e.target.value); zet(lees(e.target.value)); }} />
      </FormField>
    </div>
  );
}

/** Een termijn in maanden of jaren, als ISO 8601-duur (P6M, P1Y). */
function DuurVeld({ id, waarde, zet, disabled }: { id: string; waarde: string; zet: (d: string) => void; disabled: boolean }) {
  const n = /^P(\d+)[YM]$/.exec(waarde)?.[1] ?? "";
  const eenheid = waarde.endsWith("M") ? "M" : "Y";
  return (
    <div className="cl-duur">
      <Textbox id={id} type="number" min={1} max={120} disabled={disabled} value={n} onChange={(e) => zet(`P${Math.max(1, Math.round(Number(e.target.value) || 1))}${eenheid}`)} />
      <Select aria-label={tt("eenheid")} disabled={disabled} value={eenheid} onChange={(e) => zet(`P${n || "1"}${e.target.value}`)}>
        <SelectOption value="M">{tt("maanden")}</SelectOption>
        <SelectOption value="Y">{tt("jaarEenheid")}</SelectOption>
      </Select>
    </div>
  );
}

/**
 * Ondersteunende stukken: een omschrijving, de grondslag, de categorieën met
 * elk een termijn, en de toetsvragen. Of één termijn, zonder categorieën.
 */
function OndersteunendBewerken({ o, kan, zet }: { o: Ondersteunend; kan: boolean; zet: (f: (o: Ondersteunend) => Ondersteunend) => void }) {
  const [geladen, zetGeladen] = useState(false);
  const cats = o.categorieen ?? [];
  const vragen = o.toetsvragen ?? [];
  const zetCat = (i: number, k: Partial<NonNullable<Ondersteunend["categorieen"]>[number]>) =>
    zet((x) => ({ ...x, categorieen: (x.categorieen ?? []).map((c, j) => (j === i ? { ...c, ...k } : c)) }));
  const zetVraag = (i: number, v: string) => zet((x) => ({ ...x, toetsvragen: (x.toetsvragen ?? []).map((q, j) => (j === i ? v : q)) }));
  return (
    <div className="md-bewerk cl-ondersteunend">
      {kan && (
        <div className="cl-opzet">
          <SecondaryActionButton
            type="button"
            onClick={() => {
              zet(() => structuredClone(OPZET));
              zetGeladen(true);
            }}
          >
            {tt("opzetLaden")}
          </SecondaryActionButton>
          <Paragraph className="ab-klein">{geladen ? tt("opzetGeladen") : tt("opzetUitleg")}</Paragraph>
        </div>
      )}
      <FormField label={<FormLabel htmlFor="cl-o-oms">{tt("ondersteunendOms")}</FormLabel>} description={tt("ondersteunendOmsUitleg")}>
        <Textarea id="cl-o-oms" rows={2} maxLength={1000} disabled={!kan} value={o.omschrijving} onChange={(e) => zet((x) => ({ ...x, omschrijving: e.target.value }))} />
      </FormField>
      <FormField label={<FormLabel htmlFor="cl-o-g">{tt("ondersteunendGrondslag")}</FormLabel>} description={tt("ondersteunendGrondslagUitleg")}>
        <Textbox id="cl-o-g" maxLength={300} disabled={!kan} value={o.grondslag} placeholder={tt("ondersteunendGrondslagVoorbeeld")} onChange={(e) => zet((x) => ({ ...x, grondslag: e.target.value }))} />
      </FormField>

      <Heading3>{tt("categorieen")}</Heading3>
      <Paragraph className="ab-klein">{tt("categorieenUitleg")}</Paragraph>
      {cats.length === 0 ? (
        <FormField label={<FormLabel htmlFor="cl-o-n">{tt("ondersteunendTermijn")}</FormLabel>} description={tt("ondersteunendTermijnUitleg")}>
          <DuurVeld id="cl-o-n" waarde={o.bewaartermijn ?? "P1Y"} disabled={!kan} zet={(d) => zet((x) => ({ ...x, bewaartermijn: d }))} />
        </FormField>
      ) : (
        <ol className="cl-cats">
          {cats.map((k, i) => (
            <li key={i} className="cl-cat">
              <div className="cl-cat-kop">
                <FormField label={<FormLabel htmlFor={`cl-c-${i}-code`}>{tt("code")}</FormLabel>}>
                  <Textbox id={`cl-c-${i}-code`} className="cl-cat-code" maxLength={6} disabled={!kan} value={k.code} onChange={(e) => zetCat(i, { code: e.target.value.toUpperCase() })} />
                </FormField>
                <FormField label={<FormLabel htmlFor={`cl-c-${i}-naam`}>{tt("naamKop")}</FormLabel>}>
                  <Textbox id={`cl-c-${i}-naam`} maxLength={100} disabled={!kan} value={k.naam} onChange={(e) => zetCat(i, { naam: e.target.value })} />
                </FormField>
                <FormField label={<FormLabel htmlFor={`cl-c-${i}-n`}>{tt("ondersteunendTermijn")}</FormLabel>}>
                  <DuurVeld id={`cl-c-${i}-n`} waarde={k.bewaartermijn} disabled={!kan} zet={(d) => zetCat(i, { bewaartermijn: d })} />
                </FormField>
              </div>
              <FormField label={<FormLabel htmlFor={`cl-c-${i}-vb`}>{tt("voorbeelden")}</FormLabel>}>
                <Textarea id={`cl-c-${i}-vb`} rows={2} maxLength={1000} disabled={!kan} value={k.voorbeelden} onChange={(e) => zetCat(i, { voorbeelden: e.target.value })} />
              </FormField>
              {kan && (
                <button type="button" className="ab-linkknop ab-rood" onClick={() => zet((x) => {
                  const rest = (x.categorieen ?? []).filter((_, j) => j !== i);
                  return { ...x, categorieen: rest, ...(rest.length ? {} : { bewaartermijn: x.bewaartermijn ?? k.bewaartermijn }) };
                })}>
                  {tt("verwijder")} {k.code}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {kan && (
        <SubtleButton type="button" onClick={() => zet((x) => {
          const { bewaartermijn, ...rest } = x;
          return { ...rest, categorieen: [...(x.categorieen ?? []), { code: volgendeCode(x), naam: "", voorbeelden: "", bewaartermijn: bewaartermijn ?? "P1Y" }] };
        })}>
          + {tt("categorieToevoegen")}
        </SubtleButton>
      )}

      <Heading3>{tt("toetsvragen")}</Heading3>
      <Paragraph className="ab-klein">{tt("toetsvragenUitleg")}</Paragraph>
      {vragen.length === 0 ? (
        <Paragraph className="ab-klein">{tt("geenToetsvragen")}</Paragraph>
      ) : (
        <ol className="cl-vragen">
          {vragen.map((v, i) => (
            <li key={i}>
              <Textarea aria-label={`${tt("toetsvragen")} ${i + 1}`} rows={2} maxLength={300} disabled={!kan} value={v} onChange={(e) => zetVraag(i, e.target.value)} />
              {kan && (
                <button type="button" className="ab-linkknop ab-rood" aria-label={`${tt("verwijder")} ${i + 1}`} onClick={() => zet((x) => ({ ...x, toetsvragen: (x.toetsvragen ?? []).filter((_, j) => j !== i) }))}>
                  {tt("verwijder")}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {kan && (
        <SubtleButton type="button" onClick={() => zet((x) => ({ ...x, toetsvragen: [...(x.toetsvragen ?? []), ""] }))}>
          + {tt("toetsvraagToevoegen")}
        </SubtleButton>
      )}
    </div>
  );
}
