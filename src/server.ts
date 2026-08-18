import { app } from "./app";
import { env } from "./config/env";
import { connectMongo } from "./config/mongo";
import { pool } from "./config/postgres";

async function start(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    console.log("Connected to PostgreSQL");
  } catch (err) {
    console.warn("PostgreSQL not connected — database queries may fail until configured");
  }
  await connectMongo();

  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${env.PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
