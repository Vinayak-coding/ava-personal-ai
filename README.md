# AVA — Personal AI Command Center

AVA is a full-stack personal AI workspace built with React, Vite, Express, tRPC, Drizzle ORM, MySQL/TiDB, Manus OAuth, and the Manus built-in LLM gateway. It includes persistent conversations, natural-language task creation, task tracking, and a Google Calendar-aware daily briefing pipeline.

## Complete source export

This repository contains the complete application source and configuration: frontend code under `client/`, backend code under `server/`, shared types under `shared/`, database schema and migrations under `drizzle/`, tests, lockfile, Vite configuration, and the Vercel serverless entry point at `api/index.ts`. No secret values or populated `.env` files are committed.

## Deploy on Vercel

1. Import `https://github.com/Vinayak-coding/ava-personal-ai` into Vercel.
2. Use the repository root as the project root. The included `vercel.json` runs `pnpm build`, publishes `dist/public`, and exposes `api/index.ts` as the serverless API entry point.
3. Add every required variable from the table below in Vercel Project Settings → Environment Variables. Never commit populated environment files.
4. Point `DATABASE_URL` at the target MySQL/TiDB database and run the migrations from a trusted local environment:

   ```bash
   pnpm install
   DATABASE_URL="mysql://..." pnpm drizzle-kit migrate
   ```

5. Redeploy after environment variables and migrations are ready.
6. Verify sign-in, chat, task creation, task status updates, and the daily briefing endpoint.

## Environment variables

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Server and migration CLI | MySQL/TiDB connection string for users, conversations, messages, tasks, and briefings |
| `JWT_SECRET` | Yes | Server only | Long random secret used to sign session cookies |
| `VITE_APP_ID` | Yes | Server and browser | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Yes | Server only | Manus OAuth API base URL, normally `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | Yes | Browser | Manus login portal URL |
| `OWNER_OPEN_ID` | Yes | Server only | Owner open ID used for admin/owner synchronization |
| `OWNER_NAME` | Yes | Server only | Owner display name |
| `BUILT_IN_FORGE_API_URL` | Yes | Server only | Manus built-in API gateway URL for LLM, storage, notifications, and heartbeat services |
| `BUILT_IN_FORGE_API_KEY` | Yes | Server only | Server-side bearer token for the built-in API gateway |
| `VITE_FRONTEND_FORGE_API_URL` | Only if map features are used | Browser | Browser map proxy URL |
| `VITE_FRONTEND_FORGE_API_KEY` | Only if map features are used | Browser | Browser-safe map proxy key |
| `VITE_ANALYTICS_ENDPOINT` | No | Browser | Optional Umami analytics endpoint referenced by `client/index.html` |
| `VITE_ANALYTICS_WEBSITE_ID` | No | Browser | Optional Umami website ID |

Variables beginning with `VITE_` are bundled into browser assets. Do not put `JWT_SECRET`, `DATABASE_URL`, or `BUILT_IN_FORGE_API_KEY` in a `VITE_` variable.

## OAuth callback settings

Register this exact callback URL in the Manus OAuth application configuration, replacing the domain with the Vercel production domain:

```text
https://YOUR-VERCEL-DOMAIN.vercel.app/api/oauth/callback
```

If you attach a custom domain, register that exact custom-domain callback too if the OAuth application supports multiple redirect URLs. The login portal should remain the value of `VITE_OAUTH_PORTAL_URL`, while `OAUTH_SERVER_URL` remains the server-side OAuth API base URL.

## Local development and validation

```bash
pnpm install
# Export the variables above in your shell or use a local, uncommitted .env file.
pnpm drizzle-kit migrate
pnpm dev
```

Run the complete local validation suite:

```bash
pnpm test
pnpm check
pnpm build
```

The Vitest suite covers AVA task tool behavior, chat persistence flow, authentication logout behavior, and calendar-aware daily briefing generation. Full live chat/database/briefing requests require valid local credentials and a reachable MySQL/TiDB database; tests mock the external LLM gateway so they are deterministic and do not expose secrets.

## Daily briefing scheduling

The callback is implemented at `/api/scheduled/daily-briefing`. It authenticates scheduled requests, resolves the briefing owner by the platform task UID, reads pending AVA tasks, receives calendar events from the authorized calendar connector, generates a concise briefing through the fast LLM path, and stores one idempotent briefing per user/date.

The existing Manus scheduled job is not automatically transferred to Vercel. If deploying this export to Vercel, update the scheduled job callback base URL to the Vercel production domain and retain its authenticated scheduled-request flow, or create an equivalent Vercel Cron integration that supplies the required authentication. A Vercel deployment alone does not recreate the external Manus schedule.

## License

No license has been added to this export. Add the license that matches your intended distribution before publishing it publicly.
