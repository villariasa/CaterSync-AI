param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)

$backendDir = Join-Path $PSScriptRoot "..\..\catersync-backend"
$envFile = Join-Path $backendDir ".env"

if (-not (Test-Path $envFile)) {
    throw "Missing backend .env file at $envFile"
}

$envMap = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
        $envMap[$Matches[1].Trim()] = $Matches[2]
    }
}

$env:PGPASSWORD = $envMap["DB_PASSWORD"]
pg_restore -h $envMap["DB_HOST"] -p $envMap["DB_PORT"] -U $envMap["DB_USER"] -d $envMap["DB_NAME"] --clean --if-exists $BackupFile
Write-Host "Database restored from $BackupFile"
