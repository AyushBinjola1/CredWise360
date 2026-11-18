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

## Docker Compose

Copy `.env.example` to `.env`, set a local PostgreSQL password, then run `docker compose up --build`. Open http://localhost:3000. Named volume `credwise-data` stores the data between runs.

## Verification

With both services running, run `npm run test:api` and `npm run test:browser`. Install the Playwright browser with `npx playwright install chromium` if needed. See the [roadmap](IMPLEMENTATION_PLAN.md), [evidence ledger](FEATURE_STATUS.md), [architecture](docs/architecture.md), [API contract](docs/openapi.json) and [acceptance matrix](docs/acceptance-matrix.md).
