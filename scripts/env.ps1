# Dot-source this script in a PowerShell window before building or running CredWise.
$CredWiseRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$CredWisePrefix = Join-Path $CredWiseRoot '.local\ucrt64'
$CredWiseBin = Join-Path $CredWisePrefix 'bin'
if (($env:PATH -split ';') -notcontains $CredWiseBin) {
    $env:PATH = "$CredWiseBin;$env:PATH"
}
$env:CC = Join-Path $CredWiseBin 'gcc.exe'
$env:CXX = Join-Path $CredWiseBin 'g++.exe'
$env:CMAKE_PREFIX_PATH = $CredWisePrefix
$env:OPENSSL_ROOT_DIR = $CredWisePrefix

# Keep cluster data and local passwords outside a cloud-synchronized checkout.
$CredWiseHasher = [Security.Cryptography.SHA256]::Create()
try {
    $CredWiseDigest = $CredWiseHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($CredWiseRoot.ToLowerInvariant()))
} finally {
    $CredWiseHasher.Dispose()
}
$CredWiseKey = ([BitConverter]::ToString($CredWiseDigest) -replace '-', '').Substring(0, 16)
$CredWiseState = Join-Path $env:LOCALAPPDATA "CredWise360\instances\$CredWiseKey"
$CredWiseCluster = Join-Path $CredWiseState 'pgdata'
$env:PGPASSFILE = Join-Path $CredWiseState 'pgpass.conf'
$env:PGHOST = '127.0.0.1'
if (-not $env:CREDWISE_PG_PORT) { $env:CREDWISE_PG_PORT = '55432' }
$env:PGPORT = $env:CREDWISE_PG_PORT
$env:PGDATABASE = 'credwise'
$env:PGUSER = 'credwise'
$env:DEMO_MODE = '1'
$env:DATABASE_URL = "postgresql://credwise@127.0.0.1:$($env:PGPORT)/credwise"
