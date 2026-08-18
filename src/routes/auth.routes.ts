import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/require-auth";
import { registerSchema, loginSchema } from "../validators/auth.validators";
import { register, login, me } from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), asyncHandler(register));
authRouter.post("/login", validateBody(loginSchema), asyncHandler(login));
authRouter.get("/me", requireAuth, me);
