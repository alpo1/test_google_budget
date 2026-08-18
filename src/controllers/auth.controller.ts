import { Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service";

export async function register(req: Request, res: Response): Promise<void> {
  const user = await registerUser(req.body);
  res.status(201).json(user);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { token } = await loginUser(req.body);
  res.status(200).json({ token });
}

export function me(req: Request, res: Response): void {
  res.status(200).json(req.user!);
}
