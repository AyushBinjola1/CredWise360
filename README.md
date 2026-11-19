# CredWise 360

A local responsible-lending studio built around a native C++20 API and PostgreSQL. Demonstration records are synthetic. The product models loan decisions and payments for education.

## Windows setup

Use Node.js 24, npm, Git and PowerShell. Run from the repository root.

```powershell
.\scripts\bootstrap-windows.ps1
. .\scripts\env.ps1
cmake -S . -B build -G Ninja
cmake --build build --parallel 2
ctest --test-dir build --output-on-failure
npm.cmd ci
npm.cmd run build
.\build\services\core\credwise.exe
```

In a second terminal run `npm.cmd start`. Open http://127.0.0.1:3000. The local C++ API binds to 127.0.0.1:8787. The bootstrap keeps database credentials outside the checkout.

## Quick start for demonstration (Windows)

After the one-time `.\scripts\bootstrap-windows.ps1`, a single command starts PostgreSQL, the C++ API and the web app, applies migrations and seeds the demonstration portfolio:

```powershell
.\scripts\start-demo.ps1      # open http://127.0.0.1:3000
.\scripts\stop-demo.ps1       # stop the API and web server; data is kept
```

The first run compiles the C++ service and builds the web app, which takes a few minutes. Logs are in `.local\logs`.

## Demo accounts

All accounts use the password `CredWiseDemo!360`. On the sign-in page, the **Borrower** and **Administrator** buttons fill the first two.

| Role | Email | What it shows |
| --- | --- | --- |
| Borrower | `borrower@credwise.test` | Aarav Mehta: verified KYC, a funded ₹1,00,000 personal loan with two EMIs repaid, and an education loan application awaiting underwriting |
| Administrator | `admin@credwise.test` | Meera Rao: underwriting queue, loan portfolio, fraud review, reports, scoring policy and product configuration |
| Borrower | `diya.nair@credwise.test` | A rejected application with a recovery roadmap, plus a live emergency-loan application |
| Borrower | `rohan.iyer@credwise.test` | A thin credit file assessed from consented alternative evidence, with a microfinance application pending |

The seed (`node scripts/seed-demo.mjs`) drives the real REST workflows, so every demo record is a genuine ledger entry. It is idempotent and needs `DEMO_MODE=1`, which the local environment script sets. A suggested walkthrough is in [docs/demo-walkthrough.md](docs/demo-walkthrough.md).

## Docker Compose

Copy `.env.example` to `.env`, set a local PostgreSQL password, then run `docker compose up --build`. Open http://localhost:3000. Named volume `credwise-data` stores the data between runs.

## Verification

The full native phase gate is `node scripts/check-phase.mjs` after loading the local environment. It uses a separate PostgreSQL verification schema and dedicated ports. With both services running, run `npm run test:api` and `npm run test:browser`. Install the Playwright browser with `npx playwright install chromium` if needed. See the [roadmap](IMPLEMENTATION_PLAN.md), [evidence ledger](FEATURE_STATUS.md), [architecture](docs/architecture.md), [API contract](docs/openapi.json) and [acceptance matrix](docs/acceptance-matrix.md).
