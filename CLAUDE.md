# CLAUDE.md — Home Budget API

Context for AI-assisted work on this repo. Read this before writing or changing code.

> This project was pivoted from a procurement API to a household budget / receipt
> tracker. The **engineering skeleton is unchanged** (layered architecture, dual
> database, transactional writes, JWT auth). The **domain is new**: stores, receipts
> with line items, budget categories, a global barcode product catalog, and an
> in-app shopping list. Where old procurement rules and new domain rules conflict,
> the rules below win — do not "restore" supplier/order/buyer semantics.

## What this is

A REST API for tracking household spending. Node.js + TypeScript (`strict`),
Express, PostgreSQL (Neon) for the transactional core, MongoDB (Atlas) for an
append-only audit log. The two-database split is retained: relational data with
real foreign keys in Postgres, write-heavy schema-flexible history in Mongo.

## Domain model (source of truth: `src/db/schema.sql`)

- **users** — household members. `role`: `member` (default) | `admin`.
- **categories** — budget categories with an OPTIONAL `monthly_budget` cap. Actual
  spend is NEVER stored; it is derived by summing confirmed receipts per category
  per month.
- **stores** — where you shop (`chain` groups branches of one brand).
- **products** — global catalog keyed by a globally-UNIQUE `barcode`. **No price**
  here: price is store/time-dependent and lives on `receipt_items`. The catalog
  grows as items are scanned.
- **receipts** — one shopping trip (the analogue of the old `purchase_orders`).
- **receipt_items** — line items (analogue of `order_items`); `ON DELETE CASCADE`
  with the receipt. `product_id` links a line to the catalog when a barcode matched.
- **shopping_list_items** — in-app shopping list (Reminders has no web API); ticking
  an item sets `is_checked`.

Two load-bearing decisions — do not "fix" these:

- **`receipts.total` is the authoritative amount paid, taken from the receipt — it is
  NOT recomputed from line items.** Real receipts differ from the item sum due to
  discounts, promotions, rounding and deposits (פיקדון). `total` drives the budget.
- **`purchased_at` (date on the receipt) is distinct from `created_at` (when the row
  was inserted / photo scanned).** Budget month is decided by `purchased_at`.

## Commands

- `npm run dev` — start the API with ts-node-dev (watch mode)
- `npm run build` — compile TypeScript to `dist/` (must pass under `strict`)
- `npm run migrate` — apply `src/db/schema.sql` (create Postgres tables)
- `npm test` — Jest + Supertest suite
- `npm start` — run the compiled build from `dist/`

## Definition of done (check before declaring a task complete)

1. `npm run build` passes under `strict` (no `any`, no `as any`).
2. `npm test` passes, including negative paths (400/401/403/404/409 as applicable).
3. `npm run migrate` runs clean against a fresh database.
4. New resources mirror the existing layer pattern exactly (see below).

## Project layout

```
src/
  config/       env (zod-validated), postgres (pool), mongo (mongoose)
  db/           schema.sql, migrate.ts
  errors/       AppError
  utils/        asyncHandler
  middleware/   validate (validateBody), require-auth (requireAuth, requireRole)
  validators/   zod schemas per resource
  repositories/ SQL only — the ONLY layer that talks to Postgres
  services/     business logic
  controllers/  thin request/response orchestration
  routes/       route definitions + middleware wiring
  models/       Mongoose models (audit log)
  types/        express.d.ts (declaration merging for req.user)
  app.ts        Express app (no port) — imported by tests
  server.ts     connects DBs, then listens
```

## Architecture conventions (follow these; they are the de facto standard)

- **Layering:** routes → controller → service → repository. Keep each layer thin
  and single-purpose. New resources follow the existing pattern exactly.
- **Errors:** throw `AppError(statusCode, message)`. The central error handler in
  `app.ts` turns it into the HTTP response. Do not build ad-hoc error responses in
  controllers.
- **Async routes:** wrap async handlers in `asyncHandler(...)` so rejections reach
  the error handler (Express 4 does not forward them automatically).
- **Validation:** use zod schemas in `validators/` via the `validateBody(schema)`
  middleware. Controllers assume the body is already validated.
- **IDs from the URL:** validate with `parseId` (positive integer → number, else 400).
- **Never expose password_hash.** Strip it in SQL (`RETURNING id, email, role, ...`)
  and type public shapes as `Omit<UserRow, "password_hash">`.
- **req.user typing:** extended via declaration merging in `src/types/express.d.ts`.
  Never use `(req as any).user`.

## Database rules

- **Postgres = transactional core** (users, categories, stores, products, receipts,
  receipt_items, shopping_list_items). All queries **parameterized** (`$1, $2`) via
  the shared `pool`/`query`. Never string-concatenate user input into SQL.
