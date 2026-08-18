import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  barcode: z.string().trim().min(1).optional(),
  brand: z.string().trim().min(1).optional(),
  default_category_id: z.number().int().positive().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().trim().min(1, "Name must not be empty").optional(),
  barcode: z.string().trim().min(1).optional(),
  brand: z.string().trim().min(1).optional(),
  default_category_id: z.number().int().positive().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
