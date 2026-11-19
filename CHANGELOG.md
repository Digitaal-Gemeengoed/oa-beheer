# Wijzigingen

## 0.15.1 — 2026-11-19

- Standaardattributen: de groepen staan in twee vaste kolommen (Privacy en Informatiebeveiliging links, Archief en Continuïteit rechts). Geen witruimte meer tussen de rijen, en een groep die groeit als je een attribuut aanzet, verspringt niet.

## 0.15.0 — 2026-11-19

**Standaardattributen in stap 5 van het classificatiemodel.**
- Per groep (Privacy, Informatiebeveiliging, Archief, Continuïteit) een lijst om aan te zetten, met toelichting en bron. Label, keuzes, hulptekst en verplicht pas je aan; technische naam en soort liggen vast. Eigen attributen staan eronder, zoals voorheen; de sleutels van standaardattributen zijn daar niet te gebruiken.
- Persoonsgegevens: per betekenis kies je welke keuze de assistent voorstelt. Hernoem je een keuze, dan gaat de koppeling mee.
- Het voorbeeld vraagt de openbaarheidsbeperking alleen bij blijvend bewaren; de versiekaart merkt standaardattributen. De audit noemt welke standaardattributen aan staan.
- Een nieuwe versie neemt de attributen over zoals ze zijn ingesteld.

## 0.14.1 — 2026-11-19

- Dockerfile: `npm ci` met een BuildKit-cache voor npm, zodat een nieuwe versie niet alle pakketten opnieuw downloadt.

## 0.14.0 — 2026-11-19

**Ondersteunende stukken: categorieën, toetsvragen en een opzet als vertrekpunt.**
- Stap 4 van het classificatiemodel: per categorie code, naam, wat eronder valt en een termijn; een lijst toetsvragen; omschrijving en grondslag. Zonder categorieën blijft het één termijn.
- Knop **Opzet laden als vertrekpunt**: vijf categorieën en vijf toetsvragen (dezelfde als `OPZET_ONDERSTEUNEND` in oa-contract), om aan te passen en te publiceren.
- Het voorbeeld toont de toetsvragen met het vinkje en daarna de categorieën, zoals in het paneel. De versiekaart toont categorieën en toetsvragen.
- De audit noemt per categorie code en termijn en het aantal toetsvragen. Wijzigen vraagt, zoals eerder, `bewaartermijn.afwijken`.

## 0.13.0 — 2026-11-19

Classificatiemodel. Vereist opendop-mini 0.14.0 op VPS 2.

- **Zoektermen** per klasse: met de knop *Zoektermen* in de boom geef je woorden op die medewerkers gebruiken en die de selectielijst niet noemt ("collegevoorstel", "projectplan"). Ze staan als labels bij de klasse; zoeken in de boom vindt ze ook. De assistent en het zoeken in het paneel gebruiken ze, en het voorbeeld laat dat zien.
- **4. Ondersteunende stukken** (nieuwe stap): aan te zetten voor kopieën, kladversies, gedownloade stukken en stukken ter kennisname. Met wat eronder valt (de medewerker ziet die tekst), een bewaartermijn vanaf het classificeren (in maanden of jaren) en de grondslag: het besluit of de richtlijn van de gemeente. Aanzetten en wijzigen vraagt het recht `bewaartermijn.afwijken`, net als afwijken van de selectielijst. In het voorbeeld en op de versiepagina.
- De stappen *Eigen attributen* en *Controleren en publiceren* zijn nu 5 en 6.
- Audit: het aantal zoektermen, en termijn en grondslag van ondersteunende stukken.

## 0.12.1 — 2026-11-19

- Het voorbeeld naast de bewerker (metadatamodel en classificatiemodel) valt niet meer weg onder de rand van het scherm. Het blijft tussen de bovenbalk en de onderkant van het venster staan en scrolt als geheel; de lijst met procestypen heeft geen eigen schuifbalk meer.

## 0.12.0 — 2026-11-19

**Classificatiemodel: klassen als boom, en een voorbeeld dat werkt zoals het paneel.**

- Stap 3 heet nu *Klassen uit de selectielijst* en toont de selectielijst als boom: procestype, resultaat, uitwerkingen, met pijltjes om in en uit te klappen (*Alles uitklappen*, *Alles inklappen*). Elke regel is een klasse; het vinkje bepaalt of de medewerker hem in het paneel kan kiezen. Een vinkje bij een procestype of een resultaat met uitwerkingen zet alles eronder aan of uit, en toont een streepje als een deel aan staat. Bovenaan: hoeveel van de 344 klassen kiesbaar zijn. Zoeken klapt open wat past.
- Het voorbeeld *Zo ziet de medewerker het* is nu bruikbaar: een voorbeeldtekst die je kunt veranderen (de voorstellen van de assistent volgen, met de woorden waarop ze steunen), een zoekbalk, en kiezen in stappen zoals in het paneel (oa-paneel 0.14.0). Alleen klassen die aan staan, met de termijn van de gemeente.

