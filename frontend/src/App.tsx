import { useCallback, useEffect, useState, type ReactNode, type MouseEvent } from "react";
import { Alert, Button, Document, Heading1, Link, Paragraph, PrimaryActionButton, SkipLink, Surface } from "@utrecht/component-library-react";
import { api, bijNietIngelogd, type Ik } from "./api";
import { t, tijd, zetTaal } from "./i18n";
import { Dashboard } from "./paginas/Dashboard";
import { Accounts, AccountDetail, GeplandeWijzigingen, NieuwAccount, Sessies } from "./paginas/Accounts";
import { Groepen } from "./paginas/Groepen";
import { Audit } from "./paginas/Audit";
import { Instellingen } from "./paginas/Instellingen";
import { Profiel } from "./paginas/Profiel";
import { Nood } from "./paginas/Nood";
import { Metadatamodel } from "./paginas/Metadatamodel";
import { Anonimiseren } from "./paginas/Anonimiseren";
import { Classificatie } from "./paginas/Classificatie";
import { initialen } from "./paginas/gedeeld";

/** Eenvoudige router op de History-API. */
export function ga(pad: string): void {
  history.pushState(null, "", pad);
  dispatchEvent(new PopStateEvent("popstate"));
}

export function L({ naar, children, className, exact }: { naar: string; children: ReactNode; className?: string; exact?: boolean }) {
  const pad = naar.split("?")[0]!;
  const huidig = location.pathname === pad || (!exact && pad !== "/" && location.pathname.startsWith(`${pad}/`));
  return (
    <Link href={naar} className={className} aria-current={huidig ? "page" : undefined} onClick={(e: MouseEvent) => { e.preventDefault(); ga(naar); }}>
      {children}
    </Link>
  );
}

function usePad(): string {
  const [pad, zet] = useState(location.pathname);
  useEffect(() => {
    const f = () => zet(location.pathname);
    addEventListener("popstate", f);
    return () => removeEventListener("popstate", f);
  }, []);
  return pad;
}

