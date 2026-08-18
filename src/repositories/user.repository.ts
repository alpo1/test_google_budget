import { query } from "../config/postgres";
import { AppError } from "../errors/app-error";

export type Role = "buyer" | "admin";

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: Role;
  created_at: Date;
}

export type PublicUser = Omit<UserRow, "password_hash">;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query(
    "SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1",
    [email]
  );
  return (result.rows[0] as UserRow | undefined) ?? null;
}

export async function createUser(email: string, passwordHash: string): Promise<PublicUser> {
  try {
    const result = await query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role, created_at",
      [email, passwordHash]
    );
    return result.rows[0] as PublicUser;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, "Email already registered");
    }
    throw err;
  }
}
