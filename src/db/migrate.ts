import fs from "fs";
import path from "path";
import { pool } from "../config/postgres";

// Simple migration: read schema.sql and run it.
// For a small project this is enough; a bigger one would use a migration tool.
async function migrate(): Promise<void> {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(sql);
  console.log("Migration complete: tables are ready.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
