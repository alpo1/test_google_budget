import { Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { parseId } from "../utils/parse-id";
import { findAllStores, findStoreById } from "../repositories/store.repository";
import { createStore, updateStore, deleteStore } from "../services/store.service";

export async function listStores(_req: Request, res: Response): Promise<void> {
  const stores = await findAllStores();
  res.status(200).json(stores);
}

export async function getStore(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const store = await findStoreById(id);
  if (!store) {
    throw new AppError(404, "Store not found");
  }
  res.status(200).json(store);
}

export async function createStoreHandler(req: Request, res: Response): Promise<void> {
  const store = await createStore(req.body, req.user!.id);
  res.status(201).json(store);
}

export async function updateStoreHandler(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const store = await updateStore(id, req.body, req.user!.id);
  if (!store) {
    throw new AppError(404, "Store not found");
  }
  res.status(200).json(store);
}

export async function deleteStoreHandler(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const deleted = await deleteStore(id, req.user!.id);
  if (!deleted) {
    throw new AppError(404, "Store not found");
  }
  res.status(204).send();
}
