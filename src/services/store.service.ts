import {
  createStore as createStoreRepo,
  updateStore as updateStoreRepo,
  deleteStore as deleteStoreRepo,
  CreateStoreData,
  UpdateStoreData,
  StoreRow,
} from "../repositories/store.repository";
import { recordAudit } from "./audit.service";

export async function createStore(data: CreateStoreData, userId: number): Promise<StoreRow> {
  const store = await createStoreRepo(data);

  recordAudit({
    userId,
    action: "store.created",
    entityType: "store",
    entityId: store.id,
    details: { name: store.name, chain: store.chain, location: store.location },
  });

  return store;
}

export async function updateStore(
  id: number,
  data: UpdateStoreData,
  userId: number
): Promise<StoreRow | null> {
  const store = await updateStoreRepo(id, data);

  if (store) {
    recordAudit({
      userId,
      action: "store.updated",
      entityType: "store",
      entityId: store.id,
      details: { ...data },
    });
  }

  return store;
}

export async function deleteStore(id: number, userId: number): Promise<boolean> {
  const deleted = await deleteStoreRepo(id);

  if (deleted) {
    recordAudit({
      userId,
      action: "store.deleted",
      entityType: "store",
      entityId: id,
      details: {},
    });
  }

  return deleted;
}
