## Quick context for AI coding agents

This backend is a NestJS monolith (TypeScript) that serves a SPA backend API. Use these pointers to be productive quickly.

### Big picture
- Framework: NestJS (see `src/main.ts`, `src/app.module.ts`). App modules are imported in `AppModule` and represent feature/service boundaries (e.g. `modules/users`, `modules/warehouses`, `modules/transactions`).
- HTTP platform: can run on Express or Fastify controlled by env `USE_FASTIFY` (see `src/main.ts` — branch toggles setup/limits for multipart/static assets).
- ORM: TypeORM v0.3.x with a `DataSource` defined in `src/data-source.ts`. Migrations are run with the `typeorm-ts-node-commonjs` helper (see `package.json` scripts).
- Caching: Redis-first cache is configured under `src/config/cache.config.ts`. Cache keys, TTLs and builder helpers live there (e.g. `CACHE_KEYS`, `CACHE_PATTERNS`, `buildWarehouseRequirementsListingKey`). Note: cache keys deliberately omit user-specific ids to maximize cache hit ratio.

### Important structural decisions (why)
- Security & sanitization are enforced globally: `SanitizationPipe` + `ValidationPipe` + `AllExceptionsFilter` are applied (see `src/main.ts` and `src/app.module.ts`). Changes should respect these global guards/pipes.
- Throttling & tracking: a `ThrottleTrackingMiddleware` runs on all routes and `ThrottlerGuard` is registered globally unless `SKIP_THROTTLING=true` (see `AppModule` providers). Avoid bypassing these guards without a clear reason.
- SSE endpoints use a special middleware and no request timeout (`sse/*` routes). Use `SSEJwtMiddleware` and don't apply global timeouts to SSE handlers (see `src/main.ts` and `src/app.module.ts`).
- File upload adapters are abstracted (`src/adapters/express-file-upload.adapter.ts` and `fastify-file-upload.adapter.ts`). Use adapter pattern when touching upload logic.

### Developer workflows & commands
- Build: `npm run build` (uses `nest build`).
- Dev run (watch): `npm run start:dev`.
- Prod run (after build): `npm run start:prod`.
- Tests: `npm test`, `npm run test:watch`, `npm run test:e2e`.
- Migrations (TypeORM):
  - Generate: `npm run migration:generate -- MigrationName` (script uses `-d src/data-source.ts`).
  - Run: `npm run migration:run`.
  - Revert: `npm run migration:revert`.
  - The CLI relies on `src/data-source.ts` which loads `../.env` by default, so ensure env is set before running migration scripts.

### Key environment variables to watch for (used widely)
- Platform / server: `USE_FASTIFY`, `USE_HELMET` (disable Helmet), `PORT`, `NODE_ENV`.
- DB / migrations: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` (read by `src/data-source.ts` and `src/database/database.module.ts`).
- Redis / cache: `USE_REDIS`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`.
- Auth / sessions: `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`.
- Other: `CORS_ORIGIN`, `UPLOAD_REQ_DIR`, `SKIP_THROTTLING`.

### Patterns & conventions to follow
- Validation: controllers expect DTOs with class-validator and `ValidationPipe` (whitelist + forbidNonWhitelisted are enabled). When adding DTOs, use `@nestjs/mapped-types` if extending existing DTOs.
- Errors: `AllExceptionsFilter` centralizes HTTP error shapes. Tests and new controllers should conform to the filter's expected error payload.
- Caching: use existing `CACHE_KEYS`, `CACHE_PATTERNS`, and cache key builders in `src/config/cache.config.ts` rather than inventing new key formats.
- Logging: use the `logger` from `src/config/logger.ts` (winston configured) — avoid console.log in production code.
- Guards & middleware: prefer adding behavior through guards, interceptors, or middleware (files under `src/guards`, `src/interceptors`, `src/middleware`) rather than ad-hoc route logic.

### Integration points & cross-component notes
- Redis: initialized in `AppModule.onModuleInit()` via `initializeRedisClient()` (can be disabled via `USE_REDIS=false`). Ensure Redis client usage checks for null (see `getRedisClient`).
- Migrations: `src/data-source.ts` prints DB config on startup — useful for debugging when migrations fail due to env issues.
- Uploads & static files: served from `uploads/` via `app.useStaticAssets` (Express) or Fastify static. Path is configurable via `UPLOAD_REQ_DIR`.

### Concrete examples (copy/paste friendly)
- Run dev with Fastify in PowerShell (Windows):

```powershell
$env:USE_FASTIFY = "true"; npm run start:dev
```

- Generate a migration named `AddFooTable`:

```powershell
npm run migration:generate -- AddFooTable
```

### Where to look for more context
- Entry & wiring: `src/main.ts`, `src/app.module.ts`.
- DB & migrations: `src/data-source.ts`, `src/database/database.config.ts`, `src/database/database.module.ts`.
- Cache patterns & builders: `src/config/cache.config.ts`.
- Security & global middleware: `src/common/*`, `src/middleware/*`, `src/guards/*`.
- Upload adapters: `src/adapters/`.

If any section is unclear or you want more examples (e.g., common DTOs, a sample migration, or cache decorator usage), tell me which area to expand and I'll iterate.
