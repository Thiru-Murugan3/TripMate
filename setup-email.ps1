$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'backend\.env'

function Set-EnvValue {
    param(
        [string]$Path,
        [string]$Key,
        [string]$Value
    )

    $lines = @()
    if (Test-Path $Path) {
        $lines = Get-Content -Path $Path
    }

    $pattern = '^\s*' + [regex]::Escape($Key) + '='
    $found = $false
    $updated = foreach ($line in $lines) {
        if ($line -match $pattern) {
            $found = $true
            "$Key=$Value"
        } else {
            $line
        }
    }

    if (-not $found) {
        if ($updated.Count -gt 0 -and $updated[-1] -ne '') {
            $updated += ''
        }
        $updated += "$Key=$Value"
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($Path, $updated, $utf8NoBom)
}

Write-Host ''
Write-Host 'TripMate Gmail OTP Setup' -ForegroundColor Cyan
Write-Host '-------------------------' -ForegroundColor Cyan
Write-Host 'Use a Google App Password, NOT your normal Gmail password.' -ForegroundColor Yellow
Write-Host ''

$email = Read-Host 'Gmail / Google Workspace email address'
if ([string]::IsNullOrWhiteSpace($email) -or $email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
    Write-Host 'Invalid email address.' -ForegroundColor Red
    exit 1
}

$securePassword = Read-Host '16-character Google App Password' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $appPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$appPassword = ($appPassword -replace '\s', '')
if ($appPassword.Length -ne 16) {
    Write-Host 'Google App Password should contain 16 characters after spaces are removed.' -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Split-Path -Parent $envPath))) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $envPath) -Force | Out-Null
}

if (-not (Test-Path $envPath)) {
    @(
        '# TripMate local environment'
        '# This file is ignored by Git. Never commit real credentials.'
        ''
    ) | Set-Content -Path $envPath -Encoding UTF8
}

Set-EnvValue -Path $envPath -Key 'MAIL_HOST' -Value 'smtp.gmail.com'
Set-EnvValue -Path $envPath -Key 'MAIL_PORT' -Value '587'
Set-EnvValue -Path $envPath -Key 'MAIL_USERNAME' -Value $email.Trim()
Set-EnvValue -Path $envPath -Key 'MAIL_PASSWORD' -Value $appPassword
Set-EnvValue -Path $envPath -Key 'MAIL_FROM' -Value $email.Trim()

Write-Host ''
Write-Host 'Email settings saved to backend\.env' -ForegroundColor Green
Write-Host 'Your App Password was not printed to the terminal.' -ForegroundColor Green
Write-Host ''
Write-Host 'Next:' -ForegroundColor Cyan
Write-Host '  1. Run: run-backend.bat'
Write-Host '  2. Run the Angular app: cd web && npm start'
Write-Host '  3. Register at http://localhost:4200/register'
Write-Host ''
