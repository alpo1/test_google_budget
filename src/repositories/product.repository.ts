import { query } from "../config/postgres";
import { AppError } from "../errors/app-error";

export interface ProductRow {
  id: number;
  name: string;
  barcode: string | null;
  brand: string | null;
  default_category_id: number | null;
}

export interface CreateProductData {
  name: string;
  barcode?: string;
  brand?: string;
  default_category_id?: number;
}

export interface UpdateProductData {
  name?: string;
  barcode?: string;
  brand?: string;
  default_category_id?: number;
}

const PRODUCT_COLUMNS = [
  "barcode",
  "name",
  "brand",
  "default_category_id",
] as const;

export function isPgError(
  err: unknown
): err is { code: string; constraint?: string } {
  if (typeof err !== "object" || err === null) {
    return false;
  }

  const candidate = err as Record<string, unknown>;

  const hasValidCode = typeof candidate.code === "string";
  const hasValidConstraint =
    candidate.constraint === undefined ||
    typeof candidate.constraint === "string";

  return hasValidCode && hasValidConstraint;
}

export async function findAllProducts(): Promise<ProductRow[]> {
  const result = await query(
    "SELECT id, name, barcode, brand, default_category_id FROM products ORDER BY id"
  );
  return result.rows as ProductRow[];
}

export async function findProductById(id: number): Promise<ProductRow | null> {
  const result = await query(
    "SELECT id, name, barcode, brand, default_category_id FROM products WHERE id = $1",
    [id]
  );
  return (result.rows[0] as ProductRow | undefined) ?? null;
}

export async function createProduct(
  data: CreateProductData
): Promise<ProductRow> {
  try {
    const result = await query(
      `INSERT INTO products (name, barcode, brand, default_category_id)
          VALUES ($1, $2, $3, $4)
          RETURNING id, name, barcode, brand, default_category_id`,
      [
        data.name,
        data.barcode ?? null,
        data.brand ?? null,
        data.default_category_id ?? null,
      ]
    );
    return result.rows[0] as ProductRow;
  } catch (error) {
    if (isPgError(error)) {
      if (error.code === "23505") {
        throw new AppError(409, "Product with this barcode already exists");
      }
      if (error.code === "23503") {
        throw new AppError(
          400,
          "default_category_id references a non-existent category"
        );
      }
    }
    throw error;
  }
}

export async function updateProduct(
  id: number,
  data: UpdateProductData
): Promise<ProductRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const column of PRODUCT_COLUMNS) {
    const value = data[column];
    if (value !== undefined) {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }
  }

  if (setClauses.length === 0) return findProductById(id);

  values.push(id);
  const idPlaceholder = `$${values.length}`;

  try {
    const result = await query(
      `UPDATE products
       SET ${setClauses.join(", ")}
       WHERE id = ${idPlaceholder}
       RETURNING id, name, brand, barcode, default_category_id`,
      values
    );
    return (result.rows[0] as ProductRow | undefined) ?? null;
  } catch (error) {
    if (isPgError(error)) {
      if (error.code === "23505") {
        throw new AppError(409, "Product with this barcode already exists");
      } else if (error.code === "23503") {
        throw new AppError(
          400,
          "default_category_id references a non-existent category"
        );
      }
    }
    throw error;
  }
}

export async function deleteProduct(id: number): Promise<boolean> {
  const result = await query(
    "DELETE FROM products WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rows.length > 0;
}
