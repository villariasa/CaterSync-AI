param(
    [string]$OutputDir = "backups/database"
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

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $OutputDir "catersync_ai-$timestamp.dump"

$env:PGPASSWORD = $envMap["DB_PASSWORD"]
pg_dump -h $envMap["DB_HOST"] -p $envMap["DB_PORT"] -U $envMap["DB_USER"] -Fc -f $backupFile $envMap["DB_NAME"]
Write-Host "Database backup written to $backupFile"
