import {
  CreateProductData,
  ProductRow,
  UpdateProductData,
  createProduct as createProductRep,
  updateProduct as updateProductRep,
  deleteProduct as deleteProductRep,
} from "../repositories/product.repository";
import { recordAudit } from "./audit.service";

export async function createProduct(
  data: CreateProductData,
  userId: number
): Promise<ProductRow> {
  const product = await createProductRep(data);

  recordAudit({
    userId,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    details: {
      name: product.name,
      barcode: product.barcode,
      brand: product.brand,
    },
  });

  return product;
}

export async function updateProduct(
  id: number,
  data: UpdateProductData,
  userId: number
): Promise<ProductRow | null> {
  const product = await updateProductRep(id, data);

  if (product) {
    recordAudit({
      userId,
      action: "product.updated",
      entityType: "product",
      entityId: product.id,
      details: { ...data },
    });
  }

  return product;
}

export async function deleteProduct(
  id: number,
  userId: number
): Promise<boolean> {
  const deletedProd = await deleteProductRep(id);

  if (deletedProd) {
    recordAudit({
      userId,
      action: "product.deleted",
      entityType: "product",
      entityId: id,
      details: {},
    });
  }
  return deletedProd;
}
