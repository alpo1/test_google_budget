import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { AppError } from "../src/errors/app-error";
import {
  findAllReceipts,
  findReceiptWithItems,
  createReceiptWithItems,
} from "../src/repositories/receipt.repository";
import type {
  CreateReceiptData,
  ReceiptWithItems,
  ReceiptRow,
  ReceiptItemRow,
} from "../src/repositories/receipt.repository";

jest.mock("../src/repositories/receipt.repository", () => ({
  findAllReceipts: jest.fn(),
  findReceiptWithItems: jest.fn(),
  createReceiptWithItems: jest.fn(),
}));

jest.mock("../src/services/audit.service", () => ({
  recordAudit: jest.fn(),
}));

jest.mock("../src/config/postgres", () => ({
  pool: { connect: jest.fn() },
  query: jest.fn(),
}));

const mockedFindAllReceipts = jest.mocked(findAllReceipts);
const mockedFindReceiptWithItems = jest.mocked(findReceiptWithItems);
const mockedCreateReceiptWithItems = jest.mocked(createReceiptWithItems);

const memberToken = jwt.sign({ sub: 1, role: "member" }, env.JWT_SECRET, { expiresIn: "1h" });

const sampleReceipt: ReceiptWithItems = {
  id: 1,
  store_id: 2,
  category_id: 3,
  created_by: 1,
  status: "confirmed",
  source: "manual",
  total: "45.99",
  currency: "ILS",
  image_path: null,
  purchased_at: new Date("2026-08-01T12:00:00.000Z"),
  created_at: new Date("2026-08-01T12:00:00.000Z"),
  items: [
    {
      id: 1,
      receipt_id: 1,
      product_id: null,
      description: "Milk",
      quantity: "2.000",
      unit_price: "5.00",
    },
    {
      id: 2,
      receipt_id: 1,
      product_id: null,
      description: "Bread",
      quantity: "1.000",
      unit_price: "10.00",
    },
  ],
};

describe("receipts resource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /receipts", () => {
    it("returns 201 and preserves the sent total, not the item sum", async () => {
      mockedCreateReceiptWithItems.mockResolvedValue(sampleReceipt);

      const res = await request(app)
        .post("/receipts")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          total: 45.99, // deliberately != 2*5.00 + 1*10.00 (20.00)
          items: [
            { description: "Milk", quantity: 2, unit_price: 5 },
            { description: "Bread", quantity: 1, unit_price: 10 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.total).toBe("45.99");
      expect(res.body.items).toHaveLength(2);
      expect(mockedCreateReceiptWithItems).toHaveBeenCalledWith(
        expect.objectContaining({ total: 45.99 }),
        1
      );
    });

    it("returns 400 for zero items", async () => {
      const res = await request(app)
        .post("/receipts")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ total: 10, items: [] });

      expect(res.status).toBe(400);
      expect(mockedCreateReceiptWithItems).not.toHaveBeenCalled();
    });

    it("accepts a purchased_at with a numeric offset", async () => {
      mockedCreateReceiptWithItems.mockResolvedValue(sampleReceipt);

      const res = await request(app)
        .post("/receipts")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          total: 10,
          purchased_at: "2026-08-01T15:00:00+03:00",
          items: [{ description: "Milk", unit_price: 10 }],
        });

      expect(res.status).toBe(201);
    });

    it("accepts a purchased_at with a Z suffix", async () => {
      mockedCreateReceiptWithItems.mockResolvedValue(sampleReceipt);

      const res = await request(app)
        .post("/receipts")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          total: 10,
          purchased_at: "2026-08-01T12:00:00Z",
          items: [{ description: "Milk", unit_price: 10 }],
        });

      expect(res.status).toBe(201);
    });

    it("returns 400 when an item references a nonexistent product", async () => {
      mockedCreateReceiptWithItems.mockRejectedValue(
        new AppError(400, "product 999 does not exist")
      );

      const res = await request(app)
        .post("/receipts")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          total: 10,
          items: [{ description: "Widget", unit_price: 10, product_id: 999 }],
        });

      expect(res.status).toBe(400);
    });

    it("returns 400 for a nonexistent store_id", async () => {
      mockedCreateReceiptWithItems.mockRejectedValue(
        new AppError(400, "store 999 does not exist")
      );

      const res = await request(app)
        .post("/receipts")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          store_id: 999,
          total: 10,
          items: [{ description: "Milk", unit_price: 10 }],
        });

      expect(res.status).toBe(400);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app)
        .post("/receipts")
        .send({ total: 10, items: [{ description: "Milk", unit_price: 10 }] });

      expect(res.status).toBe(401);
    });

    it("ignores a client-supplied created_by", async () => {
      mockedCreateReceiptWithItems.mockResolvedValue(sampleReceipt);

      await request(app)
        .post("/receipts")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          total: 10,
          created_by: 999,
          items: [{ description: "Milk", unit_price: 10 }],
        });

      const [forwardedBody, createdBy] = mockedCreateReceiptWithItems.mock.calls[0];
      expect(forwardedBody).not.toHaveProperty("created_by");
      expect(createdBy).toBe(1);
    });
  });

  describe("GET /receipts/:id", () => {
    it("returns 200 with items when found", async () => {
      mockedFindReceiptWithItems.mockResolvedValue(sampleReceipt);

      const res = await request(app)
        .get("/receipts/1")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
    });

    it("returns 404 when not found", async () => {
      mockedFindReceiptWithItems.mockResolvedValue(null);

      const res = await request(app)
        .get("/receipts/999")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 400 for a non-numeric id", async () => {
      const res = await request(app)
        .get("/receipts/abc")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /receipts", () => {
    it("returns 200 with an array", async () => {
      mockedFindAllReceipts.mockResolvedValue([sampleReceipt]);

      const res = await request(app)
        .get("/receipts")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).get("/receipts");
      expect(res.status).toBe(401);
    });
  });
});

