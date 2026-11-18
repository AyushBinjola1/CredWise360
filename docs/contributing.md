# Development checkpoints

Use a PostgreSQL database for the local demo. From a Windows checkout, dot-source `scripts/env.ps1` and run `node scripts/check-phase.mjs`. The runner compiles the web and native applications, runs CTest, applies migrations twice, starts both processes on dedicated test ports, and exercises the real HTTP and browser interfaces. It closes its own child processes on exit. Set `CHECK_WEB_PORT` or `CHECK_CORE_PORT` to choose another port. Logs live in `.local/logs`.

Update the ledger with observed results before each local Git checkpoint. Use synthetic test identities and a separate evaluation database for disposable tests.
