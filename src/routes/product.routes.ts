import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/require-auth";
import {
  createProductSchema,
  updateProductSchema,
} from "../validators/product.validators";
import {
  listProducts,
  getProduct,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
} from "../controllers/product.controller";

export const productsRouter = Router();

productsRouter.get("/", requireAuth, asyncHandler(listProducts));
productsRouter.get("/:id", requireAuth, asyncHandler(getProduct));

productsRouter.post(
  "/",
  requireAuth,
  validateBody(createProductSchema),
  asyncHandler(createProductHandler)
);

productsRouter.patch(
  "/:id",
  requireAuth,
  validateBody(updateProductSchema),
  asyncHandler(updateProductHandler)
);

productsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(deleteProductHandler)
);
