import { z } from "zod";

export const createShoppingListItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  quantity: z.string().trim().min(1).optional(),
  product_id: z.number().int().positive().optional(),
});

export type CreateShoppingListItemInput = z.infer<typeof createShoppingListItemSchema>;

export const updateShoppingListItemSchema = z
  .object({
    name: z.string().trim().min(1, "Name must not be empty").optional(),
    quantity: z.string().trim().min(1).optional(),
    product_id: z.number().int().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "no fields to update" });

export type UpdateShoppingListItemInput = z.infer<typeof updateShoppingListItemSchema>;

export const checkShoppingListItemSchema = z.object({
  is_checked: z.boolean(),
});

export type CheckShoppingListItemInput = z.infer<typeof checkShoppingListItemSchema>;