## 0.11.0 — 2026-11-19

Vereist opendop-mini 0.13.0 op VPS 2.

**Voorbeeld bij het classificatiemodel.** Naast de bewerker staat nu, net als bij het metadatamodel, *Zo ziet de medewerker het*: het paneel Classificeren met dit model. Met de voorstellen van de assistent (eerst klassen met een eigen termijn), de bewaartermijn inclusief afwijkingen, de velden voor einddatum en eigen attributen, wanneer de termijn ingaat, wanneer het stuk vergrendeld wordt, en de knop *Classificatie vastleggen*. Klik op een klasse om haar als gekozen te zien.

**Een geplande versie wijzigen.** Een versie die nog niet is ingegaan, opent in de bewerker in plaats van alleen lezen. *Wijziging opslaan* maakt een nieuwe versie die de geplande vervangt, met de ingangsdatum die je opgeeft (die staat al ingevuld; ook alleen de datum verschuiven kan). De vervangen versie blijft in de lijst met de status *Vervangen — door versie N*. Zodra een versie in gebruik is, leidt elke wijziging nog steeds tot een nieuwe versie.

- Bovenaan de bewerker staat wat er gebeurt, met *Planning intrekken*.
- Wie de versie in gebruik bewerkt terwijl er een gepland staat, krijgt een link naar de geplande versie.
- Een geplande versie wijzigen gaat buiten het concept van het metadatamodel om.
- Audit: `vervangt` bij publiceren.

## 0.10.2 — 2026-11-19

**Instellingen: waarschuwing bij niet-opgeslagen invoer.**

- Heb je een instelling gewijzigd of een reden ingevuld en klik je op een andere regel (of op de open regel zelf, of Escape), dan klapt hij niet weg. In de open regel verschijnt *Niet opgeslagen* met *Verder bewerken* of *Wijziging weggooien*; pas na weggooien gaat de andere regel open.
- *Annuleren* blijft bewust weggooien, zonder extra vraag.
- Ook bij verversen of de pagina sluiten vraagt de browser eerst of je zeker weet dat je weg wilt.

## 0.10.1 — 2026-11-19

**Instellingen als compacte lijst.**

- De instellingen staan over de volle breedte in een lijst, gegroepeerd: *Aanmelden en sessies*, *Noodtoegang* en *Audit*. Per regel de omschrijving, de sleutel, de huidige waarde (met eenheid, ja/nee of een telling), of hij *Standaard* of *Aangepast* is, en wanneer hij voor het laatst is gewijzigd.
- Klik op een regel om hem uit te klappen en te wijzigen; er is altijd hoogstens één open. Waarde en reden staan naast elkaar, met *Terug naar de standaard*. *Opslaan* kan pas als er iets is gewijzigd en er een reden staat. Escape of *Annuleren* klapt hem weer in.
- Wie alleen mag kijken, ziet dezelfde lijst; uitklappen toont de waarde zonder te kunnen wijzigen.

## 0.10.0 — 2026-11-19

**Ingangsdatum voor een nieuwe modelversie** bij Metadatamodel en Classificatiemodel. Vereist opendop-mini 0.12.0 op VPS 2.

- Bij publiceren staat een veld **Ingangsdatum**. Leeg: de versie geldt meteen. Met een datum en tijd wordt de knop *Plannen*; de versie gaat dan vanzelf in, en tot die tijd blijft de huidige versie gelden.
- In de versielijst heeft een geplande versie de status **Gepland** (*gaat in op …*), en staat er een melding boven de lijst: welke versie wanneer ingaat en welke tot dan geldt. Op het overzicht staat het ook bij *Modellen*.
- Een geplande versie opent alleen lezen, met **Planning intrekken** (met reden, in de audit). Een ingetrokken versie blijft in de lijst staan, doorgestreept, met de status *Ingetrokken* en de reden.
- Zolang er een versie gepland staat, kun je geen volgende publiceren; de bewerker legt uit waarom.
- Een weigering van het platform met uitleg (400, 409) komt nu als die uitleg door, in plaats van als algemene platformfout.
- Audit: `ingang` bij publiceren; nieuw `metadatamodel.ingetrokken` en `classificatiemodel.ingetrokken`.

## 0.9.0 — 2026-11-19

**Versies als eigen pagina** bij Metadatamodel en Classificatiemodel.

