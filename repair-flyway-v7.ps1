$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$javaFile = Join-Path $root 'backend\tools\FlywayV7Repair.java'
$m2Root = Join-Path $env:USERPROFILE '.m2\repository\com\mysql\mysql-connector-j'

if (-not (Test-Path $javaFile)) {
    Write-Host 'Flyway repair utility source was not found.' -ForegroundColor Red
    exit 1
}

$connectorJar = Get-ChildItem -Path $m2Root -Filter 'mysql-connector-j-*.jar' -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($null -eq $connectorJar) {
    Write-Host 'MySQL Connector/J was not found in the local Maven cache.' -ForegroundColor Yellow
    Write-Host 'Downloading backend dependencies first...'

    Push-Location (Join-Path $root 'backend')
    try {
        & mvn -q -DskipTests dependency:go-offline
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Unable to prepare MySQL Connector/J for the Flyway repair check.' -ForegroundColor Red
            exit 1
        }
    }
    finally {
        Pop-Location
    }

    $connectorJar = Get-ChildItem -Path $m2Root -Filter 'mysql-connector-j-*.jar' -Recurse -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}

if ($null -eq $connectorJar) {
    Write-Host 'MySQL Connector/J is still unavailable. Flyway repair cannot continue.' -ForegroundColor Red
    exit 1
}

Write-Host 'Checking Flyway V7 history and schema...'

& java --class-path $connectorJar.FullName $javaFile

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

exit 0
