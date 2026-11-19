# Wijzigingen

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
