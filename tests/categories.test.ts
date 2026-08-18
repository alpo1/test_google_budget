import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { AppError } from "../src/errors/app-error";
import {
  findAllCategories,
  findCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  CategoryRow,
} from "../src/repositories/category.repository";

jest.mock("../src/repositories/category.repository", () => ({
  findAllCategories: jest.fn(),
  findCategoryById: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
}));

jest.mock("../src/services/audit.service", () => ({
  recordAudit: jest.fn(),
}));

const mockedFindAllCategories = jest.mocked(findAllCategories);
const mockedFindCategoryById = jest.mocked(findCategoryById);
const mockedCreateCategory = jest.mocked(createCategory);
const mockedUpdateCategory = jest.mocked(updateCategory);
const mockedDeleteCategory = jest.mocked(deleteCategory);

const memberToken = jwt.sign({ sub: 1, role: "member" }, env.JWT_SECRET, { expiresIn: "1h" });
const adminToken = jwt.sign({ sub: 2, role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });

const sampleCategory: CategoryRow = {
  id: 1,
  name: "Groceries",
  monthly_budget: "500.00",
  color: "#00ff00",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

describe("categories resource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /categories", () => {
    it("returns 200 with an array", async () => {
      mockedFindAllCategories.mockResolvedValue([sampleCategory]);

      const res = await request(app)
        .get("/categories")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).get("/categories");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /categories/:id", () => {
    it("returns 200 when found", async () => {
      mockedFindCategoryById.mockResolvedValue(sampleCategory);

      const res = await request(app)
        .get("/categories/1")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, name: "Groceries", monthly_budget: "500.00" });
    });

    it("returns 404 when not found", async () => {
      mockedFindCategoryById.mockResolvedValue(null);

      const res = await request(app)
        .get("/categories/999")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 400 for a non-numeric id", async () => {
      const res = await request(app)
        .get("/categories/abc")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe("POST /categories", () => {
    it("returns 201 with a valid body", async () => {
      mockedCreateCategory.mockResolvedValue(sampleCategory);

      const res = await request(app)
        .post("/categories")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Groceries", monthly_budget: 500, color: "#00ff00" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 1, name: "Groceries", monthly_budget: "500.00" });
    });

    it("returns 400 when name is missing", async () => {
      const res = await request(app)
        .post("/categories")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ monthly_budget: 100 });

      expect(res.status).toBe(400);
      expect(mockedCreateCategory).not.toHaveBeenCalled();
    });

    it("returns 400 when name is blank", async () => {
      const res = await request(app)
        .post("/categories")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "   " });

      expect(res.status).toBe(400);
      expect(mockedCreateCategory).not.toHaveBeenCalled();
    });

    it("returns 400 on a negative monthly_budget", async () => {
      const res = await request(app)
        .post("/categories")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Groceries", monthly_budget: -10 });

      expect(res.status).toBe(400);
      expect(mockedCreateCategory).not.toHaveBeenCalled();
    });

    it("returns 409 on a duplicate name", async () => {
      mockedCreateCategory.mockRejectedValue(
        new AppError(409, "A category with this name already exists")
      );

      const res = await request(app)
        .post("/categories")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Groceries" });

      expect(res.status).toBe(409);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).post("/categories").send({ name: "Groceries" });
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /categories/:id", () => {
    it("returns 200 with a valid body", async () => {
      mockedUpdateCategory.mockResolvedValue({ ...sampleCategory, name: "Dining" });

      const res = await request(app)
        .patch("/categories/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Dining" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: "Dining" });
    });

    it("returns 404 when not found", async () => {
      mockedUpdateCategory.mockResolvedValue(null);

      const res = await request(app)
        .patch("/categories/999")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Dining" });

      expect(res.status).toBe(404);
    });

    it("returns 400 on an empty body", async () => {
      const res = await request(app)
        .patch("/categories/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(mockedUpdateCategory).not.toHaveBeenCalled();
    });

    it("returns 409 on a duplicate name", async () => {
      mockedUpdateCategory.mockRejectedValue(
        new AppError(409, "A category with this name already exists")
      );

      const res = await request(app)
        .patch("/categories/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Dining" });

      expect(res.status).toBe(409);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).patch("/categories/1").send({ name: "Dining" });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /categories/:id", () => {
    it("returns 204 as admin", async () => {
      mockedDeleteCategory.mockResolvedValue(true);

      const res = await request(app)
        .delete("/categories/1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it("returns 403 as a member", async () => {
      const res = await request(app)
        .delete("/categories/1")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(mockedDeleteCategory).not.toHaveBeenCalled();
    });

    it("returns 404 as admin when missing", async () => {
      mockedDeleteCategory.mockResolvedValue(false);

      const res = await request(app)
        .delete("/categories/999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 400 for a bad id", async () => {
      const res = await request(app)
        .delete("/categories/abc")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).delete("/categories/1");
      expect(res.status).toBe(401);
    });
  });
});
