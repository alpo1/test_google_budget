import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { createStoreSchema, updateStoreSchema } from "../validators/store.validators";
import {
  listStores,
  getStore,
  createStoreHandler,
  updateStoreHandler,
  deleteStoreHandler,
} from "../controllers/store.controller";

export const storesRouter = Router();

storesRouter.get("/", requireAuth, asyncHandler(listStores));
storesRouter.get("/:id", requireAuth, asyncHandler(getStore));

storesRouter.post(
  "/",
  requireAuth,
  validateBody(createStoreSchema),
  asyncHandler(createStoreHandler)
);

storesRouter.patch(
  "/:id",
  requireAuth,
  validateBody(updateStoreSchema),
  asyncHandler(updateStoreHandler)
);

storesRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(deleteStoreHandler)
);
