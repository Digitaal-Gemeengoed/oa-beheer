-- Meer gemeenten in één inrichting (bijvoorbeeld een GR). Welke gemeenten er
-- zijn, staat in de configuratie (GEMEENTEN); hier alleen wie welke gemeente
-- beheert en voor welke gemeente een concept is.
--
-- accounts.gemeenten: de gemeenten die het account beheert; NULL = alle
-- gemeenten van de inrichting (GR-breed). sessies.gemeente: de gemeente die de
-- beheerder nu beheert. metadatamodel_concept krijgt de gemeente in de sleutel;
-- bestaande concepten krijgen de eerste gemeente uit de configuratie (migreer).
SET search_path = beheer, public;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gemeenten text[]
  CHECK (gemeenten IS NULL OR (cardinality(gemeenten) BETWEEN 1 AND 100 AND array_to_string(gemeenten, ',') ~ '^[a-z0-9-]{2,40}(,[a-z0-9-]{2,40})*$'));
ALTER TABLE sessies ADD COLUMN IF NOT EXISTS gemeente text CHECK (gemeente IS NULL OR gemeente ~ '^[a-z0-9-]{2,40}$');

ALTER TABLE metadatamodel_concept ADD COLUMN IF NOT EXISTS gemeente text NOT NULL DEFAULT '';
ALTER TABLE metadatamodel_concept DROP CONSTRAINT IF EXISTS metadatamodel_concept_pkey;
ALTER TABLE metadatamodel_concept ADD PRIMARY KEY (gemeente, objecttype);
