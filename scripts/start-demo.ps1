# Starts PostgreSQL, the C++ API and the web app, then seeds demonstration data.
# Run after scripts\bootstrap-windows.ps1 has completed once:  .\scripts\start-demo.ps1
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'env.ps1')
Set-Location $CredWiseRoot

# 1. Database
& pg_ctl.exe -D $CredWiseCluster status *> $null
if ($LASTEXITCODE -ne 0) {
    & pg_ctl.exe -D $CredWiseCluster -l (Join-Path $CredWiseState 'postgres.log') -o "-h 127.0.0.1 -p $($env:PGPORT)" -w start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not start. Run .\scripts\bootstrap-windows.ps1 first.' }
}

# 2. Builds (skipped when output exists; delete build\ or apps\web\.next to force a rebuild)
$api = Join-Path $CredWiseRoot 'build\services\core\credwise.exe'
if (-not (Test-Path $api)) {
    cmake -S . -B build -G Ninja; if ($LASTEXITCODE) { throw 'CMake configure failed.' }
    cmake --build build --parallel 3; if ($LASTEXITCODE) { throw 'C++ build failed.' }
}
if (-not (Test-Path 'apps\web\.next\BUILD_ID')) {
    if (-not (Test-Path 'node_modules')) { npm.cmd ci; if ($LASTEXITCODE) { throw 'npm ci failed.' } }
    npm.cmd run build; if ($LASTEXITCODE) { throw 'Web build failed.' }
}

# 3. Services (any earlier demo processes are replaced)
$logs = New-Item -ItemType Directory -Force (Join-Path $CredWiseRoot '.local\logs')
Get-Process credwise -ErrorAction SilentlyContinue | Stop-Process -Force
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'next.*start' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
$env:CORE_URL = 'http://127.0.0.1:8787'
$env:WEB_ORIGINS = 'http://127.0.0.1:3000,http://localhost:3000'
Start-Process -FilePath $api -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'api.log') -RedirectStandardError (Join-Path $logs 'api.err')
$next = Join-Path $CredWiseRoot 'node_modules\next\dist\bin\next'
Start-Process -FilePath node -WindowStyle Hidden -WorkingDirectory (Join-Path $CredWiseRoot 'apps\web') `
    -ArgumentList $next, 'start', '--hostname', '127.0.0.1', '--port', '3000' `
    -RedirectStandardOutput (Join-Path $logs 'web.log') -RedirectStandardError (Join-Path $logs 'web.err')

$ready = $false
for ($i = 0; $i -lt 60 -and -not $ready; $i++) {
    Start-Sleep -Milliseconds 500
    try { $ready = (Invoke-WebRequest 'http://127.0.0.1:3000/api/health' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { }
}
if (-not $ready) { throw 'The app did not become ready. Inspect .local\logs\api.err and web.err.' }

# 4. Demonstration data (safe to repeat)
$env:WEB_URL = 'http://127.0.0.1:3000'
node scripts\seed-demo.mjs
node scripts\seed-demo-extras.mjs
Write-Host ''
Write-Host 'CredWise 360 is running at http://127.0.0.1:3000'
Write-Host 'Borrower: borrower@credwise.test   Administrator: admin@credwise.test   Password: CredWiseDemo!360'
Write-Host 'Stop with: .\scripts\stop-demo.ps1'
