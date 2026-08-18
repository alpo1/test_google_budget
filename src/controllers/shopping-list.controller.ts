import { Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { parseId } from "../utils/parse-id";
import {
  findAllShoppingListItems,
  findShoppingListItemById,
} from "../repositories/shopping-list.repository";
import {
  createShoppingListItem,
  deleteShoppingListItem,
  setShoppingListItemChecked,
  updateShoppingListItem,
} from "../services/shopping-list.service";

export async function listShoppingListItems(
  _req: Request,
  res: Response
): Promise<void> {
  const items = await findAllShoppingListItems();
  res.status(200).json(items);
}

export async function getShoppingListItem(
  req: Request,
  res: Response
): Promise<void> {
  const id = parseId(req.params.id);
  const item = await findShoppingListItemById(id);
  if (!item) {
    throw new AppError(404, "Shopping list item not found");
  }
  res.status(200).json(item);
}

export async function createShoppingListItemHandler(
  req: Request,
  res: Response
): Promise<void> {
  const item = await createShoppingListItem(req.body, req.user!.id);
  res.status(201).json(item);
}

export async function updateShoppingListItemHandler(
  req: Request,
  res: Response
): Promise<void> {
  const id = parseId(req.params.id);
  const item = await updateShoppingListItem(id, req.body, req.user!.id);
  if (!item) {
    throw new AppError(404, "Shopping list item not found");
  }
  res.status(200).json(item);
}

export async function checkShoppingListItemHandler(
  req: Request,
  res: Response
): Promise<void> {
  const id = parseId(req.params.id);
  const item = await setShoppingListItemChecked(
    id,
    req.body.is_checked,
    req.user!.id
  );
  if (!item) {
    throw new AppError(404, "Shopping list item not found");
  }
  res.status(200).json(item);
}

export async function deleteShoppingListItemHandler(
  req: Request,
  res: Response
): Promise<void> {
  const id = parseId(req.params.id);
  const deleted = await deleteShoppingListItem(id, req.user!.id);
  if (!deleted) {
    throw new AppError(404, "Shopping list item not found");
  }
  res.status(204).send();
}
