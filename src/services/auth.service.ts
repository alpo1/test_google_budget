import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import { createUser, findUserByEmail, PublicUser } from "../repositories/user.repository";
import { RegisterInput, LoginInput } from "../validators/auth.validators";

const SALT_ROUNDS = 10;

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  return createUser(input.email, passwordHash);
}

export async function loginUser(input: LoginInput): Promise<{ token: string }> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordMatches) {
    throw new AppError(401, "Invalid email or password");
  }

  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, options);
  return { token };
}
