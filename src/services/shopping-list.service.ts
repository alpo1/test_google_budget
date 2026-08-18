import {
  CreateShoppingListItemData,
  ShoppingListItemRow,
  UpdateShoppingListItemData,
  createShoppingListItem as createShoppingListItemRep,
  updateShoppingListItem as updateShoppingListItemRep,
  setShoppingListItemChecked as setShoppingListItemCheckedRep,
  deleteShoppingListItem as deleteShoppingListItemRep,
} from "../repositories/shopping-list.repository";
import { recordAudit } from "./audit.service";

export async function createShoppingListItem(
  data: CreateShoppingListItemData,
  userId: number
): Promise<ShoppingListItemRow> {
  const item = await createShoppingListItemRep(data, userId);

  recordAudit({
    userId,
    action: "shopping_list_item.created",
    entityType: "shopping_list_item",
    entityId: item.id,
    details: {
      name: item.name,
      quantity: item.quantity,
      product_id: item.product_id,
    },
  });

  return item;
}

export async function updateShoppingListItem(
  id: number,
  data: UpdateShoppingListItemData,
  userId: number
): Promise<ShoppingListItemRow | null> {
  const item = await updateShoppingListItemRep(id, data);

  if (item) {
    recordAudit({
      userId,
      action: "shopping_list_item.updated",
      entityType: "shopping_list_item",
      entityId: item.id,
      details: { ...data },
    });
  }

  return item;
}

export async function setShoppingListItemChecked(
  id: number,
  isChecked: boolean,
  userId: number
): Promise<ShoppingListItemRow | null> {
  const item = await setShoppingListItemCheckedRep(id, isChecked);

  if (item) {
    recordAudit({
      userId,
      action: isChecked
        ? "shopping_list_item.checked"
        : "shopping_list_item.unchecked",
      entityType: "shopping_list_item",
      entityId: item.id,
      details: {},
    });
  }

  return item;
}

export async function deleteShoppingListItem(
  id: number,
  userId: number
): Promise<boolean> {
  const deleted = await deleteShoppingListItemRep(id);

  if (deleted) {
    recordAudit({
      userId,
      action: "shopping_list_item.deleted",
      entityType: "shopping_list_item",
      entityId: id,
      details: {},
    });
  }

  return deleted;
}
