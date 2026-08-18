import { query } from "../config/postgres";
import { AppError } from "../errors/app-error";

export interface CategoryRow {
  id: number;
  name: string;
  monthly_budget: string | null;
  color: string | null;
  created_at: Date;
}

export interface CreateCategoryData {
  name: string;
  monthly_budget?: number;
  color?: string;
}

export interface UpdateCategoryData {
  name?: string;
  monthly_budget?: number;
  color?: string;
}

const CATEGORY_COLUMNS = ["name", "monthly_budget", "color"] as const;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export async function findAllCategories(): Promise<CategoryRow[]> {
  const result = await query(
    "SELECT id, name, monthly_budget, color, created_at FROM categories ORDER BY id"
  );
  return result.rows as CategoryRow[];
}

export async function findCategoryById(id: number): Promise<CategoryRow | null> {
  const result = await query(
    "SELECT id, name, monthly_budget, color, created_at FROM categories WHERE id = $1",
    [id]
  );
  return (result.rows[0] as CategoryRow | undefined) ?? null;
}

export async function createCategory(data: CreateCategoryData): Promise<CategoryRow> {
  try {
    const result = await query(
      `INSERT INTO categories (name, monthly_budget, color)
       VALUES ($1, $2, $3)
       RETURNING id, name, monthly_budget, color, created_at`,
      [data.name, data.monthly_budget ?? null, data.color ?? null]
    );
    return result.rows[0] as CategoryRow;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, "A category with this name already exists");
    }
    throw err;
  }
}

export async function updateCategory(
  id: number,
  data: UpdateCategoryData
): Promise<CategoryRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const column of CATEGORY_COLUMNS) {
    const value = data[column];
    if (value !== undefined) {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }
  }

  if (setClauses.length === 0) {
    return findCategoryById(id);
  }

  values.push(id);
  const idPlaceholder = `$${values.length}`;

  try {
    const result = await query(
      `UPDATE categories
       SET ${setClauses.join(", ")}
       WHERE id = ${idPlaceholder}
       RETURNING id, name, monthly_budget, color, created_at`,
      values
    );

    return (result.rows[0] as CategoryRow | undefined) ?? null;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, "A category with this name already exists");
    }
    throw err;
  }
}

export async function deleteCategory(id: number): Promise<boolean> {
  const result = await query("DELETE FROM categories WHERE id = $1 RETURNING id", [id]);
  return result.rows.length > 0;
}
