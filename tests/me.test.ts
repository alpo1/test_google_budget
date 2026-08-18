import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/app";
import { env } from "../src/config/env";

describe("GET /auth/me", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 200 with id and role for a valid token", async () => {
    const token = jwt.sign({ sub: 42, role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });

    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 42, role: "admin" });
  });

  it("returns 401 for a malformed token", async () => {
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer not-a-real-token");

    expect(res.status).toBe(401);
  });
});
