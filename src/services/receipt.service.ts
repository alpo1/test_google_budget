import {
  createReceiptWithItems as createReceiptWithItemsRepo,
  CreateReceiptData,
  ReceiptWithItems,
} from "../repositories/receipt.repository";
import { recordAudit } from "./audit.service";

export async function createReceipt(
  data: CreateReceiptData,
  userId: number
): Promise<ReceiptWithItems> {
  const receipt = await createReceiptWithItemsRepo(data, userId);

  recordAudit({
    userId,
    action: "receipt.created",
    entityType: "receipt",
    entityId: receipt.id,
    details: {
      store_id: receipt.store_id,
      total: receipt.total,
      itemCount: receipt.items.length,
    },
  });

  return receipt;
}