export function App() {
  const pad = usePad();
  const [ik, zetIk] = useState<Ik | null | undefined>(undefined);

  const laad = useCallback(async () => {
    try {
      const i = await api<Ik>("GET", "/api/ik");
      zetTaal(i.taal);
      zetIk(i);
    } catch {
      zetIk(null);
    }
  }, []);

  useEffect(() => {
    bijNietIngelogd(() => zetIk(null));
    laad();
  }, [laad]);

  if (pad === "/emergency") return <Thema><Nood klaar={() => { ga("/"); laad(); }} /></Thema>;
  if (ik === undefined) return <Thema><Paragraph className="ab-smal">{t("laden")}</Paragraph></Thema>;
  if (ik === null) return <Thema><Aanmelden /></Thema>;

  // Het oude adres van het classificatiemodel.
  if (pad === "/classificatie") {
    history.replaceState(null, "", "/classificatiemodel");
    dispatchEvent(new PopStateEvent("popstate"));
  }
  const r = new Set(ik.rechten);
  const uitloggen = async () => {
    const { doorsturen } = await api<{ doorsturen: string }>("POST", "/api/auth/uitloggen");
    location.href = doorsturen;
  };

  let inhoud: ReactNode;
  if (pad === "/") inhoud = <Dashboard ik={ik} />;
  else if (pad === "/accounts" && r.has("accounts.view")) inhoud = <Accounts ik={ik} />;
  else if (pad === "/accounts/nieuw" && r.has("accounts.manage")) inhoud = <NieuwAccount />;
  else if (pad === "/accounts/gepland" && r.has("accounts.view")) inhoud = <GeplandeWijzigingen />;
  else if (pad === "/accounts/sessies" && r.has("accounts.view") && ik.niveau >= 3) inhoud = <Sessies />;
  else if (/^\/accounts\/[0-9a-f-]{36}$/i.test(pad) && r.has("accounts.view")) inhoud = <AccountDetail ik={ik} id={pad.split("/")[2]!} />;
  else if (pad === "/groepen") inhoud = <Groepen ik={ik} />;
  else if (pad === "/audit" && r.has("audit.view")) inhoud = <Audit />;
  else if (pad === "/instellingen" && (r.has("settings.view") || r.has("settings.manage"))) inhoud = <Instellingen ik={ik} />;
  else if ((pad === "/metadatamodel" || pad.startsWith("/metadatamodel/")) && (r.has("metadata.view") || r.has("metadata.manage"))) inhoud = <Metadatamodel ik={ik} deel={pad.slice("/metadatamodel/".length)} />;
  else if (pad === "/anonimiseren" && r.has("anonimiseren.view")) inhoud = <Anonimiseren ik={ik} />;
  else if ((pad === "/classificatiemodel" || pad.startsWith("/classificatiemodel/")) && (r.has("classificatie.view") || r.has("classificatie.manage"))) inhoud = <Classificatie ik={ik} deel={pad.slice("/classificatiemodel/".length)} />;
  else if (pad === "/profiel") inhoud = <Profiel ik={ik} opnieuw={laad} />;
  else inhoud = <Alert type="warning"><Paragraph>{t("geenRecht")}</Paragraph></Alert>;

  return (
    <Thema>
      <div className="ab-pagina">
        <SkipLink href="#inhoud">{t("overslaan")}</SkipLink>
        {ik.nood && <div className="ab-nood" role="status">{t("nood")} {tijd(ik.sessieEinde)}</div>}
        <header className="ab-kop">
          <span className="ab-merk" aria-hidden="true">OA</span>
          <span className="ab-kop-titel">{t("titel")}</span>
          <span className="ab-kop-wie">
            <span className="ab-wie">
              <span className="ab-avatar" aria-hidden="true">{initialen(ik.naam)}</span>
              <span>{ik.naam}</span>
              <span className="ab-pil">{t("niveau")} {ik.niveau}</span>
            </span>
            <Button appearance="subtle-button" onClick={uitloggen}>{t("uitloggen")}</Button>
          </span>
        </header>
        <div className="ab-romp">
          <nav className="ab-nav" aria-label={t("titel")}>
            <ul>
              <li><L naar="/">{t("dashboard")}</L></li>
              {r.has("accounts.view") && (
                <li>
                  <L naar="/accounts">{t("accounts")}</L>
                  {pad.startsWith("/accounts") && (
                    <ul className="ab-nav-sub">
                      <li><L naar="/accounts" exact>{t("accountsOverzicht")}</L></li>
                      {r.has("accounts.manage") && <li><L naar="/accounts/nieuw">{t("accountNieuw")}</L></li>}
                      <li><L naar="/accounts/gepland">{t("accountsGepland")}</L></li>
                      {ik.niveau >= 3 && <li><L naar="/accounts/sessies">{t("accountsSessies")}</L></li>}
                    </ul>
                  )}
                </li>
              )}
              {(r.has("groups.view") || r.has("groups.manage") || r.has("accounts.manage")) && <li><L naar="/groepen">{t("groepen")}</L></li>}
            </ul>
            {(r.has("metadata.view") || r.has("metadata.manage") || r.has("classificatie.view") || r.has("classificatie.manage") || r.has("anonimiseren.view")) && (
              <>
                <span className="ab-nav-kop">{t("navInformatie")}</span>
                <ul>
                  {(r.has("metadata.view") || r.has("metadata.manage")) && (
                    <li>
                      <L naar="/metadatamodel">{t("metadatamodel")}</L>
                      {pad.startsWith("/metadatamodel") && <Modelmenu pad="/metadatamodel" kan={r.has("metadata.manage")} />}
                    </li>
                  )}
                  {(r.has("classificatie.view") || r.has("classificatie.manage")) && (
                    <li>
                      <L naar="/classificatiemodel">{t("classificatie")}</L>
                      {pad.startsWith("/classificatiemodel") && <Modelmenu pad="/classificatiemodel" kan={r.has("classificatie.manage")} />}
                    </li>
                  )}
                  {r.has("anonimiseren.view") && <li><L naar="/anonimiseren">{t("anonimiseren")}</L></li>}
                </ul>
              </>
            )}
            <span className="ab-nav-kop">{t("navSysteem")}</span>
            <ul>
              {r.has("audit.view") && <li><L naar="/audit">{t("audit")}</L></li>}
              {(r.has("settings.view") || r.has("settings.manage")) && <li><L naar="/instellingen">{t("instellingen")}</L></li>}
              <li><L naar="/profiel">{t("profiel")}</L></li>
            </ul>
          </nav>
          <main id="inhoud" className="ab-inhoud" key={pad}>{inhoud}</main>
        </div>
      </div>
    </Thema>
  );
}

/** Submenu van een model: overzicht, bewerken (nieuwe versie), nieuw model. */
function Modelmenu({ pad, kan }: { pad: string; kan: boolean }) {
  return (
    <ul className="ab-nav-sub">
      <li><L naar={pad} exact>{t("modelOverzicht")}</L></li>
      {kan && <li><L naar={`${pad}/bewerken`}>{t("bewerken")}</L></li>}
      {kan && <li><L naar={`${pad}/nieuw`}>{t("nieuwModel")}</L></li>}
    </ul>
  );
}

function Thema({ children }: { children: ReactNode }) {
  return (
    <Surface className="haarlem-theme ab-thema">
      <Document>{children}</Document>
    </Surface>
  );
}

function Aanmelden() {
  const fout = new URLSearchParams(location.search).get("fout");
  const terug = location.pathname === "/" ? "/" : location.pathname;
  return (
    <main className="ab-smal">
      <Heading1>{t("titel")}</Heading1>
      {fout && <Alert type="error"><Paragraph>{t("inloggenMislukt")}</Paragraph></Alert>}
      <Paragraph>{t("inloggenUitleg")}</Paragraph>
      <PrimaryActionButton onClick={() => { location.href = `/api/auth/inloggen?terug=${encodeURIComponent(terug)}`; }}>{t("inloggen")}</PrimaryActionButton>
    </main>
  );
}
