import { Pool } from "pg";
import { env } from "./env";

// A single shared connection pool for the whole app.
// The pool reuses connections instead of opening a new one per request.
export const pool = new Pool({ connectionString: env.POSTGRES_URL });

// Small helper so callers write `query(sql, params)` instead of `pool.query`.
export const query = (text: string, params?: unknown[]) => pool.query(text, params);
