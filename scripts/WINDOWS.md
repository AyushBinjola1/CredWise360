# Native Windows setup

Use 64-bit Windows 11 with PowerShell, Python 3.11 or newer, and the Windows versions of curl and tar. The tar executable must support zstd archives. Open a normal user terminal in the repository root.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-windows.ps1
. .\scripts\env.ps1
cmake --version
g++ --version
psql -X -w -c 'SELECT current_database(), current_user'
```

The bootstrap downloads the pinned MSYS2 UCRT64 compiler, CMake, Ninja, OpenSSL, PostgreSQL server and client libraries. It verifies each archive against the SHA-256 in `scripts/windows-packages.lock.json`. The extracted tools live in `.local/ucrt64`. Tool installation is local to the checkout. The bootstrap can run again to restart an existing cluster. [MSYS2 environments](https://www.msys2.org/docs/environments/) · [PostgreSQL package](https://packages.msys2.org/packages/mingw-w64-ucrt-x86_64-postgresql)

PostgreSQL listens on `127.0.0.1:55432` and requires SCRAM authentication. To select a different port, set `$env:CREDWISE_PG_PORT` before running either script. The application connects as the ordinary database owner `credwise`. The separate `credwise_admin` role is for bootstrap operations. Generated passwords and database files are stored in a private per-checkout directory below `%LOCALAPPDATA%\CredWise360\instances`, outside OneDrive. The environment script sets `DATABASE_URL` and `PGPASSFILE` for libpq.

Run the following in an initialized shell to stop the local server cleanly.

```powershell
pg_ctl -D $CredWiseCluster -m fast -w stop
```

The local setup preserves database contents across application restarts. Back up the local database with `pg_dump -Fc -f credwise.dump` before resetting the machine or moving the checkout. Keep that file private because it contains database records.
