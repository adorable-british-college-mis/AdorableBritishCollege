# AGENTS.md — Adorable British College MIS

## Stack
- **Backend** (`backend/`): Express 5 + Prisma 6 + PostgreSQL, TypeScript, `tsx watch` dev server on port 4000. Entry: `src/server.ts` → `src/app.ts`.
- **Frontend** (`frontend/`): Vite 7 + React 19 + TanStack Query + React Router, dev server on port 5173. Proxies `/api` to the backend (target via `API_PROXY_TARGET` env, defaults to `http://localhost:4000`).
- **Database**: PostgreSQL. Prisma schema at `backend/prisma/schema.prisma`. Migrations in `backend/prisma/migrations/`. Seed at `backend/prisma/seed.ts`.

## Dev environment (Base44)
- Run: `docker compose -f docker-compose.base44.yml up -d`
- Preview: frontend on host port 3000 (mapped from 5173). Single-origin wiring — the Vite dev server proxies `/api` to the backend container, so cookie-based auth works same-origin.
- Backend binds port 4000 internally; not exposed to the host (only reached via the Vite proxy).
- `FRONTEND_URL` (CORS origin) is set to the public preview URL at runtime.

## Secrets
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (min 32 chars) are **required at boot** — dev placeholders are generated automatically; replace with real values for production.
- `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` are optional (live email/WhatsApp communications). The app boots fine without them; those delivery channels are simply disabled.

## First-boot sequence (backend container)
`npm install` → `prisma generate` → `prisma migrate deploy` → `db:seed` → `npm run dev` (tsx watch).

## Seeded login
After seeding, sign in with **admin@abc.test / ChangeMe123!** (SUPER_ADMIN role).

## Verifying it works
- `curl -s localhost:3000` → frontend HTML.
- `curl -s localhost:3000/api/v1/openapi.json` → OpenAPI document (proves proxy + backend).
- `curl -s localhost:3000/health` → 404 (health is at `/api/v1` prefix? No — `/health` is on backend only, not proxied). Use the frontend login page instead.
- Login at the preview UI with the seeded credentials.

## Tests
- Backend: `npm test` (vitest) — run inside the backend container.
- Frontend: `npm test` (vitest) — run inside the frontend container.
