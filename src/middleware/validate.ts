import { Request, Response, NextFunction } from "express";
import { ZodTypeAny } from "zod";
import { AppError } from "../errors/app-error";

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(400, result.error.issues.map((issue) => issue.message).join(", ")));
      return;
    }
    req.body = result.data;
    next();
  };
}
