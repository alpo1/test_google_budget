import { PoolClient } from "pg";
import { pool, query } from "../config/postgres";
import { AppError } from "../errors/app-error";

export type ReceiptStatus = "draft" | "confirmed";
export type ReceiptSource = "manual" | "scan";

export interface ReceiptRow {
  id: number;
  store_id: number | null;
  category_id: number | null;
  created_by: number;
  status: ReceiptStatus;
  source: ReceiptSource;
  // NUMERIC(12,2) comes back from `pg` as a string — kept as a string
  // end-to-end (no parseFloat) to avoid float imprecision.
  total: string;
  currency: string;
  image_path: string | null;
  purchased_at: Date;
  created_at: Date;
}

export interface ReceiptItemRow {
  id: number;
  receipt_id: number;
  product_id: number | null;
  description: string;
  quantity: string; // NUMERIC(10,3) as string
  unit_price: string; // NUMERIC(12,2) as string
}

export interface ReceiptWithItems extends ReceiptRow {
  items: ReceiptItemRow[];
}

export interface CreateReceiptItemData {
  description: string;
  quantity?: number;
  unit_price: number;
  product_id?: number;
}

export interface CreateReceiptData {
  store_id?: number;
  category_id?: number;
  total: number;
  currency?: string;
  purchased_at?: string;
  items: CreateReceiptItemData[];
}

const RECEIPT_COLUMNS =
  "id, store_id, category_id, created_by, status, source, total, currency, image_path, purchased_at, created_at";
const ITEM_COLUMNS = "id, receipt_id, product_id, description, quantity, unit_price";

function isForeignKeyViolation(err: unknown, constraint: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23503" &&
    "constraint" in err &&
    (err as { constraint?: string }).constraint === constraint
  );
}

export async function findAllReceipts(): Promise<ReceiptRow[]> {
  const result = await query(
    `SELECT ${RECEIPT_COLUMNS} FROM receipts ORDER BY purchased_at DESC, id DESC`
  );
  return result.rows as ReceiptRow[];
}

export async function findReceiptById(id: number): Promise<ReceiptRow | null> {
  const result = await query(`SELECT ${RECEIPT_COLUMNS} FROM receipts WHERE id = $1`, [id]);
  return (result.rows[0] as ReceiptRow | undefined) ?? null;
}

export async function findReceiptItems(receiptId: number): Promise<ReceiptItemRow[]> {
  const result = await query(
    `SELECT ${ITEM_COLUMNS} FROM receipt_items WHERE receipt_id = $1 ORDER BY id`,
    [receiptId]
  );
  return result.rows as ReceiptItemRow[];
}

export async function findReceiptWithItems(id: number): Promise<ReceiptWithItems | null> {
  const receipt = await findReceiptById(id);
  if (!receipt) {
    return null;
  }
  const items = await findReceiptItems(id);
  return { ...receipt, items };
}

// Creates a receipt and its line items atomically. Uses a dedicated client so
// every statement runs against the same session/transaction — the shared
// query() helper in postgres.ts grabs an arbitrary pooled connection per call
// and must NOT be used here. On any failure the transaction is rolled back and
// the client is always released, whether it committed or not.
export async function createReceiptWithItems(
  data: CreateReceiptData,
  createdBy: number
): Promise<ReceiptWithItems> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    const columns = ["store_id", "category_id", "created_by", "status", "source", "total"];
    const values: unknown[] = [
      data.store_id ?? null,
      data.category_id ?? null,
      createdBy,
      "confirmed",
      "manual",
      data.total,
    ];

    if (data.currency !== undefined) {
      columns.push("currency");
      values.push(data.currency);
    }
    if (data.purchased_at !== undefined) {
      columns.push("purchased_at");
      values.push(data.purchased_at);
    }

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

    let receiptRow: ReceiptRow;
    try {
      const receiptResult = await client.query(
        `INSERT INTO receipts (${columns.join(", ")})
         VALUES (${placeholders})
         RETURNING ${RECEIPT_COLUMNS}`,
        values
      );
      receiptRow = receiptResult.rows[0] as ReceiptRow;
    } catch (err) {
      if (isForeignKeyViolation(err, "receipts_store_id_fkey")) {
        throw new AppError(400, `store ${data.store_id} does not exist`);
      }
      if (isForeignKeyViolation(err, "receipts_category_id_fkey")) {
        throw new AppError(400, `category ${data.category_id} does not exist`);
      }
      throw err;
    }

    const items: ReceiptItemRow[] = [];
    for (const item of data.items) {
      if (item.product_id !== undefined) {
        const productCheck = await client.query("SELECT 1 FROM products WHERE id = $1", [
          item.product_id,
        ]);
        if (productCheck.rows.length === 0) {
          throw new AppError(400, `product ${item.product_id} does not exist`);
        }
      }

      const itemColumns = ["receipt_id", "product_id", "description", "unit_price"];
      const itemValues: unknown[] = [
        receiptRow.id,
        item.product_id ?? null,
        item.description,
        item.unit_price,
      ];

      if (item.quantity !== undefined) {
        itemColumns.push("quantity");
        itemValues.push(item.quantity);
      }

      const itemPlaceholders = itemColumns.map((_, i) => `$${i + 1}`).join(", ");

      const itemResult = await client.query(
        `INSERT INTO receipt_items (${itemColumns.join(", ")})
         VALUES (${itemPlaceholders})
         RETURNING ${ITEM_COLUMNS}`,
        itemValues
      );
      items.push(itemResult.rows[0] as ReceiptItemRow);
    }

    await client.query("COMMIT");
    return { ...receiptRow, items };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