interface MockPoolClient {
  query: jest.Mock;
  release: jest.Mock;
}

interface MockPostgresModule {
  pool: { connect: jest.Mock<Promise<MockPoolClient>, []> };
  query: jest.Mock;
}

describe("createReceiptWithItems (rollback)", () => {
  it("rolls back an already-inserted item when a later item's product check fails", async () => {
    const { createReceiptWithItems: realCreateReceiptWithItems } = jest.requireActual<
      typeof import("../src/repositories/receipt.repository")
    >("../src/repositories/receipt.repository");
    const { pool } = jest.requireMock<MockPostgresModule>("../src/config/postgres");

    const client: MockPoolClient = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);

    const receiptFixture: ReceiptRow = {
      id: 1,
      store_id: null,
      category_id: null,
      created_by: 1,
      status: "confirmed",
      source: "manual",
      total: "50.00",
      currency: "ILS",
      image_path: null,
      purchased_at: new Date("2026-08-01T00:00:00.000Z"),
      created_at: new Date("2026-08-01T00:00:00.000Z"),
    };
    const itemFixture: ReceiptItemRow = {
      id: 1,
      receipt_id: 1,
      product_id: null,
      description: "Milk",
      quantity: "1.000",
      unit_price: "5.00",
    };

    client.query.mockImplementation((sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK" || sql === "COMMIT") {
        return Promise.resolve(undefined);
      }
      if (sql.startsWith("INSERT INTO receipts")) {
        return Promise.resolve({ rows: [receiptFixture] });
      }
      if (sql.startsWith("INSERT INTO receipt_items")) {
        return Promise.resolve({ rows: [itemFixture] });
      }
      if (sql.startsWith("SELECT 1 FROM products")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.reject(new Error(`Unexpected query: ${sql}`));
    });

    // Asymmetric on purpose: item 1 has no product_id (skips the check,
    // inserts cleanly — this is the row that must be proven rolled back);
    // item 2 has a product_id, hits the (mocked, always-empty) existence
    // check, and throws.
    const input: CreateReceiptData = {
      total: 50,
      items: [
        { description: "Milk", unit_price: 5 },
        { description: "Widget", unit_price: 10, product_id: 999 },
      ],
    };

    await expect(realCreateReceiptWithItems(input, 1)).rejects.toBeInstanceOf(AppError);

    const calledSql = client.query.mock.calls.map((call) => call[0] as string);
    expect(calledSql[0]).toBe("BEGIN");
    expect(calledSql).toContain("ROLLBACK");
    expect(calledSql).not.toContain("COMMIT");
    expect(calledSql.filter((sql) => sql.startsWith("INSERT INTO receipt_items"))).toHaveLength(1);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
