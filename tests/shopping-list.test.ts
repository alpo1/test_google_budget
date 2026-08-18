import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { AppError } from "../src/errors/app-error";
import {
  findAllShoppingListItems,
  findShoppingListItemById,
  createShoppingListItem,
  updateShoppingListItem,
  setShoppingListItemChecked,
  deleteShoppingListItem,
  ShoppingListItemRow,
} from "../src/repositories/shopping-list.repository";
import { recordAudit } from "../src/services/audit.service";

jest.mock("../src/repositories/shopping-list.repository", () => ({
  findAllShoppingListItems: jest.fn(),
  findShoppingListItemById: jest.fn(),
  createShoppingListItem: jest.fn(),
  updateShoppingListItem: jest.fn(),
  setShoppingListItemChecked: jest.fn(),
  deleteShoppingListItem: jest.fn(),
}));

jest.mock("../src/services/audit.service", () => ({
  recordAudit: jest.fn(),
}));

const mockedFindAllShoppingListItems = jest.mocked(findAllShoppingListItems);
const mockedFindShoppingListItemById = jest.mocked(findShoppingListItemById);
const mockedCreateShoppingListItem = jest.mocked(createShoppingListItem);
const mockedUpdateShoppingListItem = jest.mocked(updateShoppingListItem);
const mockedSetShoppingListItemChecked = jest.mocked(setShoppingListItemChecked);
const mockedDeleteShoppingListItem = jest.mocked(deleteShoppingListItem);
const mockedRecordAudit = jest.mocked(recordAudit);

const memberToken = jwt.sign({ sub: 1, role: "member" }, env.JWT_SECRET, {
  expiresIn: "1h",
});

const sampleItem: ShoppingListItemRow = {
  id: 1,
  name: "Apples",
  quantity: "2 kg",
  product_id: 10,
  added_by: 1,
  is_checked: false,
  checked_at: null,
  created_at: new Date("2026-08-18T10:00:00.000Z"),
};

const checkedItem: ShoppingListItemRow = {
  id: 1,
  name: "Apples",
  quantity: "2 kg",
  product_id: 10,
  added_by: 1,
  is_checked: true,
  checked_at: new Date("2026-08-18T10:30:00.000Z"),
  created_at: new Date("2026-08-18T10:00:00.000Z"),
};

const looseItem: ShoppingListItemRow = {
  id: 2,
  name: "Bread",
  quantity: "1 loaf",
  product_id: null,
  added_by: 1,
  is_checked: false,
  checked_at: null,
  created_at: new Date("2026-08-18T10:05:00.000Z"),
};

