import { query } from "../config/postgres";

export interface StoreRow {
  id: number;
  name: string;
  chain: string | null;
  location: string | null;
  created_at: Date;
}

export interface CreateStoreData {
  name: string;
  chain?: string;
  location?: string;
}

export interface UpdateStoreData {
  name?: string;
  chain?: string;
  location?: string;
}

const STORE_COLUMNS = ["name", "chain", "location"] as const;

export async function findAllStores(): Promise<StoreRow[]> {
  const result = await query("SELECT id, name, chain, location, created_at FROM stores ORDER BY id");
  return result.rows as StoreRow[];
}

export async function findStoreById(id: number): Promise<StoreRow | null> {
  const result = await query(
    "SELECT id, name, chain, location, created_at FROM stores WHERE id = $1",
    [id]
  );
  return (result.rows[0] as StoreRow | undefined) ?? null;
}

export async function createStore(data: CreateStoreData): Promise<StoreRow> {
  const result = await query(
    `INSERT INTO stores (name, chain, location)
     VALUES ($1, $2, $3)
     RETURNING id, name, chain, location, created_at`,
    [data.name, data.chain ?? null, data.location ?? null]
  );
  return result.rows[0] as StoreRow;
}

export async function updateStore(id: number, data: UpdateStoreData): Promise<StoreRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const column of STORE_COLUMNS) {
    const value = data[column];
    if (value !== undefined) {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }
  }

  if (setClauses.length === 0) {
    return findStoreById(id);
  }

  values.push(id);
  const idPlaceholder = `$${values.length}`;

  const result = await query(
    `UPDATE stores
     SET ${setClauses.join(", ")}
     WHERE id = ${idPlaceholder}
     RETURNING id, name, chain, location, created_at`,
    values
  );

  return (result.rows[0] as StoreRow | undefined) ?? null;
}

export async function deleteStore(id: number): Promise<boolean> {
  const result = await query("DELETE FROM stores WHERE id = $1 RETURNING id", [id]);
  return result.rows.length > 0;
}
