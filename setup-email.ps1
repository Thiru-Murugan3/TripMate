Write-Host 'Suttru no longer uses Gmail App Passwords.' -ForegroundColor Yellow
& "$PSScriptRoot\setup-brevo.ps1"
exit $LASTEXITCODE