- De pagina van een model is nu de lijst met versies. De versie in gebruik staat **vet**, met de status *In gebruik* (nieuwe stukken); oudere versies hebben de status *Vorige versie* (bestaande stukken, alleen lezen). Een concept in bewerking staat bovenaan.
- **Klik op een versie om hem te openen.** De versie in gebruik (en een concept) opent in de bewerker; een wijziging publiceer je als nieuwe versie. Een oudere versie opent alleen lezen, met *Als basis voor een nieuwe versie*.
- De knop **+ Nieuw model** staat rechtsboven. Het submenu heeft nu *Versies* en *Nieuw model*.
- Het versieblok onderaan de bewerker is weg; dat staat nu op de versiepagina.

## 0.8.0 — 2026-11-19

**Metadatamodel en Classificatiemodel: een overzicht met versies, bewerken en een nieuw model.**

- **Classificatie heet nu Classificatiemodel** (adres `/classificatiemodel`; het oude adres stuurt door).
- Beide modellen hebben een submenu met drie pagina's:
  - *Overzicht*: het model dat **in gebruik is voor nieuwe stukken** (naam, basismodel of selectielijst, inhoud, wanneer en door wie gepubliceerd), een melding als er een concept in bewerking is, en alle **versies** met wat ze betekenen: de actieve versie geldt voor nieuwe stukken, oudere versies blijven gelden voor de stukken die ermee zijn vastgelegd. Elke versie is te **bekijken**, alleen lezen.
  - *Bewerken*: de bekende bewerker, vanaf de versie in gebruik; publiceren maakt een **nieuwe versie** en brengt je terug naar het overzicht.
  - *Nieuw model*: kies het basismodel (MDTO, RGBZ, TMLO) of de selectielijst en een naam, en ga verder in de bewerker. Publiceren maakt het de nieuwe versie voor nieuwe stukken; bestaande stukken houden hun versie.
- Oudere versies zijn niet meer aan te passen; wie iets wil veranderen, maakt een nieuwe versie.
- **Duidelijke melding als het platform een functie nog niet kent.** In plaats van "Het platform gaf fout 404" zegt het portaal nu dat het platform ouder is en bijgewerkt moet worden (VPS 2).

## 0.7.0 — 2026-11-19

**Een echt overzicht, en accountbeheer in aparte pagina's.**

- **Overzicht**: een begroeting, getallen die je naar de juiste lijst brengen (actieve accounts, geblokkeerd of gedeactiveerd, gepland, actieve sessies, mislukte aanmeldingen, noodtoegang), *Vraagt aandacht* (mislukte aanmeldingen, noodtoegang, accounts zonder groep, accounts die na een week nog nooit hebben ingelogd, de eerstvolgende geplande wijzigingen), *Recente activiteit* in gewone woorden (zonder de losse API-verzoeken), de stand van het metadatamodel en het classificatiemodel, en snelkoppelingen. Wat je ziet, hangt af van je rechten.
- **Accounts** heeft een submenu in de zijbalk, met aparte pagina's per functie:
  - *Overzicht*: zoeken op naam of e-mail, filteren op status (met aantallen) en op groep, ook "zonder groep"; naam en e-mail samen, groepen als labels, laatst actief als "4 min geleden".
  - *Account toevoegen* (alleen met `accounts.manage`): een eigen pagina; daarna ga je naar het nieuwe account.
  - *Gepland*: alle statuswijzigingen die nog moeten ingaan, met **annuleren** (met reden). De wijziging blijft in de geschiedenis staan, met wie annuleerde en waarom.
  - *Sessies* (vanaf niveau 3): wie nu is ingelogd, op welk apparaat en IP-adres, met **één sessie beëindigen** (met reden) bij wie je mag beheren.
- **Een account**: een kop met naam, status, niveau, groepen, laatst actief en het aantal sessies; daaronder kaarten voor toegang (groepen), naam en taal (nieuw), status (nu of later) en overal uitloggen; de geschiedenis toont ook geannuleerde wijzigingen.
- Database: migratie `005_annuleren.sql` (kolommen voor annuleren; de app-rol kan nog steeds niets verwijderen). Nieuwe API's: `GET /api/accounts/gepland`, `POST /api/accounts/gepland/{id}/annuleren`, `GET /api/sessies`, `POST /api/sessies/{id}/beeindigen`; elke handeling komt in de audit.

## 0.6.0 — 2026-11-19

**Een vriendelijker en compacter portaal.**

