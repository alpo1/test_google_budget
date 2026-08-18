import { Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { parseId } from "../utils/parse-id";
import { findAllCategories, findCategoryById } from "../repositories/category.repository";
import { createCategory, updateCategory, deleteCategory } from "../services/category.service";

export async function listCategories(_req: Request, res: Response): Promise<void> {
  const categories = await findAllCategories();
  res.status(200).json(categories);
}

export async function getCategory(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const category = await findCategoryById(id);
  if (!category) {
    throw new AppError(404, "Category not found");
  }
  res.status(200).json(category);
}

export async function createCategoryHandler(req: Request, res: Response): Promise<void> {
  const category = await createCategory(req.body, req.user!.id);
  res.status(201).json(category);
}

export async function updateCategoryHandler(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const category = await updateCategory(id, req.body, req.user!.id);
  if (!category) {
    throw new AppError(404, "Category not found");
  }
  res.status(200).json(category);
}

export async function deleteCategoryHandler(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const deleted = await deleteCategory(id, req.user!.id);
  if (!deleted) {
    throw new AppError(404, "Category not found");
  }
  res.status(204).send();
}
