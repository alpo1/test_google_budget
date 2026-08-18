import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  monthly_budget: z.number().nonnegative("monthly_budget must be nonnegative").optional(),
  color: z.string().trim().min(1, "Color must not be empty").optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1, "Name must not be empty").optional(),
    monthly_budget: z.number().nonnegative("monthly_budget must be nonnegative").optional(),
    color: z.string().trim().min(1, "Color must not be empty").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "no fields to update" });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
