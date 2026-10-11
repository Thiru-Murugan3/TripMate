param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Secret = "suttru_inbound_sec_8a3f91e4b27c",
    [string]$Recipient = "import+testtoken123@inbound.suttru.in",
    [string]$SenderEmail = "traveler@example.com"
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " TripMate Brevo Inbound Email Webhook Tester " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Target Base URL: $BaseUrl"
Write-Host "Webhook Secret:  $Secret"
Write-Host "Recipient Token: $Recipient"
Write-Host ""

$webhookUrl = "$BaseUrl/api/v1/webhooks/brevo/inbound/$Secret"

$flightPayload = @{
    items = @(
        @{
            MessageId = "<indigo-test-$(Get-Random)@tripmate.app>"
            Uuid = "brevo-uuid-$(Get-Random)"
            From = @{
                Address = $SenderEmail
                Name = "TripMate Traveler"
            }
            To = @(
                @{
                    Address = $Recipient
                    Name = "TripMate Forwarder"
                }
            )
            Subject = "Fwd: IndiGo Flight Booking Confirmation (PNR: 6E-IND991)"
            RawTextBody = @"
IndiGo Flight
PNR: 6E-IND991
From: Chennai
To: Goa
Boarding Date and Time: 15-Nov-2026 06:45
Total Fare: Rs. 4,250.00
Passenger Details
Mr. Rahul Sharma
"@
        }
    )
} | ConvertTo-Json -Depth 6

Write-Host "Posting simulated reservation email to: $webhookUrl" -ForegroundColor Yellow
try {
    $resp = Invoke-RestMethod -Uri $webhookUrl -Method Post -ContentType "application/json" -Body $flightPayload -TimeoutSec 15
    Write-Host "Response received:" -ForegroundColor Green
    $resp | Format-List
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    }
}
