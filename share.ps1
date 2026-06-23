# Ensure we run in the script's directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "         CRINAVA SHARING AUTOMATION LAUNCHER       " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Clean up old processes on port 3000 and 7860
Write-Host "[1/5] Cleaning up previous processes..." -ForegroundColor Yellow
$ports = @(3000, 7860)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

# 2. Start Live Score FastAPI Engine
Write-Host "[2/5] Starting Live Score FastAPI Engine (Port 7860)..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/c python main.py" -WindowStyle Normal

# 3. Start Frontend Dev Server
Write-Host "[3/5] Starting Frontend & Oracle API Server (Port 3000)..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/c npm run dev" -WindowStyle Normal

# Wait for local server to spin up
Write-Host "Warming up servers (5 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# 4. Start Serveo Tunnel and capture the URL
Write-Host "[4/5] Establishing secure tunnel via serveo.net..." -ForegroundColor Yellow
$logFile = Join-Path $scriptDir "serveo.log"
if (Test-Path $logFile) { Remove-Item $logFile }

# Launch SSH tunnel and log stdout
Start-Process ssh -ArgumentList "-R 80:127.0.0.1:3000 serveo.net" -RedirectStandardOutput $logFile -NoNewWindow

# Read the log file until we find the HTTPS link
Write-Host "Retrieving secure public URL..." -ForegroundColor Gray
$url = $null
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $logFile) {
        $content = Get-Content $logFile -Raw
        if ($content -match "(https://[a-zA-Z0-9-]+\.serveousercontent\.com)") {
            $url = $Matches[1]
            break
        }
    }
}

# 5. Open browser or handle error
if ($url) {
    Write-Host "[5/5] Success! Tunnel URL: $url" -ForegroundColor Green
    Write-Host "Opening in default browser..." -ForegroundColor Green
    Start-Process $url
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Green
    Write-Host "   CRINAVA IS LIVE ONLINE!                         " -ForegroundColor Green
    Write-Host "   Press Ctrl+C in this window to stop tunnel.     " -ForegroundColor Green
    Write-Host "===================================================" -ForegroundColor Green
} else {
    Write-Host "[-] Failed to retrieve Serveo link. Please check if serveo.net is reachable." -ForegroundColor Red
}

# Keep window open to keep tunnel alive
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host "Stopping SSH tunnel..." -ForegroundColor Yellow
    Stop-Process -Name ssh -ErrorAction SilentlyContinue
}
