import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// Validate env at startup so the app fails fast if something is missing,
// instead of blowing up later with a confusing "undefined" error.
const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  POSTGRES_URL: z.string().url().default("postgres://postgres:postgres@localhost:5432/budget"),
  MONGO_URL: z.string().default("mongodb://localhost:27017/budget"),
  JWT_SECRET: z.string().min(8).default("default_dev_jwt_secret_key_12345"),
  JWT_EXPIRES_IN: z.string().default("1h"),
});

export const env = schema.parse(process.env);