- **Transactions** (create receipt + items): take a dedicated client with
  `pool.connect()`, run `BEGIN` → work → `COMMIT`, `ROLLBACK` in `catch`, and
  **always** `client.release()` in `finally`. Do NOT use the shared `query()` inside
  a transaction (it grabs an arbitrary pooled connection). The canonical
  implementation is `createReceiptWithItems` in
  `src/repositories/receipt.repository.ts`.
- **Money is `NUMERIC(12,2)`** and comes back from `pg` as a **string**. Keep it a
  string end-to-end; never round-trip through float. `receipt_items.quantity` is
  `NUMERIC(10,3)` (goods sold by weight) — also a string.
- **MongoDB = append-only audit log** (who/what/when). Writes are **fire-and-forget**:
  `recordAudit(...)` must catch its own errors and NEVER throw into the caller — a
  failed audit write must not break the main operation. Call it AFTER the Postgres
  operation succeeds, never inside a transaction.

## Security rules (do not regress these)

- **Never trust the client** for server-owned fields: take `created_by` /
  `added_by` from `req.user.id`, never from the request body.
- **`receipts.total` is validated, not invented by the client silently** — accept it
  as the paid amount, but never recompute it from items (see domain model). Reject
  negative totals.
- **Registration always creates role `member`.** Admin is granted out-of-band (SQL).
  Never let the API set an arbitrary role from user input.
- **Authorisation model:** any authenticated member can read, create receipts, and
  manage the shopping list. `requireRole("admin")` guards only **destructive/config**
  actions — deleting stores or categories, and changing user roles. (This is the
  key difference from the old procurement API, where all writes were admin-only.)
- **Login returns a generic 401** ("Invalid email or password") for both wrong
  password and unknown email — don't leak which emails exist.
- **JWT carries `{ sub, role }`**, signed with `JWT_SECRET`. Verify with `jwt.verify`
  (never `jwt.decode`). 401 = not authenticated; 403 = authenticated but wrong role.

## Auth / roles

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Roles: `member` (default) and `admin`.
- Role is baked into the JWT at login. Changing a user's role in the DB does NOT
  affect existing tokens — the user must log in again to get a token with the new role.

## Environment variables (see .env, which is gitignored)

`PORT`, `NODE_ENV`, `POSTGRES_URL`, `POSTGRES_SSL` (`true` for Neon/cloud, `false`
for local Docker), `MONGO_URL`, `JWT_SECRET` (min 8 chars), `JWT_EXPIRES_IN`. Env is
validated by zod in `src/config/env.ts` and the app fails fast if any are missing.

## Testing conventions

- Jest + Supertest. Tests import `app` from `src/app.ts` (no port opened).
- **Mock the repository layer** so tests don't hit real databases. Do NOT mock
  `bcrypt` — for login tests, seed the mocked user with a real bcrypt hash of a known
  password so `bcrypt.compare` runs for real.
- `jest.clearAllMocks()` in `beforeEach` to keep tests isolated.
- Cover negative paths, not just happy paths (409 duplicate, 400 validation, 401/403).
- Test files live outside `src/` so they don't compile into `dist/`.

## Dev-environment gotchas (learned the hard way)

- **Run exactly one server.** ts-node-dev spawns two processes per run (a watcher +
  a child) — that's normal for ONE server. Multiple stale servers cause `EADDRINUSE`
  and requests hitting outdated code. Clean up with `pkill -f ts-node-dev` and check
  with `lsof -i:3000`.
- **Verify you're testing the current build, not a stale process,** when behavior
  looks wrong but the code looks right.
- **After the pivot, the database schema is new.** Run `npm run migrate` on a fresh
  DB (or drop the old procurement tables); `IF NOT EXISTS` will not migrate old ones.

## Status

- Done: auth (register/login/JWT/roles), MongoDB audit log, Docker, CI.
- Done: schema pivoted to the home-budget domain (`src/db/schema.sql`).
- Done vertical slices (routes → controller → service → repository, with tests
  and negative-path coverage): **stores, categories, receipts, products, shopping_list**.
  - `receipts` includes the transactional `createReceiptWithItems`
    (dedicated client, BEGIN/COMMIT/ROLLBACK/release) with a rollback test.
  - `products` enforces the globally-unique `barcode` (nullable for loose/weighed
    items; duplicate → 409) and a `default_category_id` FK (bad ref → 400);
    DELETE is admin-only.
  - `shopping_list` provides shared household shopping list items with check/uncheck
    state, server-managed `checked_at`, and free-text quantities.
- Next feature: receipt OCR (image → draft receipt). Several decisions are
  still open and must be resolved before starting: photo storage location
  (object storage vs local disk), where the extracted-but-unlinked store name
  lives (a nullable column on `receipts` vs a Mongo sidecar), and whether
  draft→confirm review is a separate later slice.
- Planned after OCR: barcode scan + Open Food Facts lookup, budget rollups +
  Google Sheets export, shopping-list Shortcuts bridge.
