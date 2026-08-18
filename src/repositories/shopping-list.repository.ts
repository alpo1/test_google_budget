import { query } from "../config/postgres";
import { AppError } from "../errors/app-error";

export interface ShoppingListItemRow {
  id: number;
  name: string;
  quantity: string | null;
  product_id: number | null;
  added_by: number | null;
  is_checked: boolean;
  checked_at: string | null;
  created_at: string;
}

export interface CreateShoppingListItemData {
  name: string;
  quantity?: string;
  product_id?: number;
}

export interface UpdateShoppingListItemData {
  name?: string;
  quantity?: string;
  product_id?: number;
}

const SHOPPING_LIST_ITEM_COLUMNS = [
  "name",
  "quantity",
  "product_id",
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

export async function findAllShoppingListItems(): Promise<ShoppingListItemRow[]> {
  const result = await query(
    `SELECT id, name, quantity, product_id, added_by, is_checked, checked_at, created_at
     FROM shopping_list_items
     ORDER BY id`
  );
  return result.rows as ShoppingListItemRow[];
}

export async function findShoppingListItemById(
  id: number
): Promise<ShoppingListItemRow | null> {
  const result = await query(
    `SELECT id, name, quantity, product_id, added_by, is_checked, checked_at, created_at
     FROM shopping_list_items
     WHERE id = $1`,
    [id]
  );
  return (result.rows[0] as ShoppingListItemRow | undefined) ?? null;
}

export async function createShoppingListItem(
  data: CreateShoppingListItemData,
  addedBy: number
): Promise<ShoppingListItemRow> {
  try {
    const result = await query(
      `INSERT INTO shopping_list_items (name, quantity, product_id, added_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, quantity, product_id, added_by, is_checked, checked_at, created_at`,
      [
        data.name,
        data.quantity ?? null,
        data.product_id ?? null,
        addedBy,
      ]
    );
    return result.rows[0] as ShoppingListItemRow;
  } catch (error) {
    if (isPgError(error)) {
      if (error.code === "23503") {
        throw new AppError(
          400,
          "product_id references a non-existent product"
        );
      }
    }
    throw error;
  }
}

export async function updateShoppingListItem(
  id: number,
  data: UpdateShoppingListItemData
): Promise<ShoppingListItemRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const column of SHOPPING_LIST_ITEM_COLUMNS) {
    const value = data[column];
    if (value !== undefined) {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }
  }

  if (setClauses.length === 0) return findShoppingListItemById(id);

  values.push(id);
  const idPlaceholder = `$${values.length}`;

  try {
    const result = await query(
      `UPDATE shopping_list_items
       SET ${setClauses.join(", ")}
       WHERE id = ${idPlaceholder}
       RETURNING id, name, quantity, product_id, added_by, is_checked, checked_at, created_at`,
      values
    );
    return (result.rows[0] as ShoppingListItemRow | undefined) ?? null;
  } catch (error) {
    if (isPgError(error)) {
      if (error.code === "23503") {
        throw new AppError(
          400,
          "product_id references a non-existent product"
        );
      }
    }
    throw error;
  }
}

export async function setShoppingListItemChecked(
  id: number,
  isChecked: boolean
): Promise<ShoppingListItemRow | null> {
  const result = await query(
    `UPDATE shopping_list_items
     SET is_checked = $1,
         checked_at = CASE WHEN $1 THEN now() ELSE NULL END
     WHERE id = $2
     RETURNING id, name, quantity, product_id, added_by, is_checked, checked_at, created_at`,
    [isChecked, id]
  );
  return (result.rows[0] as ShoppingListItemRow | undefined) ?? null;
}

export async function deleteShoppingListItem(id: number): Promise<boolean> {
  const result = await query(
    "DELETE FROM shopping_list_items WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rows.length > 0;
}
