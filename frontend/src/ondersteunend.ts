/**
 * Ondersteunende stukken: de opzet als vertrekpunt en de klassen die de
 * medewerker in het paneel ziet. Dezelfde gegevens en dezelfde ids als in
 * oa-contract (OPZET_ONDERSTEUNEND, ondersteunendeKlassen); het portaal hangt
 * daar niet van af, dus verandert het daar, pas het dan hier ook aan.
 */

export interface Categorie { code: string; naam: string; voorbeelden: string; bewaartermijn: string }
export interface Ondersteunend {
  omschrijving: string;
  /** Alleen zonder categorieën: één termijn voor alle ondersteunende stukken. */
  bewaartermijn?: string;
  grondslag: string;
  categorieen?: Categorie[];
  toetsvragen?: string[];
}

/**
 * Vijf categorieën en vijf toetsvragen, naar de Archiefwet (art. 1c), de
 * Handreiking Selectielijst 2020 (§4.4), Het kaf en het koren (2024) en de
 * Australische Normal Administrative Practice. Een voorstel; de gemeente
 * stelt de termijnen en de grondslag vast.
 */
export const OPZET: Ondersteunend = {
  omschrijving: "Stukken die niet bij een proces horen en geen archiefwaarde hebben. Twijfel je, kies dan een klasse uit de selectielijst.",
  grondslag: "Opzet ondersteunende informatie, Office Assistent 2026 (vertrekpunt, niet vastgesteld)",
  categorieen: [
    { code: "O1", naam: "Geen archiefbescheiden", voorbeelden: "Reclame, nieuwsbrieven, abonnementen en vakbladen; rapporten en publicaties van anderen; gedownloade openbare stukken zoals wetten, normen en handreikingen.", bewaartermijn: "P1Y" },
    { code: "O2", naam: "Kopie of dubbel", voorbeelden: "Een kopie van een stuk dat elders is vastgelegd (in een zaak, het DMS of bij de afzender); een afdruk; een bijlage die ook in het DMS staat.", bewaartermijn: "P1Y" },
    { code: "O3", naam: "Tussenversie", voorbeelden: "Een versie die niet, of alleen binnen het eigen team, is gedeeld, van een stuk waarvan een latere versie elders is vastgelegd.", bewaartermijn: "P6M" },
    { code: "O4", naam: "Werkaantekening of hulpbestand", voorbeelden: "Eigen notities, een rekenblad voor een berekening, gespreksvoorbereiding, aantekeningen bij een overleg zonder afspraken.", bewaartermijn: "P1Y" },
    { code: "O5", naam: "Logistiek en routine", voorbeelden: "Vergaderuitnodigingen, zaalreserveringen, afstemming over planning, ontvangstbevestigingen.", bewaartermijn: "P6M" },
  ],
  toetsvragen: [
    "Is het stuk ter besluitvorming voorgelegd, of staat er een besluit, afspraak of toezegging in?",
    "Volgen er rechten of plichten uit, voor een inwoner, een bedrijf of de gemeente (een handtekening, een overeenkomst)?",
    "Is het het enige exemplaar van iets dat nergens anders is vastgelegd, zoals opmerkingen die in de eindversie ontbreken?",
    "Is het gebruikt bij de afhandeling van een zaak? Dan volgt het de klasse van de zaak.",
    "Loopt er een Woo-verzoek, bezwaar, klacht of procedure waarvoor het van belang kan zijn?",
  ],
};

/** Wat de medewerker kan kiezen: één klasse per categorie, of één zonder categorieën. */
export function steunKlassen(o: Ondersteunend | null | undefined): { id: string; code: string | null; naam: string; voorbeelden: string; bewaartermijn: string }[] {
  if (!o) return [];
  if (!o.categorieen?.length) return [{ id: "ondersteunend", code: null, naam: "Ondersteunend", voorbeelden: o.omschrijving, bewaartermijn: o.bewaartermijn ?? "" }];
  return o.categorieen.map((k) => ({ id: `ondersteunend.${k.code}`, code: k.code, naam: k.naam, voorbeelden: k.voorbeelden, bewaartermijn: k.bewaartermijn }));
}

/** De eerstvolgende vrije code: O1, O2, … */
export function volgendeCode(o: Ondersteunend): string {
  const bezet = new Set((o.categorieen ?? []).map((k) => k.code));
  let n = 1;
  while (bezet.has(`O${n}`)) n++;
  return `O${n}`;
}
