import { Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { parseId } from "../utils/parse-id";
import { findAllReceipts, findReceiptWithItems } from "../repositories/receipt.repository";
import { createReceipt } from "../services/receipt.service";

export async function listReceipts(_req: Request, res: Response): Promise<void> {
  const receipts = await findAllReceipts();
  res.status(200).json(receipts);
}

export async function getReceipt(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const receipt = await findReceiptWithItems(id);
  if (!receipt) {
    throw new AppError(404, "Receipt not found");
  }
  res.status(200).json(receipt);
}

export async function createReceiptHandler(req: Request, res: Response): Promise<void> {
  const receipt = await createReceipt(req.body, req.user!.id);
  res.status(201).json(receipt);
}
