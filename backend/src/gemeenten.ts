import type { Db } from "./db.js";

/** Een gemeente van de inrichting, zoals het portaal haar kent. */
export interface Gemeente {
  id: string;
  naam: string;
  domeinen: string[];
}

export async function laadGemeenten(db: Db): Promise<Gemeente[]> {
  const r = await db.query("SELECT id, naam, domeinen FROM gemeenten ORDER BY naam");
  return r.rows;
}

/** Wat er nog niet is, erbij; bestaande gemeenten blijven zoals ze zijn (het portaal is daarna de bron). */
export async function vulGemeentenAan(db: Db, lijst: Gemeente[]): Promise<void> {
  for (const g of lijst) {
    await db.query("INSERT INTO gemeenten (id, naam, domeinen) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [g.id, g.naam, g.domeinen]);
  }
}
