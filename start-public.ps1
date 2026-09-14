$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'backend\.env'
$toolsDir = Join-Path $root '.tools'
$cloudflaredPath = Join-Path $toolsDir 'cloudflared.exe'
$tunnelOut = Join-Path $toolsDir 'cloudflared.out.log'
$tunnelErr = Join-Path $toolsDir 'cloudflared.err.log'

if (-not (Test-Path $envPath)) {
    Write-Host 'backend\.env was not found.' -ForegroundColor Red
    Write-Host 'Create/configure backend\.env first, including database and Brevo settings.'
    exit 1
}

if (-not (Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Path $toolsDir | Out-Null
}

function Set-DotEnvValue {
    param(
        [string]$Path,
        [string]$Name,
        [string]$Value
    )

    $content = Get-Content -Path $Path -Raw
    $pattern = '(?m)^' + [regex]::Escape($Name) + '=.*$'
    $replacement = "$Name=$Value"

    if ($content -match $pattern) {
        $content = [regex]::Replace($content, $pattern, $replacement)
        Set-Content -Path $Path -Value $content -NoNewline
    } else {
        Add-Content -Path $Path -Value ("`r`n" + $replacement)
    }
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [int]$Attempts = 45
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            # Service is still starting.
        }
    }

    return $false
}

Write-Host ''
Write-Host 'TripMate Public Development Mode' -ForegroundColor Cyan
Write-Host 'This creates a temporary HTTPS address that works outside your Wi-Fi.'
Write-Host ''

if (-not (Test-Path $cloudflaredPath)) {
    Write-Host 'Downloading the Cloudflare Tunnel client...' -ForegroundColor Yellow
    $downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'

    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $cloudflaredPath -UseBasicParsing
    } catch {
        Write-Host 'Unable to download cloudflared.' -ForegroundColor Red
        Write-Host 'You can install it manually with:'
        Write-Host '  winget install --id Cloudflare.cloudflared --exact'
        exit 1
    }
}

Write-Host 'Starting Angular with the local API proxy...'
$webCommand = 'cd /d "' + (Join-Path $root 'web') + '" && npm run start:network'
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $webCommand

if (-not (Wait-ForUrl -Url 'http://127.0.0.1:4200')) {
    Write-Host 'Angular did not start on http://127.0.0.1:4200.' -ForegroundColor Red
    Write-Host 'Check the Angular terminal for the build error.'
    exit 1
}

Remove-Item $tunnelOut -Force -ErrorAction SilentlyContinue
Remove-Item $tunnelErr -Force -ErrorAction SilentlyContinue

Write-Host 'Creating a temporary public HTTPS tunnel...' -ForegroundColor Yellow

$tunnelArgs = @(
    'tunnel',
    '--url', 'http://127.0.0.1:4200',
    '--http-host-header', 'localhost:4200',
    '--no-autoupdate'
)

$tunnelProcess = Start-Process -FilePath $cloudflaredPath -ArgumentList $tunnelArgs -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr -PassThru -WindowStyle Hidden
$publicUrl = $null

for ($attempt = 1; $attempt -le 45; $attempt++) {
    Start-Sleep -Seconds 1
    $combinedLog = ''

    if (Test-Path $tunnelOut) {
        $combinedLog += Get-Content $tunnelOut -Raw -ErrorAction SilentlyContinue
    }
    if (Test-Path $tunnelErr) {
        $combinedLog += [Environment]::NewLine + (Get-Content $tunnelErr -Raw -ErrorAction SilentlyContinue)
    }

    $match = [regex]::Match($combinedLog, 'https://[a-z0-9-]+\.trycloudflare\.com', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
        $publicUrl = $match.Value.TrimEnd('/')
        break
    }

    if ($tunnelProcess.HasExited) {
        break
    }
}

if ([string]::IsNullOrWhiteSpace($publicUrl)) {
    Write-Host 'Cloudflare did not return a public URL.' -ForegroundColor Red
    if (Test-Path $tunnelErr) {
        Write-Host ''
        Write-Host 'Cloudflare output:' -ForegroundColor Yellow
        Get-Content $tunnelErr | Select-Object -Last 20
    }
    exit 1
}

Set-DotEnvValue -Path $envPath -Name 'APP_FRONTEND_URL' -Value $publicUrl
Set-DotEnvValue -Path $envPath -Name 'APP_CORS_ALLOWED_ORIGINS' -Value ($publicUrl + ',http://localhost:4200,http://127.0.0.1:4200')

Write-Host ''
Write-Host 'Public TripMate URL created:' -ForegroundColor Green
Write-Host $publicUrl -ForegroundColor Cyan
Write-Host ''
Write-Host 'Starting Spring Boot with the public invitation URL...'

$backendCommand = '"' + (Join-Path $root 'run-backend.bat') + '"'
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $backendCommand

Write-Host 'Waiting for the backend API...'
if (-not (Wait-ForUrl -Url 'http://127.0.0.1:8080/api/v1/health')) {
    Write-Host 'Backend did not become reachable on port 8080.' -ForegroundColor Red
    Write-Host 'Check the backend terminal for the error.'
    exit 1
}

Write-Host ''
Write-Host 'TripMate public development mode is ready.' -ForegroundColor Green
Write-Host ''
Write-Host 'Open TripMate here:' -ForegroundColor Cyan
Write-Host $publicUrl
Write-Host ''
Write-Host 'New invitation emails will use URLs like:'
Write-Host ($publicUrl + '/invite/<token>')
Write-Host ''
Write-Host 'Important:' -ForegroundColor Yellow
Write-Host '- Send a NEW invitation after this script is running.'
Write-Host '- Keep this window open. Closing it stops the temporary public URL.'
Write-Host '- The URL changes the next time you start public mode.'
Write-Host '- Quick Tunnels are for development/testing, not production.'
Write-Host ''
Write-Host 'Press Ctrl+C or close this window to stop the public tunnel.'

try {
    Wait-Process -Id $tunnelProcess.Id
} finally {
    if (-not $tunnelProcess.HasExited) {
        Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
