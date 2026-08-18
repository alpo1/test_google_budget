import { Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { parseId } from "../utils/parse-id";
import {
  findAllProducts,
  findProductById,
} from "../repositories/product.repository";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "../services/product.service";

export async function listProducts(
  _req: Request,
  res: Response
): Promise<void> {
  const product = await findAllProducts();
  res.status(200).json(product);
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const product = await findProductById(id);
  if (!product) {
    throw new AppError(404, "Product not found");
  }
  res.status(200).json(product);
}

export async function createProductHandler(
  req: Request,
  res: Response
): Promise<void> {
  const product = await createProduct(req.body, req.user!.id);
  res.status(201).json(product);
}

export async function updateProductHandler(
  req: Request,
  res: Response
): Promise<void> {
  const id = parseId(req.params.id);
  const product = await updateProduct(id, req.body, req.user!.id);
  if (!product) {
    throw new AppError(404, "Product not found");
  }
  res.status(200).json(product);
}

export async function deleteProductHandler(
  req: Request,
  res: Response
): Promise<void> {
  const id = parseId(req.params.id);
  const deleted = await deleteProduct(id, req.user!.id);
  if (!deleted) {
    throw new AppError(404, "Product not found");
  }
  res.status(204).send();
}
