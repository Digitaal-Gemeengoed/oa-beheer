-- Gemeenten beheren in het portaal (pagina Gemeenten). Welke gemeenten er
-- zijn, staat voortaan hier; de configuratie (GEMEENTEN of GEMEENTE) vult de
-- tabel bij de start aan, en gemeenten die al in Keycloak bestaan, neemt de
-- pagina over. Keycloak blijft de bron voor wie bij welke gemeente hoort.
SET search_path = beheer, public;

CREATE TABLE IF NOT EXISTS gemeenten (
  id              text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{2,40}$'),
  naam            text NOT NULL CHECK (length(naam) BETWEEN 3 AND 100),
  domeinen        text[] NOT NULL DEFAULT '{}' CHECK (cardinality(domeinen) <= 10),
  aangemaakt      timestamptz NOT NULL DEFAULT now(),
  aangemaakt_door uuid REFERENCES accounts (id),
  gewijzigd       timestamptz
);
GRANT SELECT, INSERT, UPDATE ON gemeenten TO oa_beheer_app;

-- Het recht om gemeenten toe te voegen en te wijzigen (alleen voor wie GR-breed beheert).
ALTER TABLE groepen DROP CONSTRAINT IF EXISTS groepen_rechten_check;
ALTER TABLE groepen ADD CONSTRAINT groepen_rechten_check
  CHECK (rechten <@ ARRAY['accounts.view', 'accounts.manage', 'groups.view', 'groups.manage', 'audit.view', 'settings.view', 'settings.manage', 'metadata.view', 'metadata.manage', 'anonimiseren.view', 'classificatie.view', 'classificatie.manage', 'bewaartermijn.afwijken', 'gemeenten.manage']::text[]);
