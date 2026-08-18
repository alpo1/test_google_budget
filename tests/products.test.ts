import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { AppError } from "../src/errors/app-error";
import {
  findAllProducts,
  findProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  ProductRow,
} from "../src/repositories/product.repository";
import { recordAudit } from "../src/services/audit.service";

// Mock the repository layer: the real product.service runs on top of these
// fakes, so the service (audit call, passthrough) is exercised too — same
// convention as stores/categories tests. The 409/400 domain errors are thrown
// by the repository, so we drive them by making the mocked repo reject.
jest.mock("../src/repositories/product.repository", () => ({
  findAllProducts: jest.fn(),
  findProductById: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
}));

// Fire-and-forget audit is mocked so nothing reaches Mongo during tests.
jest.mock("../src/services/audit.service", () => ({
  recordAudit: jest.fn(),
}));

const mockedFindAllProducts = jest.mocked(findAllProducts);
const mockedFindProductById = jest.mocked(findProductById);
const mockedCreateProduct = jest.mocked(createProduct);
const mockedUpdateProduct = jest.mocked(updateProduct);
const mockedDeleteProduct = jest.mocked(deleteProduct);
const mockedRecordAudit = jest.mocked(recordAudit);

const memberToken = jwt.sign({ sub: 1, role: "member" }, env.JWT_SECRET, {
  expiresIn: "1h",
});
const adminToken = jwt.sign({ sub: 2, role: "admin" }, env.JWT_SECRET, {
  expiresIn: "1h",
});

// ProductRow has no created_at (neither the interface nor the SELECT expose it),
// so the sample is exactly the five persisted fields.
const sampleProduct: ProductRow = {
  id: 1,
  name: "Milk",
  barcode: "7290000000001",
  brand: "Tnuva",
  default_category_id: 3,
};

// A loose/weighed item: no barcode. barcode is UNIQUE but nullable, so any
// number of these may coexist without colliding.
const looseProduct: ProductRow = {
  id: 2,
  name: "Bananas",
  barcode: null,
  brand: null,
  default_category_id: null,
};

describe("products resource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /products", () => {
    it("returns 200 with an array", async () => {
      mockedFindAllProducts.mockResolvedValue([sampleProduct, looseProduct]);

      const res = await request(app)
        .get("/products")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).get("/products");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /products/:id", () => {
    it("returns 200 with the product when found", async () => {
      mockedFindProductById.mockResolvedValue(sampleProduct);

      const res = await request(app)
        .get("/products/1")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, name: "Milk" });
    });

    it("returns 404 when not found", async () => {
      mockedFindProductById.mockResolvedValue(null);

      const res = await request(app)
        .get("/products/999")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 400 for a non-numeric id", async () => {
      const res = await request(app)
        .get("/products/abc")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(400);
      expect(mockedFindProductById).not.toHaveBeenCalled();
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).get("/products/1");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /products", () => {
    it("returns 201 with the created product", async () => {
      mockedCreateProduct.mockResolvedValue(sampleProduct);

      const res = await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          name: "Milk",
          barcode: "7290000000001",
          brand: "Tnuva",
          default_category_id: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 1, name: "Milk" });
    });

    it("records audit authorship from the token, not the body", async () => {
      mockedCreateProduct.mockResolvedValue(sampleProduct);

      await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Milk", barcode: "7290000000001" });

      // Products have no created_by column — audit is the only record of
      // authorship, and it must come from the JWT (sub: 1), never the body.
      expect(mockedRecordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: "product.created",
          entityType: "product",
          entityId: 1,
        })
      );
    });

    it("returns 201 when barcode is omitted (loose item, barcode → null)", async () => {
      mockedCreateProduct.mockResolvedValue(looseProduct);

      const res = await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Bananas" });

      expect(res.status).toBe(201);
      expect(res.body.barcode).toBeNull();
    });

    it("returns 400 when name is missing (validation, repo not called)", async () => {
      const res = await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ barcode: "7290000000001" });

      expect(res.status).toBe(400);
      expect(mockedCreateProduct).not.toHaveBeenCalled();
    });

    it("returns 400 for an empty-string barcode (must be null, never '')", async () => {
      const res = await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Milk", barcode: "" });

      expect(res.status).toBe(400);
      expect(mockedCreateProduct).not.toHaveBeenCalled();
    });

    it("returns 409 for a duplicate barcode", async () => {
      mockedCreateProduct.mockRejectedValue(
        new AppError(409, "Product with this barcode already exists")
      );

      const res = await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Milk", barcode: "7290000000001" });

      expect(res.status).toBe(409);
    });

    it("returns 400 for a non-existent default_category_id", async () => {
      mockedCreateProduct.mockRejectedValue(
        new AppError(400, "default_category_id references a non-existent category")
      );

      const res = await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Milk", default_category_id: 999 });

      expect(res.status).toBe(400);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).post("/products").send({ name: "Milk" });
      expect(res.status).toBe(401);
      expect(mockedCreateProduct).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /products/:id", () => {
    it("returns 200 with the updated product", async () => {
      mockedUpdateProduct.mockResolvedValue({ ...sampleProduct, brand: "Yotvata" });

      const res = await request(app)
        .patch("/products/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ brand: "Yotvata" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, brand: "Yotvata" });
    });

    it("returns 404 when the product does not exist", async () => {
      mockedUpdateProduct.mockResolvedValue(null);

      const res = await request(app)
        .patch("/products/999")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ brand: "Yotvata" });

      expect(res.status).toBe(404);
    });

    it("returns 409 when the new barcode collides", async () => {
      mockedUpdateProduct.mockRejectedValue(
        new AppError(409, "Product with this barcode already exists")
      );

      const res = await request(app)
        .patch("/products/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ barcode: "7290000000001" });

      expect(res.status).toBe(409);
    });

    it("returns 400 for an empty-string barcode", async () => {
      const res = await request(app)
        .patch("/products/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ barcode: "" });

      expect(res.status).toBe(400);
      expect(mockedUpdateProduct).not.toHaveBeenCalled();
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).patch("/products/1").send({ brand: "X" });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /products/:id", () => {
    it("returns 204 when an admin deletes an existing product", async () => {
      mockedDeleteProduct.mockResolvedValue(true);

      const res = await request(app)
        .delete("/products/1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it("returns 404 when the product does not exist", async () => {
      mockedDeleteProduct.mockResolvedValue(false);

      const res = await request(app)
        .delete("/products/999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 403 for a member (admin-only)", async () => {
      const res = await request(app)
        .delete("/products/1")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(mockedDeleteProduct).not.toHaveBeenCalled();
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).delete("/products/1");
      expect(res.status).toBe(401);
      expect(mockedDeleteProduct).not.toHaveBeenCalled();
    });
  });
});
