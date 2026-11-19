/**
 * De standaardattributen: dezelfde catalogus als in oa-contract
 * (STANDAARDATTRIBUTEN, nieuwStandaardAttribuut). Het portaal hangt daar niet
 * van af; verandert de catalogus daar, neem hem dan hier over.
 */

export type Soort = "tekst" | "keuze" | "ja-nee";
export interface StandaardAttribuut {
  sleutel: string;
  groep: "Privacy" | "Informatiebeveiliging" | "Archief" | "Continuïteit";
  label: string;
  type: Soort;
  opties?: string[];
  beschrijving: string;
  toelichting: string;
  bron: string;
  alleenBijBlijvend?: boolean;
  betekenissen?: { code: string; uitleg: string; standaard: string }[];
}

export const STANDAARDATTRIBUTEN: readonly StandaardAttribuut[] = [
  {
    "sleutel": "persoonsgegevens",
    "groep": "Privacy",
    "label": "Persoonsgegevens",
    "type": "keuze",
    "opties": [
      "Geen persoonsgegevens",
      "Gewone persoonsgegevens",
      "Met BSN",
      "Bijzondere persoonsgegevens (AVG art. 9)",
      "Strafrechtelijke gegevens (AVG art. 10)"
    ],
    "beschrijving": "Kies de zwaarste soort die in het stuk voorkomt.",
    "toelichting": "Of het stuk persoonsgegevens bevat, en welke. De assistent zoekt namen, adressen, BSN's en andere gegevens en stelt een keuze voor; de medewerker beslist. Bijzondere en strafrechtelijke gegevens herkent de assistent niet.",
    "bron": "AVG art. 4, 9 en 10; Uitvoeringswet AVG art. 46 (BSN)",
    "betekenissen": [
      {
        "code": "geen",
        "uitleg": "De assistent vond geen persoonsgegevens",
        "standaard": "Geen persoonsgegevens"
      },
      {
        "code": "gewoon",
        "uitleg": "De assistent vond persoonsgegevens, geen BSN",
        "standaard": "Gewone persoonsgegevens"
      },
      {
        "code": "bsn",
        "uitleg": "De assistent vond een BSN",
        "standaard": "Met BSN"
      }
    ]
  },
  {
    "sleutel": "bivBeschikbaarheid",
    "groep": "Informatiebeveiliging",
    "label": "Beschikbaarheid (BIV)",
    "type": "keuze",
    "opties": [
      "laag",
      "midden",
      "hoog"
    ],
    "beschrijving": "Hoe erg is het als dit stuk een tijd niet beschikbaar is?",
    "toelichting": "De B van de BIV-classificatie. De BIO stelt BIV meestal vast per proces of informatiesysteem; per stuk is het vooral nuttig als uitzondering.",
    "bron": "Baseline Informatiebeveiliging Overheid (BIO)"
  },
  {
    "sleutel": "bivIntegriteit",
    "groep": "Informatiebeveiliging",
    "label": "Integriteit (BIV)",
    "type": "keuze",
    "opties": [
      "laag",
      "midden",
      "hoog"
    ],
    "beschrijving": "Hoe erg is het als dit stuk onopgemerkt verandert?",
    "toelichting": "De I van de BIV-classificatie.",
    "bron": "Baseline Informatiebeveiliging Overheid (BIO)"
  },
  {
    "sleutel": "bivVertrouwelijkheid",
    "groep": "Informatiebeveiliging",
    "label": "Vertrouwelijkheid (BIV)",
    "type": "keuze",
    "opties": [
      "laag",
      "midden",
      "hoog"
    ],
    "beschrijving": "Hoe erg is het als dit stuk bij de verkeerde persoon komt?",
    "toelichting": "De V van de BIV-classificatie. Let op: het metadatamodel kent vaak al een vertrouwelijkheidsaanduiding. Zet dit alleen aan als die iets anders vastlegt, anders staat hetzelfde twee keer vast.",
    "bron": "Baseline Informatiebeveiliging Overheid (BIO)"
  },
  {
    "sleutel": "juridischeBewaarplicht",
    "groep": "Archief",
    "label": "Juridische bewaarplicht",
    "type": "keuze",
    "opties": [
      "Geen",
      "Woo-verzoek",
      "Bezwaar of beroep",
      "Klacht",
      "Andere procedure"
    ],
    "beschrijving": "Loopt er iets waarvoor het stuk bewaard moet blijven, ook na de bewaartermijn?",
    "toelichting": "Een lopend Woo-verzoek, bezwaar, klacht of procedure waarvoor het stuk van belang is. Zolang dat loopt, mag het niet vernietigd worden, ook niet na de bewaartermijn.",
    "bron": "Woo; Algemene wet bestuursrecht",
    "betekenissen": [
      {
        "code": "geen",
        "uitleg": "Er loopt niets",
        "standaard": "Geen"
      }
    ]
  },
  {
    "sleutel": "openbaarheidsbeperking",
    "groep": "Archief",
    "label": "Openbaarheidsbeperking",
    "type": "keuze",
    "opties": [
      "Geen beperking",
      "Eerbiediging van de persoonlijke levenssfeer",
      "Belang van de Staat of zijn bondgenoten",
      "Voorkomen van onevenredige bevoordeling of benadeling"
    ],
    "beschrijving": "Moet de openbaarheid beperkt worden als het stuk naar het archief gaat?",
    "toelichting": "Bij overbrenging naar de archiefbewaarplaats kan de openbaarheid tijdelijk worden beperkt, op een van de gronden uit de Archiefwet.",
    "bron": "Archiefwet, openbaarheidsbeperkingen bij overbrenging",
    "alleenBijBlijvend": true
  },
  {
    "sleutel": "hotspot",
    "groep": "Archief",
    "label": "Hotspot",
    "type": "ja-nee",
    "beschrijving": "Hoort het stuk bij een gebeurtenis die de gemeente als hotspot heeft aangewezen?",
    "toelichting": "Een hotspot is een gebeurtenis of kwestie met grote maatschappelijke betekenis. Stukken daarover kunnen blijvend bewaard worden, ook als de selectielijst vernietigen zegt.",
    "bron": "Selectielijst gemeenten 2020, toelichting (hotspots)"
  },
  {
    "sleutel": "vitaleInformatie",
    "groep": "Continuïteit",
    "label": "Vitale informatie",
    "type": "ja-nee",
    "beschrijving": "Is dit stuk nodig om de gemeente na een calamiteit weer aan het werk te krijgen?",
    "toelichting": "Informatie die nodig is voor de continuïteit van de dienstverlening, zoals noodplannen, sleutelregisters en contracten met leveranciers.",
    "bron": "BIO, bedrijfscontinuïteit"
  }
];

export const GROEPEN = [...new Set(STANDAARDATTRIBUTEN.map((s) => s.groep))];

export function standaardVan(a: { standaard?: string }): StandaardAttribuut | undefined {
  return a.standaard ? STANDAARDATTRIBUTEN.find((s) => s.sleutel === a.standaard) : undefined;
}

/** Aanzetten: met de keuzes en de koppeling uit de catalogus. */
export function nieuwStandaard(s: StandaardAttribuut) {
  return {
    sleutel: s.sleutel,
    standaard: s.sleutel,
    label: s.label,
    type: s.type,
    ...(s.opties ? { opties: [...s.opties] } : {}),
    verplicht: false,
    beschrijving: s.beschrijving,
    ...(s.betekenissen ? { koppeling: Object.fromEntries(s.betekenissen.map((b) => [b.code, b.standaard])) } : {}),
  };
}
