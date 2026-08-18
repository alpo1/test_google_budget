import {
  createCategory as createCategoryRepo,
  updateCategory as updateCategoryRepo,
  deleteCategory as deleteCategoryRepo,
  CreateCategoryData,
  UpdateCategoryData,
  CategoryRow,
} from "../repositories/category.repository";
import { recordAudit } from "./audit.service";

export async function createCategory(
  data: CreateCategoryData,
  userId: number
): Promise<CategoryRow> {
  const category = await createCategoryRepo(data);

  recordAudit({
    userId,
    action: "category.created",
    entityType: "category",
    entityId: category.id,
    details: { name: category.name, monthly_budget: category.monthly_budget, color: category.color },
  });

  return category;
}

export async function updateCategory(
  id: number,
  data: UpdateCategoryData,
  userId: number
): Promise<CategoryRow | null> {
  const category = await updateCategoryRepo(id, data);

  if (category) {
    recordAudit({
      userId,
      action: "category.updated",
      entityType: "category",
      entityId: category.id,
      details: { ...data },
    });
  }

  return category;
}

export async function deleteCategory(id: number, userId: number): Promise<boolean> {
  const deleted = await deleteCategoryRepo(id);

  if (deleted) {
    recordAudit({
      userId,
      action: "category.deleted",
      entityType: "category",
      entityId: id,
      details: {},
    });
  }

  return deleted;
}
