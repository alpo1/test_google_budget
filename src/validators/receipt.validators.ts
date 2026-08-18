import { z } from "zod";

// NUMERIC(12,2) ceiling — keeps an out-of-range value a 400, not a Postgres 22003 -> 500.
const MAX_MONEY = 9999999999;

export const receiptItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive").optional(),
  unit_price: z
    .number()
    .nonnegative("Unit price must not be negative")
    .max(MAX_MONEY, "Unit price is too large"),
  product_id: z.number().int().positive("product_id must be a positive integer").optional(),
});

export const createReceiptSchema = z.object({
  store_id: z.number().int().positive("store_id must be a positive integer").optional(),
  category_id: z.number().int().positive("category_id must be a positive integer").optional(),
  total: z.number().nonnegative("total must not be negative").max(MAX_MONEY, "total is too large"),
  currency: z.string().trim().min(1, "currency must not be empty").optional(),
  purchased_at: z
    .string()
    .datetime({ offset: true, message: "purchased_at must be an ISO datetime string" })
    .optional(),
  items: z.array(receiptItemSchema).min(1, "a receipt must have at least one item"),
});
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
