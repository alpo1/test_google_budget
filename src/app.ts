import express, { Request, Response, NextFunction } from "express";
import pinoHttp from "pino-http";
import { authRouter } from "./routes/auth.routes";
import { storesRouter } from "./routes/store.routes";
import { categoriesRouter } from "./routes/category.routes";
import { receiptsRouter } from "./routes/receipt.routes";
import { AppError } from "./errors/app-error";
import { productsRouter } from "./routes/product.routes";
import { shoppingListRouter } from "./routes/shopping-list.routes";

// The Express app is built here (routes + middleware) but NOT started.
// server.ts is responsible for connecting to the databases and listening.
// Keeping them separate lets tests import `app` without opening a port.
export const app = express();

app.use(express.json());
app.use(pinoHttp());

// Health check — lets Docker / monitoring confirm the service is alive.
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "Home Budget API",
    status: "ok",
    endpoints: [
      "/health",
      "/auth",
      "/stores",
      "/categories",
      "/receipts",
      "/products",
      "/shopping-list",
    ],
  });
});

// Feature routers will be mounted here as we build them:
app.use("/auth", authRouter);
app.use("/stores", storesRouter);
app.use("/categories", categoriesRouter);
app.use("/receipts", receiptsRouter);
app.use("/products", productsRouter);
app.use("/shopping-list", shoppingListRouter);

// 404 for anything unmatched.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Central error handler — one place that turns thrown errors into responses.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
