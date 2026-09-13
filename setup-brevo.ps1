$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'backend\.env'

function Set-EnvValue {
    param([string]$Path,[string]$Key,[string]$Value)
    $lines = @()
    if (Test-Path $Path) { $lines = Get-Content -Path $Path }
    $pattern = '^\s*' + [regex]::Escape($Key) + '='
    $found = $false
    $updated = foreach ($line in $lines) {
        if ($line -match $pattern) { $found = $true; "$Key=$Value" } else { $line }
    }
    if (-not $found) {
        if ($updated.Count -gt 0 -and $updated[-1] -ne '') { $updated += '' }
        $updated += "$Key=$Value"
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($Path, $updated, $utf8NoBom)
}

Write-Host ''
Write-Host 'TripMate Brevo OTP Email Setup' -ForegroundColor Cyan
Write-Host '------------------------------' -ForegroundColor Cyan
Write-Host 'One-time backend setup. New TripMate users need no Gmail password or App Password.' -ForegroundColor Green
Write-Host ''

$secureApiKey = Read-Host 'Brevo API key' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureApiKey)
try { $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if ([string]::IsNullOrWhiteSpace($apiKey)) { Write-Host 'Brevo API key is required.' -ForegroundColor Red; exit 1 }

$senderEmail = Read-Host 'Verified Brevo sender email'
if ([string]::IsNullOrWhiteSpace($senderEmail) -or $senderEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
    Write-Host 'Invalid sender email address.' -ForegroundColor Red
    exit 1
}

$senderName = Read-Host 'Sender name (press Enter for TripMate)'
if ([string]::IsNullOrWhiteSpace($senderName)) { $senderName = 'TripMate' }

Write-Host 'Checking Brevo API key...' -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri 'https://api.brevo.com/v3/account' -Method Get -Headers @{ 'api-key' = $apiKey; 'accept' = 'application/json' } -TimeoutSec 15 | Out-Null
    Write-Host 'Brevo API key is valid.' -ForegroundColor Green
} catch {
    Write-Host 'Brevo API key validation failed.' -ForegroundColor Red
    Write-Host 'Check the key and internet connection, then run setup-brevo.bat again.' -ForegroundColor Yellow
    exit 1
}

Write-Host 'Checking sender registration in Brevo...' -ForegroundColor Cyan
try {
    $senderResponse = Invoke-RestMethod -Uri 'https://api.brevo.com/v3/senders' -Method Get -Headers @{ 'api-key' = $apiKey; 'accept' = 'application/json' } -TimeoutSec 15
    $matchingSender = @($senderResponse.senders) | Where-Object { $_.email -ieq $senderEmail.Trim() } | Select-Object -First 1

    if ($null -eq $matchingSender) {
        Write-Host "Sender '$($senderEmail.Trim())' was not found in your Brevo account." -ForegroundColor Red
        Write-Host 'Create and verify this sender in Brevo, then run setup-brevo.bat again.' -ForegroundColor Yellow
        exit 1
    }

    if ($null -ne $matchingSender.active -and -not [bool]$matchingSender.active) {
        Write-Host "Sender '$($senderEmail.Trim())' exists but is not active/verified." -ForegroundColor Red
        Write-Host 'Complete the sender verification in Brevo and run this setup again.' -ForegroundColor Yellow
        exit 1
    }

    Write-Host 'Brevo sender was found.' -ForegroundColor Green
} catch {
    Write-Host 'Unable to validate the sender using the Brevo API.' -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    }
    exit 1
}

if (-not (Test-Path (Split-Path -Parent $envPath))) { New-Item -ItemType Directory -Path (Split-Path -Parent $envPath) -Force | Out-Null }
if (-not (Test-Path $envPath)) { @('# TripMate local environment','# This file is ignored by Git. Never commit real credentials.','') | Set-Content -Path $envPath -Encoding UTF8 }

Set-EnvValue -Path $envPath -Key 'BREVO_API_URL' -Value 'https://api.brevo.com/v3/smtp/email'
Set-EnvValue -Path $envPath -Key 'BREVO_API_KEY' -Value $apiKey
Set-EnvValue -Path $envPath -Key 'BREVO_SENDER_EMAIL' -Value $senderEmail.Trim()
Set-EnvValue -Path $envPath -Key 'BREVO_SENDER_NAME' -Value $senderName.Trim()

Write-Host ''
Write-Host 'Brevo settings saved to backend\.env.' -ForegroundColor Green
Write-Host 'Run run-backend.bat to start TripMate.' -ForegroundColor Cyan
