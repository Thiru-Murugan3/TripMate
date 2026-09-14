$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'backend\.env'

if (-not (Test-Path $envPath)) {
    Write-Host 'backend\.env was not found.' -ForegroundColor Red
    Write-Host 'Create/configure backend\.env first, including your database and Brevo settings.'
    exit 1
}

$network = Get-NetIPConfiguration |
    Where-Object {
        $_.NetAdapter.Status -eq 'Up' -and
        $_.IPv4DefaultGateway -ne $null -and
        $_.IPv4Address -ne $null
    } |
    Select-Object -First 1

if ($null -eq $network) {
    Write-Host 'Could not detect an active LAN IPv4 address.' -ForegroundColor Red
    exit 1
}

$ip = $network.IPv4Address.IPAddress

if ([string]::IsNullOrWhiteSpace($ip) -or $ip.StartsWith('169.254.')) {
    Write-Host 'Could not detect a usable LAN IPv4 address.' -ForegroundColor Red
    exit 1
}

$frontendUrl = "http://$($ip):4200"
$corsOrigins = "http://localhost:4200,$frontendUrl"

function Set-DotEnvValue {
    param(
        [string]$Path,
        [string]$Name,
        [string]$Value
    )

    $content = Get-Content -Path $Path -Raw
    $pattern = "(?m)^" + [regex]::Escape($Name) + "=.*$"
    $replacement = "$Name=$Value"

    if ($content -match $pattern) {
        $content = [regex]::Replace($content, $pattern, $replacement)
        Set-Content -Path $Path -Value $content -NoNewline
    }
    else {
        Add-Content -Path $Path -Value "`r`n$replacement"
    }
}

Set-DotEnvValue -Path $envPath -Name 'APP_FRONTEND_URL' -Value $frontendUrl
Set-DotEnvValue -Path $envPath -Name 'APP_CORS_ALLOWED_ORIGINS' -Value $corsOrigins

Write-Host ''
Write-Host 'TripMate network mode configured.' -ForegroundColor Green
Write-Host "Frontend invitation URL: $frontendUrl"
Write-Host "Backend API: http://$($ip):8080/api/v1"
Write-Host ''
Write-Host 'Starting backend and Angular in separate windows...'

Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', "`"$root\run-backend.bat`""
Start-Sleep -Seconds 3
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', "cd /d `"$root\web`" && npm run start:network"

Write-Host ''
Write-Host 'When Angular is ready, open this URL on another device connected to the same Wi-Fi:' -ForegroundColor Cyan
Write-Host $frontendUrl
Write-Host ''
Write-Host 'Windows may ask for firewall permission for Node.js or Java. Allow Private networks.'
