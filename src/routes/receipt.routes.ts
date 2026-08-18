import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/require-auth";
import { createReceiptSchema } from "../validators/receipt.validators";
import {
  listReceipts,
  getReceipt,
  createReceiptHandler,
} from "../controllers/receipt.controller";

export const receiptsRouter = Router();

receiptsRouter.get("/", requireAuth, asyncHandler(listReceipts));
receiptsRouter.get("/:id", requireAuth, asyncHandler(getReceipt));

receiptsRouter.post(
  "/",
  requireAuth,
  validateBody(createReceiptSchema),
  asyncHandler(createReceiptHandler)
);
