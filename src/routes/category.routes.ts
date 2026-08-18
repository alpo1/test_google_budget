import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { createCategorySchema, updateCategorySchema } from "../validators/category.validators";
import {
  listCategories,
  getCategory,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} from "../controllers/category.controller";

export const categoriesRouter = Router();

categoriesRouter.get("/", requireAuth, asyncHandler(listCategories));
categoriesRouter.get("/:id", requireAuth, asyncHandler(getCategory));

categoriesRouter.post(
  "/",
  requireAuth,
  validateBody(createCategorySchema),
  asyncHandler(createCategoryHandler)
);

categoriesRouter.patch(
  "/:id",
  requireAuth,
  validateBody(updateCategorySchema),
  asyncHandler(updateCategoryHandler)
);

categoriesRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(deleteCategoryHandler)
);
