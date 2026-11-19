# Deploying to Render with Neon PostgreSQL

CredWise 360 runs on Render as **one Docker web service** that contains both the C++ API and the Next.js server. Only the Next.js server is public. It listens on Render's `PORT` and forwards `/api` requests to the C++ API on `127.0.0.1` inside the same container. PostgreSQL is hosted externally on Neon.

## 1. Create the Neon database

1. Create a Neon project and a database (the default `neondb` is fine).
2. Open **Connect** and choose the **direct** connection (host without `-pooler`). The API uses transactions, advisory locks and session settings, which are not reliable through a transaction-mode connection pooler.
3. Copy the connection string. It looks like `postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require`.

Neon compute endpoints suspend when idle. The API retries the first connection for about 30 seconds, so a cold start does not crash the service.

## 2. Create the Render service

Either use the blueprint (**New > Blueprint**, pick this repository, which reads [`render.yaml`](../render.yaml)) or create a **Web Service** manually with exactly these settings:

| Setting | Value |
| --- | --- |
| Runtime | Docker |
| Repository branch | `main` |
| Dockerfile path | `./deploy/render/Dockerfile` |
| Docker build context directory | `.` (the repository root) |
| Health check path | `/api/health` |
| Port | Render sets `PORT` automatically (the image defaults to 10000). Do not set it yourself. |
| Instance count | 1 |

`/api/health` is answered by the C++ API through the web server, and it queries PostgreSQL. A 200 response therefore means the web tier, the API and the database all work. It also reports how many migrations have been applied.

## 3. Environment variables

| Variable | Value | Required | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Neon direct connection string with `?sslmode=require` | Yes (secret) | Database location and credentials |
| `DATABASE_SSLMODE` | `require` (or `verify-full` for certificate verification) | Recommended | Enforces TLS when the URL does not already say so. A mode written in the URL always wins. |
| `DEMO_MODE` | `1` for the demo, `0` otherwise | Yes | Creates the demo administrator and borrower on startup |
| `SEED_DEMO` | `1` | Optional | Loads the demo portfolio after startup through the real API. Safe to repeat. Requires `DEMO_MODE=1`. |
| `COOKIE_SECURE` | `1` | Yes | Marks the session cookie `Secure` |
| `TRUST_PROXY` | `1` | Yes | Uses the visitor address passed by the web tier so login limits apply per visitor |
| `WEB_ORIGINS` | Public https origin, for example `https://credwise-360.onrender.com` | Only for a custom domain | The API accepts writes only from these origins. On Render it is derived from `RENDER_EXTERNAL_URL` when unset. Separate several origins with commas. |
| `DATABASE_CONNECT_TIMEOUT` | Seconds, default `15` | No | Connection timeout |

`PORT`, `RENDER_EXTERNAL_URL`, `CORE_HOST`, `CORE_PORT` and `CORE_URL` are handled by the platform or the entrypoint. Do not set them.

## What happens at startup

[`deploy/render/entrypoint.sh`](../deploy/render/entrypoint.sh) starts the API, waits for it to answer, then starts Next.js on `0.0.0.0:$PORT`. On startup the API:

1. validates `DATABASE_URL` and the SSL settings;
2. applies every pending SQL migration in a transaction guarded by an advisory lock (already-applied files are skipped);
3. creates the demo accounts when `DEMO_MODE=1`.

When `SEED_DEMO=1` the entrypoint then runs the demo seed scripts against the running service. If either process exits, the container exits so Render restarts it.

## Local compatibility

Nothing changes for local use. With `DATABASE_SSLMODE` unset the URL is passed to libpq unchanged apart from a 15 second connect timeout, and `TRUST_PROXY` is off. The Windows launcher and `compose.yaml` keep working as before. `compose.yaml` and the two Dockerfiles in `services/core` and `apps/web` are for local Docker use and are not used by Render.

## Operating notes

- **Demo accounts are public.** With `DEMO_MODE=1` anyone who knows the documented password can sign in. For anything beyond a demonstration set `DEMO_MODE=0` and `SEED_DEMO=0` (existing demo rows stay in the database).
- **Free plan.** A free Render service sleeps when idle, so the first request after a pause is slow. The Docker build compiles the C++ service with a single job to keep memory low. If a build is killed for memory, use a paid instance type for the build.
- **Each request opens its own TLS connection** to Neon. This is correct but adds latency compared with a local database.
- **Verification status.** The entrypoint, SSL handling, migrations, seeding and origin checks were exercised locally against an SSL-only PostgreSQL. The Docker image itself and the Render and Neon services were not built or run in the development environment.
