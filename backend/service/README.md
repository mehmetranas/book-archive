# book-archive-service

Standalone Node.js/TypeScript backend service that replaces the PocketBase JS
hooks in `backend/pb_hooks/`. PocketBase stays the system of record (DB, auth,
realtime) — this service is an authenticated client of it, using the
`pocketbase` npm SDK as a superuser.

See `/Users/mehmetsait/.claude/plans/quizzical-exploring-quail.md` (or the
project's plan history) for the full phased migration plan. This service
currently covers **Phase A**: `book-search`, `music-search`, `tmdb-proxy`.

## Env vars

Copy `.env.example` to `.env` and fill in real values for local development.
In production (Coolify), set these directly in the Application's environment
variables UI — never commit real secrets.

| Var | Purpose |
|---|---|
| `PB_URL` | PocketBase base URL (`https://book.api.cinevault.space`) |
| `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD` | Superuser (`_superusers` collection) credentials this service authenticates as |
| `PORT` | HTTP port (default 3000) |
| `GOOGLE_BOOKS_KEY` | Required — Google Books API key (unauthenticated calls hit a very low shared daily quota) |
| `TMDB_API_KEY` | TMDB proxy |
| `OPENROUTER_API_KEY` | Reserved for Phase B/C AI endpoints |
| `RC_WEBHOOK_SECRET` | Reserved for Phase D payment webhook |

## Local development

```bash
npm install
cp .env.example .env   # fill in real values
npm run dev
```

Get a real PocketBase **user** bearer token for manual testing (does not
touch the mobile app or its auth store):

```bash
npm run get-token -- user@example.com theirPassword
```

Then:

```bash
TOKEN=$(npm run --silent get-token -- user@example.com theirPassword)
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/book-search?q=dune"
```

## Build & run (matches the Docker image)

```bash
npm run build
npm start
```

## Deployment

Deployed as its own Coolify "Application" resource: GitHub source (this
repo), Dockerfile build pack, base directory `backend/service`, tracking the
`master` branch, domain `book.svc.cinevault.space`. Auto-deploys on push to
`master`.

## Design notes / constraints

- **Auth**: user bearer tokens are verified by asking PocketBase itself to
  refresh them (`users/auth-refresh`) — no JWT secret handling in this
  service. See `src/lib/auth.ts`.
- **Admin session**: `src/lib/pocketbase-admin-client.ts` authenticates once
  at boot and transparently re-authenticates on a 401 from any admin call
  (`withAdminAuth()`).
- **Single instance only** (once Phase B adds credit deduction): credit
  mutations will be serialized with an in-process async mutex
  (`src/lib/credits.ts`, added in Phase B). PocketBase's REST API has no
  compare-and-swap primitive, so this only provides atomicity as long as this
  service runs as a single container. Do not horizontally scale without
  replacing that mutex with a DB/Redis-based lock.
- **Background workers** (Phase C) run in the same process as the HTTP
  server, using a self-rescheduling poll loop (`src/workers/poll-loop.ts`) —
  never raw `setInterval` — so a slow batch can't overlap itself.