- **Nieuwe vormgeving.** Een rustig blauw-groen kleurenpalet, knoppen en invoervelden met afgeronde hoeken, tabellen en formulieren in witte kaarten op een lichtgrijze achtergrond, en kleinere letters (14 px) zodat er meer op het scherm past. De onderdelen van NL Design System blijven; alleen hun stijlvariabelen zijn anders.
- **Navigatie in een zijbalk**, in groepen: de mensen bovenaan, dan *Informatie* (Metadatamodel, Classificatie, Anonimiseren) en *Systeem* (Audit, Instellingen, Profiel). Op een smal scherm een balk die opzij schuift. Bovenaan je naam, je niveau en *Uitloggen*.
- **Groepen** toont rechten als leesbare labels ("Metadatamodel: beheren") in plaats van technische namen; de technische naam staat in de tooltip. De knop heet *Bewerken*.
- **Een superadmin heeft alle rechten**, ook rechten die na het aanmaken van de groep zijn bijgekomen. Daardoor zag de groep Superbeheer de pagina's *Metadatamodel*, *Classificatie* en *Anonimiseren* niet: die rechten bestonden nog niet toen de groep werd aangemaakt. In de lijst staat nu "Alle rechten, ook nieuwe"; in het formulier zijn de vinkjes dan vast aan.
- De lege ruimte boven de kop is weg.

## 0.5.1 — 2026-11-10

Metadatamodel: bij de Woo-informatiecategorie het vinkje **Ook "geen categorie (niet actief openbaar)" aanbieden**, met uitleg. Het overzicht van wijzigingen noemt het; een waarschuwing als de categorie verplicht is zonder deze keuze.

## 0.5.0 — 2026-11-10

**Classificatie.** Een nieuwe pagina voor het classificatiemodel:
- naam;
- de Selectielijst 2020 per procestype, met resultaten aan of uit en zoeken op nummer of woord;
- afwijkingen van de bewaartermijn, alleen met een reden en het recht `bewaartermijn.afwijken`;
- eigen attributen (tekst, keuzelijst, ja of nee);
- vergrendelen bij status (ten minste één) en de status waarop de termijn ingaat;
- controleren, publiceren met reden (in de audit), en de versies.

Rechten `classificatie.view`, `classificatie.manage` en `bewaartermijn.afwijken` (migratie 004).

## 0.4.0 — 2026-11-10

**Metadatamodel: een eigen naam.** Bij stap 1 geef je het model een naam, zoals "RGBZ Haarlem". Die staat bovenaan het paneel Metadateren en in de eigenschappen van elk bestand, met het versienummer. Een andere naam is ook een nieuwe versie; het overzicht van wijzigingen noemt hem. De versietabel en "Nu in gebruik" tonen de naam, het voorbeeld van het paneel ook. De audit van een publicatie noemt de naam.

## 0.3.0 — 2026-11-09

**Anonimiseren → Kwaliteit.** Een nieuwe pagina met een tab Kwaliteit: hoe goed de assistent persoonsgegevens herkent, uit wat medewerkers doen bij het anonimiseren in het document.

- Periode (30, 90 of 365 dagen); bevestigingen gemeten, precisie, gevonden (een bovengrens voor de recall), zelf toegevoegd. Met uitleg ("Hoe lees je dit?").
- Per soort: voorgesteld, bevestigd, gelaten (met reden), zelf toegevoegd, precisie en gevonden.
- Zekerheid van de herkenning: terecht en onterecht per zekerheidsband, te filteren per soort; helpt bij het kiezen van een drempel.
- Vormen die medewerkers zelf toevoegden (gemist) of lieten staan (te veel), met een regexp om te kopiëren, signaalwoorden en lengte. Zeldzame vormen (minder dan 5 bevestigingen) blijven verborgen.
- Gewijzigde grondslag en een vergelijking per versie van de herkenner.
- Recht `anonimiseren.view` (migratie 003).

## 0.2.0 — 2026-11-09

**Metadatamodel.** Een nieuwe pagina waar informatiebeheer instelt welke metadata medewerkers invullen:

- Basismodel kiezen: MDTO, RGBZ of TMLO, met uitleg. TOOI levert de waardelijsten.
- Per veld: aan of uit, verplicht, label, hulptekst, waardelijst, volgorde. Bij elk veld het element in het model, de betekenis voor de assistent en of het model het verplicht noemt.
- Eigen velden (tekst, lange tekst, datum, keuzelijst, getal), met eigen keuzes.
- Doorlopend getoetst door het platform: fouten (geen titel, twee velden met dezelfde betekenis …) en waarschuwingen (een veld dat het model verplicht noemt, geen Woo-categorie).
- Voorbeeld van het paneel, en in gewone taal wat er verandert ten opzichte van de versie in gebruik. Wat je opstelt blijft als concept bewaard.
- Publiceren met reden: een nieuwe versie van het objecttype in het platform, in de audit. Overzicht van de versies; een oudere als begin nemen.
- Rechten `metadata.view` en `metadata.manage` (migratie 002). Instellingen `PLATFORM_URL`, `PLATFORM_DIENSTSLEUTEL` en `GEMEENTE`; zonder staat de pagina uit.
