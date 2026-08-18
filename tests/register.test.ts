import request from "supertest";
import { app } from "../src/app";
import { AppError } from "../src/errors/app-error";
import { createUser } from "../src/repositories/user.repository";

jest.mock("../src/repositories/user.repository", () => ({
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
}));

const mockedCreateUser = jest.mocked(createUser);

describe("POST /auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 201 with the created user and no password_hash", async () => {
    mockedCreateUser.mockResolvedValue({
      id: 1,
      email: "new@example.com",
      role: "buyer",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await request(app)
      .post("/auth/register")
      .send({ email: "new@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, email: "new@example.com", role: "buyer" });
    expect(res.body.password_hash).toBeUndefined();
  });

  it("returns 409 when the repository reports a duplicate email", async () => {
    mockedCreateUser.mockRejectedValue(new AppError(409, "Email already registered"));

    const res = await request(app)
      .post("/auth/register")
      .send({ email: "dupe@example.com", password: "password123" });

    expect(res.status).toBe(409);
  });

  it("returns 400 for a short password", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "new@example.com", password: "short" });

    expect(res.status).toBe(400);
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: "password123" });

    expect(res.status).toBe(400);
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });
});
