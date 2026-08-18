import bcrypt from "bcrypt";
import request from "supertest";
import { app } from "../src/app";
import { findUserByEmail } from "../src/repositories/user.repository";

jest.mock("../src/repositories/user.repository", () => ({
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
}));

const mockedFindUserByEmail = jest.mocked(findUserByEmail);

const PASSWORD = "correct-horse-battery-staple";
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 10);
});

describe("POST /auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with a token for correct credentials", async () => {
    mockedFindUserByEmail.mockResolvedValue({
      id: 1,
      email: "user@example.com",
      password_hash: passwordHash,
      role: "buyer",
      created_at: new Date(),
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("returns 401 for the wrong password", async () => {
    mockedFindUserByEmail.mockResolvedValue({
      id: 1,
      email: "user@example.com",
      password_hash: passwordHash,
      role: "buyer",
      created_at: new Date(),
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown user", async () => {
    mockedFindUserByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: PASSWORD });

    expect(res.status).toBe(401);
  });
});
