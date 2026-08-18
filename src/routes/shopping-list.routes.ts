import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/require-auth";
import {
  createShoppingListItemSchema,
  updateShoppingListItemSchema,
  checkShoppingListItemSchema,
} from "../validators/shopping-list.validators";
import {
  listShoppingListItems,
  getShoppingListItem,
  createShoppingListItemHandler,
  updateShoppingListItemHandler,
  checkShoppingListItemHandler,
  deleteShoppingListItemHandler,
} from "../controllers/shopping-list.controller";

export const shoppingListRouter = Router();

shoppingListRouter.get("/", requireAuth, asyncHandler(listShoppingListItems));
shoppingListRouter.get("/:id", requireAuth, asyncHandler(getShoppingListItem));

shoppingListRouter.post(
  "/",
  requireAuth,
  validateBody(createShoppingListItemSchema),
  asyncHandler(createShoppingListItemHandler)
);

shoppingListRouter.patch(
  "/:id",
  requireAuth,
  validateBody(updateShoppingListItemSchema),
  asyncHandler(updateShoppingListItemHandler)
);

shoppingListRouter.patch(
  "/:id/check",
  requireAuth,
  validateBody(checkShoppingListItemSchema),
  asyncHandler(checkShoppingListItemHandler)
);

shoppingListRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(deleteShoppingListItemHandler)
);
