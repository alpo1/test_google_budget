import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  chain: z.string().trim().min(1, "Chain must not be empty").optional(),
  location: z.string().trim().min(1, "Location must not be empty").optional(),
});
export type CreateStoreInput = z.infer<typeof createStoreSchema>;

export const updateStoreSchema = z
  .object({
    name: z.string().trim().min(1, "Name must not be empty").optional(),
    chain: z.string().trim().min(1, "Chain must not be empty").optional(),
    location: z.string().trim().min(1, "Location must not be empty").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "no fields to update" });
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
