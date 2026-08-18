import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import {
  findAllStores,
  findStoreById,
  createStore,
  updateStore,
  deleteStore,
  StoreRow,
} from "../src/repositories/store.repository";

jest.mock("../src/repositories/store.repository", () => ({
  findAllStores: jest.fn(),
  findStoreById: jest.fn(),
  createStore: jest.fn(),
  updateStore: jest.fn(),
  deleteStore: jest.fn(),
}));

jest.mock("../src/services/audit.service", () => ({
  recordAudit: jest.fn(),
}));

const mockedFindAllStores = jest.mocked(findAllStores);
const mockedFindStoreById = jest.mocked(findStoreById);
const mockedCreateStore = jest.mocked(createStore);
const mockedUpdateStore = jest.mocked(updateStore);
const mockedDeleteStore = jest.mocked(deleteStore);

const memberToken = jwt.sign({ sub: 1, role: "member" }, env.JWT_SECRET, { expiresIn: "1h" });
const adminToken = jwt.sign({ sub: 2, role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });

const sampleStore: StoreRow = {
  id: 1,
  name: "Rami Levy",
  chain: "Rami Levy",
  location: "Tel Aviv",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

describe("stores resource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /stores", () => {
    it("returns 200 with an array", async () => {
      mockedFindAllStores.mockResolvedValue([sampleStore]);

      const res = await request(app)
        .get("/stores")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).get("/stores");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /stores/:id", () => {
    it("returns 200 when found", async () => {
      mockedFindStoreById.mockResolvedValue(sampleStore);

      const res = await request(app)
        .get("/stores/1")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, name: "Rami Levy" });
    });

    it("returns 404 when not found", async () => {
      mockedFindStoreById.mockResolvedValue(null);

      const res = await request(app)
        .get("/stores/999")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 400 for a non-numeric id", async () => {
      const res = await request(app)
        .get("/stores/abc")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe("POST /stores", () => {
    it("returns 201 with a valid body", async () => {
      mockedCreateStore.mockResolvedValue(sampleStore);

      const res = await request(app)
        .post("/stores")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Rami Levy", chain: "Rami Levy", location: "Tel Aviv" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 1, name: "Rami Levy" });
    });

    it("returns 400 when name is missing", async () => {
      const res = await request(app)
        .post("/stores")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ chain: "Rami Levy" });

      expect(res.status).toBe(400);
      expect(mockedCreateStore).not.toHaveBeenCalled();
    });

    it("returns 400 when name is blank", async () => {
      const res = await request(app)
        .post("/stores")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "   " });

      expect(res.status).toBe(400);
      expect(mockedCreateStore).not.toHaveBeenCalled();
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).post("/stores").send({ name: "Rami Levy" });
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /stores/:id", () => {
    it("returns 200 with a valid body", async () => {
      mockedUpdateStore.mockResolvedValue({ ...sampleStore, name: "Shufersal" });

      const res = await request(app)
        .patch("/stores/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Shufersal" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: "Shufersal" });
    });

    it("returns 404 when not found", async () => {
      mockedUpdateStore.mockResolvedValue(null);

      const res = await request(app)
        .patch("/stores/999")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Shufersal" });

      expect(res.status).toBe(404);
    });

    it("returns 400 on an empty body", async () => {
      const res = await request(app)
        .patch("/stores/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(mockedUpdateStore).not.toHaveBeenCalled();
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).patch("/stores/1").send({ name: "Shufersal" });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /stores/:id", () => {
    it("returns 204 as admin", async () => {
      mockedDeleteStore.mockResolvedValue(true);

      const res = await request(app)
        .delete("/stores/1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it("returns 403 as a member", async () => {
      const res = await request(app)
        .delete("/stores/1")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(mockedDeleteStore).not.toHaveBeenCalled();
    });

    it("returns 404 as admin when missing", async () => {
      mockedDeleteStore.mockResolvedValue(false);

      const res = await request(app)
        .delete("/stores/999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 400 for a bad id", async () => {
      const res = await request(app)
        .delete("/stores/abc")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).delete("/stores/1");
      expect(res.status).toBe(401);
    });
  });
});
