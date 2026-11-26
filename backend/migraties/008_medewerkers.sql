-- Het niveau voor persoonsgegevens (PPL) van medewerkers instellen in het
-- portaal (pagina Medewerkers). Het niveau zelf staat in Keycloak (rollen
-- ppl-1, ppl-2, ppl-3); hier alleen de rechten om het te bekijken en te wijzigen.
SET search_path = beheer, public;

ALTER TABLE groepen DROP CONSTRAINT IF EXISTS groepen_rechten_check;
ALTER TABLE groepen ADD CONSTRAINT groepen_rechten_check
  CHECK (rechten <@ ARRAY['accounts.view', 'accounts.manage', 'groups.view', 'groups.manage', 'audit.view', 'settings.view', 'settings.manage', 'metadata.view', 'metadata.manage', 'anonimiseren.view', 'classificatie.view', 'classificatie.manage', 'bewaartermijn.afwijken', 'gemeenten.manage', 'medewerkers.view', 'medewerkers.manage']::text[]);