describe("shopping-list resource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /shopping-list", () => {
    it("returns 200 with an array", async () => {
      mockedFindAllShoppingListItems.mockResolvedValue([sampleItem, looseItem]);

      const res = await request(app)
        .get("/shopping-list")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(mockedFindAllShoppingListItems).toHaveBeenCalledTimes(1);
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).get("/shopping-list");
      expect(res.status).toBe(401);
      expect(mockedFindAllShoppingListItems).not.toHaveBeenCalled();
    });
  });

  describe("GET /shopping-list/:id", () => {
    it("returns 200 when found", async () => {
      mockedFindShoppingListItemById.mockResolvedValue(sampleItem);

      const res = await request(app)
        .get("/shopping-list/1")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1,
        name: "Apples",
        quantity: "2 kg",
        product_id: 10,
        added_by: 1,
        is_checked: false,
        checked_at: null,
      });
      expect(mockedFindShoppingListItemById).toHaveBeenCalledWith(1);
    });

    it("returns 404 when repo returns null", async () => {
      mockedFindShoppingListItemById.mockResolvedValue(null);

      const res = await request(app)
        .get("/shopping-list/999")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
      expect(mockedFindShoppingListItemById).toHaveBeenCalledWith(999);
    });

    it("returns 400 for a non-numeric id (repo not called)", async () => {
      const res = await request(app)
        .get("/shopping-list/invalid-id")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(400);
      expect(mockedFindShoppingListItemById).not.toHaveBeenCalled();
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).get("/shopping-list/1");
      expect(res.status).toBe(401);
      expect(mockedFindShoppingListItemById).not.toHaveBeenCalled();
    });
  });

  describe("POST /shopping-list", () => {
    it("returns 201 with the created item", async () => {
      mockedCreateShoppingListItem.mockResolvedValue(sampleItem);

      const res = await request(app)
        .post("/shopping-list")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          name: "Apples",
          quantity: "2 kg",
          product_id: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 1,
        name: "Apples",
        quantity: "2 kg",
        product_id: 10,
        added_by: 1,
        is_checked: false,
        checked_at: null,
      });
      expect(mockedCreateShoppingListItem).toHaveBeenCalledWith(
        {
          name: "Apples",
          quantity: "2 kg",
          product_id: 10,
        },
        1
      );
      expect(mockedRecordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: "shopping_list_item.created",
          entityType: "shopping_list_item",
          entityId: 1,
          details: {
            name: "Apples",
            quantity: "2 kg",
            product_id: 10,
          },
        })
      );
    });

    it("added_by is taken from the JWT (sub), not the body", async () => {
      mockedCreateShoppingListItem.mockResolvedValue(sampleItem);

      const res = await request(app)
        .post("/shopping-list")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          name: "Apples",
          added_by: 999,
        });

      expect(res.status).toBe(201);
      // Assert the repo was called with token user id 1, not 999
      expect(mockedCreateShoppingListItem).toHaveBeenCalledWith(
        {
          name: "Apples",
        },
        1
      );
    });

    it("is_checked cannot be injected (stripped by validator)", async () => {
      mockedCreateShoppingListItem.mockResolvedValue(sampleItem);

      const res = await request(app)
        .post("/shopping-list")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          name: "Apples",
          is_checked: true,
          checked_at: "2026-08-18T12:00:00Z",
        });

      expect(res.status).toBe(201);
      expect(mockedCreateShoppingListItem).toHaveBeenCalledWith(
        {
          name: "Apples",
        },
        1
      );
    });

    it("returns 400 when name is missing", async () => {
      const res = await request(app)
        .post("/shopping-list")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          quantity: "2 kg",
        });

      expect(res.status).toBe(400);
      expect(mockedCreateShoppingListItem).not.toHaveBeenCalled();
    });

    it("returns 400 when product_id references a non-existent product", async () => {
      mockedCreateShoppingListItem.mockRejectedValue(
        new AppError(400, "product_id references a non-existent product")
      );

      const res = await request(app)
        .post("/shopping-list")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          name: "Apples",
          product_id: 9999,
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "product_id references a non-existent product",
      });
    });

    it("returns 401 with no token", async () => {
      const res = await request(app)
        .post("/shopping-list")
        .send({ name: "Apples" });

      expect(res.status).toBe(401);
      expect(mockedCreateShoppingListItem).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /shopping-list/:id (general)", () => {
    it("returns 200 with the updated item", async () => {
      const updatedItem: ShoppingListItemRow = {
        ...sampleItem,
        name: "Green Apples",
        quantity: "3 kg",
      };
      mockedUpdateShoppingListItem.mockResolvedValue(updatedItem);

      const res = await request(app)
        .patch("/shopping-list/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          name: "Green Apples",
          quantity: "3 kg",
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1,
        name: "Green Apples",
        quantity: "3 kg",
      });
      expect(mockedUpdateShoppingListItem).toHaveBeenCalledWith(
        1,
        {
          name: "Green Apples",
          quantity: "3 kg",
        },
      );
      expect(mockedRecordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: "shopping_list_item.updated",
          entityType: "shopping_list_item",
          entityId: 1,
          details: {
            name: "Green Apples",
            quantity: "3 kg",
          },
        })
      );
    });

    it("returns 404 when repo returns null", async () => {
      mockedUpdateShoppingListItem.mockResolvedValue(null);

      const res = await request(app)
        .patch("/shopping-list/999")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Pears" });

      expect(res.status).toBe(404);
      expect(mockedUpdateShoppingListItem).toHaveBeenCalledWith(999, {
        name: "Pears",
      });
    });

    it("is_checked cannot be updated via general PATCH (stripped by validator)", async () => {
      mockedUpdateShoppingListItem.mockResolvedValue(sampleItem);

      const res = await request(app)
        .patch("/shopping-list/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          name: "Apples",
          is_checked: true,
        });

      expect(res.status).toBe(200);
      expect(mockedUpdateShoppingListItem).toHaveBeenCalledWith(1, {
        name: "Apples",
      });
    });

    it("returns 400 on empty body (no fields); repo not called", async () => {
      const res = await request(app)
        .patch("/shopping-list/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(mockedUpdateShoppingListItem).not.toHaveBeenCalled();
    });

    it("returns 400 on empty-string name; repo not called", async () => {
      const res = await request(app)
        .patch("/shopping-list/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "   " });

      expect(res.status).toBe(400);
      expect(mockedUpdateShoppingListItem).not.toHaveBeenCalled();
    });

    it("returns 400 when product_id is a bad ref (repo rejects AppError(400))", async () => {
      mockedUpdateShoppingListItem.mockRejectedValue(
        new AppError(400, "product_id references a non-existent product")
      );

      const res = await request(app)
        .patch("/shopping-list/1")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ product_id: 9999 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "product_id references a non-existent product",
      });
    });

    it("returns 401 with no token", async () => {
      const res = await request(app)
        .patch("/shopping-list/1")
        .send({ name: "Apples" });

      expect(res.status).toBe(401);
      expect(mockedUpdateShoppingListItem).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /shopping-list/:id/check", () => {
    it("returns 200 with is_checked=true and checked_at set (non-null) in the returned row", async () => {
      mockedSetShoppingListItemChecked.mockResolvedValue(checkedItem);

      const res = await request(app)
        .patch("/shopping-list/1/check")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ is_checked: true });

      expect(res.status).toBe(200);
      expect(res.body.is_checked).toBe(true);
      expect(res.body.checked_at).not.toBeNull();
      expect(mockedSetShoppingListItemChecked).toHaveBeenCalledWith(1, true);
      expect(mockedRecordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: "shopping_list_item.checked",
          entityType: "shopping_list_item",
          entityId: 1,
          details: {},
        })
      );
    });

    it("returns 200 with is_checked=false and checked_at=null in the returned row", async () => {
      mockedSetShoppingListItemChecked.mockResolvedValue(sampleItem);

      const res = await request(app)
        .patch("/shopping-list/1/check")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ is_checked: false });

      expect(res.status).toBe(200);
      expect(res.body.is_checked).toBe(false);
      expect(res.body.checked_at).toBeNull();
      expect(mockedSetShoppingListItemChecked).toHaveBeenCalledWith(1, false);
      expect(mockedRecordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: "shopping_list_item.unchecked",
          entityType: "shopping_list_item",
          entityId: 1,
          details: {},
        })
      );
    });

    it("returns 404 when repo returns null", async () => {
      mockedSetShoppingListItemChecked.mockResolvedValue(null);

      const res = await request(app)
        .patch("/shopping-list/999/check")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ is_checked: true });

      expect(res.status).toBe(404);
      expect(mockedSetShoppingListItemChecked).toHaveBeenCalledWith(999, true);
    });

    it("returns 400 when is_checked is missing or not a boolean; repo not called", async () => {
      const res1 = await request(app)
        .patch("/shopping-list/1/check")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({});

      expect(res1.status).toBe(400);
      expect(mockedSetShoppingListItemChecked).not.toHaveBeenCalled();

      const res2 = await request(app)
        .patch("/shopping-list/1/check")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ is_checked: "true" });

      expect(res2.status).toBe(400);
      expect(mockedSetShoppingListItemChecked).not.toHaveBeenCalled();
    });

    it("returns 401 with no token", async () => {
      const res = await request(app)
        .patch("/shopping-list/1/check")
        .send({ is_checked: true });

      expect(res.status).toBe(401);
      expect(mockedSetShoppingListItemChecked).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /shopping-list/:id", () => {
    it("returns 204 when a member deletes an existing item (proves it is NOT admin-only)", async () => {
      mockedDeleteShoppingListItem.mockResolvedValue(true);

      const res = await request(app)
        .delete("/shopping-list/1")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(mockedDeleteShoppingListItem).toHaveBeenCalledWith(1);
      expect(mockedRecordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: "shopping_list_item.deleted",
          entityType: "shopping_list_item",
          entityId: 1,
          details: {},
        })
      );
    });

    it("returns 404 when repo returns false", async () => {
      mockedDeleteShoppingListItem.mockResolvedValue(false);

      const res = await request(app)
        .delete("/shopping-list/999")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
      expect(mockedDeleteShoppingListItem).toHaveBeenCalledWith(999);
      expect(mockedRecordAudit).not.toHaveBeenCalled();
    });

    it("returns 400 for a bad id", async () => {
      const res = await request(app)
        .delete("/shopping-list/abc")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(400);
      expect(mockedDeleteShoppingListItem).not.toHaveBeenCalled();
    });

    it("returns 401 with no token", async () => {
      const res = await request(app).delete("/shopping-list/1");

      expect(res.status).toBe(401);
      expect(mockedDeleteShoppingListItem).not.toHaveBeenCalled();
    });
  });
});
