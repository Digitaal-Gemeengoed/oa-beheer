-- Een geplande statuswijziging kan worden geannuleerd zolang ze niet is
-- ingegaan. De rij blijft staan (met wie en waarom); de app-rol mag niet
-- verwijderen.
SET search_path = beheer, public;

ALTER TABLE statuswijzigingen
  ADD COLUMN geannuleerd timestamptz,
  ADD COLUMN geannuleerd_door uuid REFERENCES accounts (id),
  ADD COLUMN reden_annulering text CHECK (reden_annulering IS NULL OR length(reden_annulering) BETWEEN 5 AND 1000),
  ADD CONSTRAINT statuswijzigingen_annulering_check CHECK ((geannuleerd IS NULL) = (geannuleerd_door IS NULL) AND (geannuleerd IS NULL) = (reden_annulering IS NULL)),
  ADD CONSTRAINT statuswijzigingen_niet_beide_check CHECK (geannuleerd IS NULL OR uitgevoerd IS NULL);

DROP INDEX IF EXISTS statuswijzigingen_open;
CREATE INDEX statuswijzigingen_open ON statuswijzigingen (ingang) WHERE uitgevoerd IS NULL AND geannuleerd IS NULL;
