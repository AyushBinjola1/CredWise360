[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'env.ps1')

function Confirm-Exit([string] $Operation) {
    if ($LASTEXITCODE -ne 0) { throw "$Operation failed (exit code $LASTEXITCODE)." }
}
function New-DatabasePassword {
    $bytes = New-Object 'byte[]' 36
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes)
}

$portNumber = 0
if (-not [int]::TryParse($env:PGPORT, [ref]$portNumber) -or $portNumber -lt 1 -or $portNumber -gt 65535) {
    throw 'CREDWISE_PG_PORT must be a TCP port between 1 and 65535.'
}
& python (Join-Path $PSScriptRoot 'fetch-windows-tools.py')
Confirm-Exit 'Tool installation'

$null = New-Item -ItemType Directory -Force $CredWiseState
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
& icacls.exe $CredWiseState /inheritance:r /grant:r ("*" + $identity.Value + ":(OI)(CI)F") | Out-Null
Confirm-Exit 'Database directory permissions'

if (-not (Test-Path -LiteralPath $env:PGPASSFILE)) {
    if (Test-Path -LiteralPath (Join-Path $CredWiseCluster 'PG_VERSION')) {
        throw 'The local database exists but its password file is missing. Restore pgpass.conf for this instance.'
    }
    $adminPassword = New-DatabasePassword
    $appPassword = New-DatabasePassword
    [IO.File]::WriteAllLines($env:PGPASSFILE, @(
        "127.0.0.1:*:*:credwise_admin:$adminPassword",
        "127.0.0.1:*:*:credwise:$appPassword"
    ), [Text.Encoding]::ASCII)
} else {
    $passwords = Get-Content -LiteralPath $env:PGPASSFILE
    $adminPassword = (($passwords | Where-Object { $_ -like '*:credwise_admin:*' }) -split ':')[-1]
    $appPassword = (($passwords | Where-Object { $_ -like '*:credwise:*' }) -split ':')[-1]
}

if (-not (Test-Path -LiteralPath (Join-Path $CredWiseCluster 'PG_VERSION'))) {
    $passwordFile = Join-Path $CredWiseState ('init-' + [guid]::NewGuid() + '.tmp')
    try {
        [IO.File]::WriteAllText($passwordFile, "$adminPassword`n", [Text.Encoding]::ASCII)
        & initdb.exe --pgdata=$CredWiseCluster --username=credwise_admin --pwfile=$passwordFile --auth=scram-sha-256 --encoding=UTF8 --locale=C
        Confirm-Exit 'PostgreSQL initialization'
    } finally {
        if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile }
    }
}
& pg_ctl.exe -D $CredWiseCluster status *> $null
if ($LASTEXITCODE -ne 0) {
    $logFile = Join-Path $CredWiseState 'postgres.log'
    & pg_ctl.exe -D $CredWiseCluster -l $logFile -o "-h 127.0.0.1 -p $portNumber" -w start
    Confirm-Exit 'PostgreSQL startup'
}

$adminOptions = @('-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'credwise_admin', '-d', 'postgres')
$hasRole = & psql.exe @adminOptions -c "SELECT count(*) FROM pg_roles WHERE rolname='credwise'"
Confirm-Exit 'Database role lookup'
if ($hasRole -eq '0') {
    "CREATE ROLE credwise LOGIN PASSWORD '$appPassword';" | & psql.exe @adminOptions
    Confirm-Exit 'Database role creation'
}
$hasDatabase = & psql.exe @adminOptions -c "SELECT count(*) FROM pg_database WHERE datname='credwise'"
Confirm-Exit 'Database lookup'
if ($hasDatabase -eq '0') {
    & createdb.exe -w --username=credwise_admin --owner=credwise credwise
    Confirm-Exit 'Database creation'
}
& psql.exe -X -w -At -v ON_ERROR_STOP=1 -c "SELECT current_user || ' connected to ' || current_database() || ' on PostgreSQL ' || current_setting('server_version');"
Confirm-Exit 'Application database connection'
Write-Host 'Run . .\scripts\env.ps1 in each new PowerShell session.'
