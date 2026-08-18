import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";

const BEARER_PREFIX = "Bearer ";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw new AppError(401, "Unauthorized");
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    throw new AppError(401, "Unauthorized");
  }

  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError(401, "Unauthorized");
  }

  if (typeof payload === "string" || payload.sub === undefined || payload.role === undefined) {
    throw new AppError(401, "Unauthorized");
  }

  const id = Number(payload.sub);
  if (Number.isNaN(id)) {
    throw new AppError(401, "Unauthorized");
  }

  req.user = { id, role: String(payload.role) };
  next();
}

export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, "Forbidden");
    }
    next();
  };
}
