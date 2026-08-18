import { AppError } from "../errors/app-error";

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "Invalid id");
  }
  return id;
}
