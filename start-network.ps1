param(
    [Parameter(Position = 0)]
    [string]$IpAddress
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root 'backend\.env'

if (-not (Test-Path $envPath)) {
    Write-Host 'backend\.env was not found.' -ForegroundColor Red
    Write-Host 'Create/configure backend\.env first, including your database and Brevo settings.'
    exit 1
}

function Test-UsableIpv4 {
    param([string]$Address)

    if ([string]::IsNullOrWhiteSpace($Address)) {
        return $false
    }

    if ($Address.StartsWith('169.254.') -or $Address.StartsWith('127.')) {
        return $false
    }

    $parsed = $null
    return [System.Net.IPAddress]::TryParse($Address, [ref]$parsed) -and
        $parsed.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork
}

function Get-PrivateRangeScore {
    param([string]$Address)

    if ($Address -match '^192\.168\.') {
        return 30
    }

    if ($Address -match '^172\.(1[6-9]|2[0-9]|3[0-1])\.') {
        return 20
    }

    if ($Address -match '^10\.') {
        return 10
    }

    return 0
}

function Get-TripMateLanCandidates {
    $blockedPattern = '(?i)(vpn|virtual|vethernet|hyper-v|wsl|docker|vmware|virtualbox|tailscale|zerotier|wireguard|openvpn|anyconnect|fortinet|globalprotect|tunnel|loopback|tap|tun)'

    $items = foreach ($config in Get-NetIPConfiguration) {
        if ($config.NetAdapter.Status -ne 'Up' -or
            $null -eq $config.IPv4DefaultGateway -or
            $null -eq $config.IPv4Address) {
            continue
        }

        $alias = [string]$config.InterfaceAlias
        $description = [string]$config.NetAdapter.InterfaceDescription
        $identity = "$alias $description"

        if ($identity -match $blockedPattern) {
            continue
        }

        $metric = 5000
        try {
            $ipInterface = Get-NetIPInterface -AddressFamily IPv4 -InterfaceIndex $config.InterfaceIndex -ErrorAction Stop
            if ($null -ne $ipInterface.InterfaceMetric) {
                $metric = [int]$ipInterface.InterfaceMetric
            }
        }
        catch {
            # Metric is only used for ranking, so keep the fallback value.
        }

        foreach ($address in $config.IPv4Address) {
            $ip = [string]$address.IPAddress
            if (-not (Test-UsableIpv4 $ip)) {
                continue
            }

            $score = 0

            if ($alias -match '(?i)(wi-?fi|wireless|wlan)') {
                $score += 120
            }
            elseif ($alias -match '(?i)ethernet') {
                $score += 100
            }
            else {
                $score += 50
            }

            $score += Get-PrivateRangeScore $ip
            $score -= [Math]::Min($metric, 100)

            [pscustomobject]@{
                IP = $ip
                Alias = $alias
                Description = $description
                Metric = $metric
                Score = $score
            }
        }
    }

    return $items | Sort-Object Score -Descending
}

if ([string]::IsNullOrWhiteSpace($IpAddress)) {
    $candidates = @(Get-TripMateLanCandidates)

    if ($candidates.Count -eq 0) {
        Write-Host 'Could not detect a usable Wi-Fi/Ethernet IPv4 address.' -ForegroundColor Red
        Write-Host 'Run ipconfig and then use: start-network.bat <YOUR_IPV4_ADDRESS>'
        exit 1
    }

    $selected = $candidates[0]
    $IpAddress = $selected.IP

    Write-Host ''
    Write-Host 'Detected network adapters:' -ForegroundColor Cyan
    foreach ($candidate in $candidates) {
        $marker = if ($candidate.IP -eq $IpAddress) { '>>' } else { '  ' }
        Write-Host "$marker $($candidate.IP)  [$($candidate.Alias)]  $($candidate.Description)"
    }
}
elseif (-not (Test-UsableIpv4 $IpAddress)) {
    Write-Host "The supplied IPv4 address is invalid: $IpAddress" -ForegroundColor Red
    exit 1
}

$frontendUrl = "http://$($IpAddress):4200"
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
Write-Host "Selected adapter IP: $IpAddress"
Write-Host "Frontend invitation URL: $frontendUrl"
Write-Host "Backend API: http://$($IpAddress):8080/api/v1"
Write-Host ''
Write-Host 'Starting backend and Angular in separate windows...'

Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', "`"$root\run-backend.bat`""
Start-Sleep -Seconds 3
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', "cd /d `"$root\web`" && npm run start:network"

Write-Host ''
Write-Host 'Waiting for Angular port 4200...' -ForegroundColor Yellow

$ready = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            $ready = $true
            break
        }
    }
    catch {
        # Keep waiting while Angular starts.
    }
}

Write-Host ''
if ($ready) {
    Write-Host 'TripMate is reachable on the selected LAN address.' -ForegroundColor Green
    Write-Host 'Open this URL on another device connected to the same Wi-Fi:' -ForegroundColor Cyan
    Write-Host $frontendUrl
}
else {
    Write-Host "TripMate did not respond at $frontendUrl." -ForegroundColor Red
    Write-Host ''
    Write-Host 'Possible causes:'
    Write-Host '1. The selected IP is not your real Wi-Fi/Ethernet IPv4 address.'
    Write-Host '2. Windows Firewall is blocking Node.js/Java on Private networks.'
    Write-Host '3. Angular or the backend failed to start.'
    Write-Host ''
    Write-Host 'Run ipconfig, find the IPv4 Address under your active Wi-Fi/Ethernet adapter, then run:'
    Write-Host '  start-network.bat <YOUR_IPV4_ADDRESS>' -ForegroundColor Cyan
}

Write-Host ''
Write-Host 'If Windows Firewall asks for Node.js or Java access, allow Private networks.'
