-- Medewerkers beheren in het portaal: in- of uitschakelen op een later moment.
-- De medewerker zelf staat in Keycloak; hier alleen wat er gepland is, door
-- wie en waarom, en wanneer het is uitgevoerd of geannuleerd.
SET search_path = beheer, public;

CREATE TABLE medewerkerwijzigingen (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gemeente          text NOT NULL,
  medewerker        text NOT NULL,            -- id in Keycloak
  email             text NOT NULL,            -- voor het overzicht en de audit
  actief            boolean NOT NULL,         -- false: uitschakelen, true: weer inschakelen
  reden             text NOT NULL CHECK (length(reden) BETWEEN 5 AND 1000),
  ingang            timestamptz NOT NULL,
  door              uuid NOT NULL REFERENCES accounts (id),
  aangemaakt        timestamptz NOT NULL DEFAULT now(),
  uitgevoerd        timestamptz,
  fout              text,
  geannuleerd       timestamptz,
  geannuleerd_door  uuid REFERENCES accounts (id),
  reden_annulering  text
);
CREATE INDEX medewerkerwijzigingen_open ON medewerkerwijzigingen (ingang) WHERE uitgevoerd IS NULL AND geannuleerd IS NULL;
GRANT SELECT, INSERT, UPDATE ON medewerkerwijzigingen TO oa_beheer_app;
