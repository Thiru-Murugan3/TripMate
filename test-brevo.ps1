$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'backend\.env'

if (-not (Test-Path $envPath)) {
    Write-Host 'backend\.env not found. Run setup-brevo.bat first.' -ForegroundColor Red
    exit 1
}

$settings = @{}
Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
        $parts = $line.Split('=', 2)
        $settings[$parts[0].Trim()] = $parts[1].Trim()
    }
}

$apiKey = $settings['BREVO_API_KEY']
$senderEmail = $settings['BREVO_SENDER_EMAIL']
$senderName = $settings['BREVO_SENDER_NAME']
if ([string]::IsNullOrWhiteSpace($senderName)) { $senderName = 'TripMate' }

if ([string]::IsNullOrWhiteSpace($apiKey) -or [string]::IsNullOrWhiteSpace($senderEmail)) {
    Write-Host 'BREVO_API_KEY or BREVO_SENDER_EMAIL is missing. Run setup-brevo.bat first.' -ForegroundColor Red
    exit 1
}

$recipient = Read-Host 'Email address to receive a Brevo test message'
if ([string]::IsNullOrWhiteSpace($recipient) -or $recipient -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
    Write-Host 'Invalid recipient email.' -ForegroundColor Red
    exit 1
}

$body = @{
    sender = @{ name = $senderName; email = $senderEmail }
    to = @(@{ email = $recipient })
    subject = 'TripMate Brevo Test Email'
    textContent = 'Brevo is correctly configured for TripMate OTP delivery.'
} | ConvertTo-Json -Depth 5

Write-Host ''
Write-Host 'Sending test email through Brevo...' -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri 'https://api.brevo.com/v3/smtp/email' -Method Post -Headers @{ 'api-key' = $apiKey; 'accept' = 'application/json' } -ContentType 'application/json' -Body $body -TimeoutSec 20
    Write-Host 'SUCCESS: Brevo accepted the test email.' -ForegroundColor Green
    if ($response.messageId) { Write-Host "Message ID: $($response.messageId)" -ForegroundColor Green }
    Write-Host 'Check the recipient inbox and Spam/Junk folder.' -ForegroundColor Green
} catch {
    Write-Host 'FAILED: Brevo rejected the test email.' -ForegroundColor Red
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        Write-Host "HTTP status: $([int]$_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
    if ($_.ErrorDetails.Message) {
        Write-Host 'Brevo response:' -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    } else {
        Write-Host $_.Exception.Message -ForegroundColor Yellow
    }
    exit 1
}
