/**
 * De selectielijst als boom, zoeken en de voorstellen van de assistent.
 *
 * Dit is dezelfde logica als in oa-kern (src/classificeren.ts: boom, zoek,
 * suggesties), zodat het voorbeeld in het beheerportaal laat zien wat de
 * medewerker in het paneel ziet. Het portaal hangt niet af van oa-kern;
 * verandert daar iets, pas het dan hier ook aan.
 */

export interface PT { nummer: number; naam: string; omschrijving: string; procesobject: string }
export interface Res { id: string; procestype: number; generiek: string | null; naam: string; omschrijving: string; toelichting?: string }

export interface Groep<R extends Res> { id: string; naam: string; omschrijving: string; zelf: R | null; uitwerkingen: R[] }
export interface Tak<R extends Res> { procestype: PT; groepen: Groep<R>[]; aantal: number }

/** "3.10" na "3.9". */
export function opNummer(a: string, b: string): number {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

/** Procestype → generiek resultaat (12.2) → uitwerkingen (12.2.3). */
export function boom<R extends Res>(resultaten: R[], procestypen: PT[]): Tak<R>[] {
  const groepen = new Map<string, Groep<R>>();
  const groep = (id: string): Groep<R> => {
    let g = groepen.get(id);
    if (!g) groepen.set(id, (g = { id, naam: "", omschrijving: "", zelf: null, uitwerkingen: [] }));
    return g;
  };
  for (const r of resultaten) {
    if (r.generiek) groep(r.generiek).uitwerkingen.push(r);
    else groep(r.id).zelf = r;
  }
  for (const g of groepen.values()) {
    g.naam = g.zelf?.naam ?? g.uitwerkingen[0]?.naam ?? g.id;
    g.omschrijving = g.zelf?.omschrijving ?? "";
    g.uitwerkingen.sort((a, b) => opNummer(a.id, b.id));
  }
  const perType = new Map<number, Groep<R>[]>();
  for (const g of groepen.values()) {
    const nr = (g.zelf ?? g.uitwerkingen[0]!).procestype;
    perType.set(nr, [...(perType.get(nr) ?? []), g]);
  }
  return [...procestypen]
    .sort((a, b) => a.nummer - b.nummer)
    .filter((p) => perType.has(p.nummer))
    .map((p) => {
      const gs = perType.get(p.nummer)!.sort((a, b) => opNummer(a.id, b.id));
      return { procestype: p, groepen: gs, aantal: gs.reduce((n, g) => n + (g.zelf ? 1 : 0) + g.uitwerkingen.length, 0) };
    });
}

const STOP = new Set(
  "aan als bij dat de deze die dit door een en het hij hun ik in is je kan kunnen maar met na naar niet nog of om onder ook op over te tot uit van voor wat we wel worden wordt zich zijn zij zo ze over geen alle andere meer ons onze uw hun bijvoorbeeld zoals waarin waarbij welke wanneer gemeente gemeentelijke tegen heeft hebben wij ontvangen geldt gaat".split(" "),
);

function woordenVan(tekst: string): string[] {
  return (tekst.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z]{4,}/g) ?? [])
    .filter((w) => !STOP.has(w))
    .map((w) => (w.length > 6 ? w.replace(/(ingen|ing|en|s)$/, "") : w));
}

function beschrijving(r: Res, pt?: PT): string {
  return [r.naam, r.omschrijving, r.toelichting, pt?.naam, pt?.procesobject].filter(Boolean).join(" ");
}

function gewogen(r: Res, pt?: PT): Map<string, number> {
  const uit = new Map<string, number>();
  const voeg = (t: string | undefined, g: number) => {
    for (const w of woordenVan(t ?? "")) uit.set(w, Math.max(uit.get(w) ?? 0, g));
  };
  voeg(r.toelichting, 0.5);
  voeg(pt?.procesobject, 0.8);
  voeg(r.naam, 1);
  voeg(pt?.naam, 1.2);
  voeg(r.omschrijving, 2);
  return uit;
}

/** De beste klassen voor deze tekst, met de woorden waarop het voorstel steunt. */
export function suggesties<R extends Res>(tekst: string, resultaten: R[], procestypen: PT[], aantal = 3): { resultaat: R; woorden: string[] }[] {
  const pt = new Map(procestypen.map((p) => [p.nummer, p]));
  const doc = new Map<string, number>();
  for (const w of woordenVan(tekst)) doc.set(w, (doc.get(w) ?? 0) + 1);
  const zakken = resultaten.map((r) => gewogen(r, pt.get(r.procestype)));
  const df = new Map<string, number>();
  for (const z of zakken) for (const w of z.keys()) df.set(w, (df.get(w) ?? 0) + 1);
  const n = resultaten.length;
  return resultaten
    .map((r, i) => {
      let score = 0;
      const woorden: [string, number][] = [];
      for (const [w, veld] of zakken[i]!) {
        const tf = doc.get(w);
        if (!tf) continue;
        const gewicht = veld * Math.log(1 + n / (df.get(w) ?? 1)) * Math.min(3, Math.log2(1 + tf));
        score += gewicht;
        woorden.push([w, gewicht]);
      }
      if (r.generiek) score *= 1.1;
      return { resultaat: r, score, woorden: woorden.sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w) };
    })
    .filter((v) => v.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, aantal);
}

/** Zoeken op nummer ("12.2") of op woorden. */
export function zoek<R extends Res>(resultaten: R[], procestypen: PT[], vraag: string, max = 40): R[] {
  const q = vraag.trim().toLowerCase();
  if (!q) return [];
  if (/^\d+(\.\d+){0,2}$/.test(q)) return resultaten.filter((r) => r.id === q || r.id.startsWith(`${q}.`)).slice(0, max);
  const pt = new Map(procestypen.map((p) => [p.nummer, p]));
  const delen = q.split(/\s+/);
  return resultaten.filter((r) => delen.every((d) => beschrijving(r, pt.get(r.procestype)).toLowerCase().includes(d))).slice(0, max);
}
