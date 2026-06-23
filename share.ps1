# Ensure we run in the script's directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (!$scriptDir) { $scriptDir = $PSScriptRoot }
if (!$scriptDir) { $scriptDir = Get-Location }
Set-Location $scriptDir

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "         CRINAVA SHARING AUTOMATION LAUNCHER       " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Clean up old processes on port 3000 and 7860 using netstat
Write-Host "[1/5] Cleaning up previous processes..." -ForegroundColor Yellow
$ports = @(3000, 7860)
foreach ($port in $ports) {
    # Use netstat to find PIDs on the port
    $pids = netstat -ano | Select-String ":$port\s+" | ForEach-Object {
        $parts = $_.Line.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
        $parts[$parts.Length - 1]
    }
    foreach ($p in $pids) {
        if ($p -match '^\d+$' -and $p -ne '0') {
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
    }
}

# Clean up log files
$fastapiLog = Join-Path $scriptDir "fastapi.log"
$fastapiErr = Join-Path $scriptDir "fastapi_error.log"
$npmLog = Join-Path $scriptDir "npm.log"
$npmErr = Join-Path $scriptDir "npm_error.log"
$serveoLog = Join-Path $scriptDir "serveo.log"
$serveoErr = Join-Path $scriptDir "serveo_error.log"

foreach ($file in @($fastapiLog, $fastapiErr, $npmLog, $npmErr, $serveoLog, $serveoErr)) {
    if (Test-Path $file) { Remove-Item $file }
}

# 2. Start Live Score FastAPI Engine (Silently in background)
Write-Host "[2/5] Starting Live Score FastAPI Engine..." -ForegroundColor Yellow
$fastapiProc = Start-Process python -ArgumentList "main.py" -WorkingDirectory $scriptDir -NoNewWindow -RedirectStandardOutput $fastapiLog -RedirectStandardError $fastapiErr -PassThru

# 3. Start Frontend Dev Server (Silently in background)
Write-Host "[3/5] Starting Frontend & Oracle API Server..." -ForegroundColor Yellow
$npmProc = Start-Process cmd -ArgumentList "/c npm run dev" -WorkingDirectory $scriptDir -NoNewWindow -RedirectStandardOutput $npmLog -RedirectStandardError $npmErr -PassThru

# Wait for local server to spin up
Write-Host "Warming up servers (5 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# 4. Start Serveo Tunnel (Silently in background with strict host key checking disabled)
Write-Host "[4/5] Establishing secure tunnel via serveo.net..." -ForegroundColor Yellow
$sshProc = Start-Process ssh -ArgumentList "-o StrictHostKeyChecking=no -R 80:127.0.0.1:3000 serveo.net" -WorkingDirectory $scriptDir -RedirectStandardOutput $serveoLog -RedirectStandardError $serveoErr -NoNewWindow -PassThru

# Read the log file until we find the HTTPS link
Write-Host "Retrieving secure public URL..." -ForegroundColor Gray
$url = $null
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $serveoLog) {
        $content = Get-Content $serveoLog -Raw
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
    Write-Host "   Keep this window open to keep the site live.    " -ForegroundColor Green
    Write-Host "   Press Ctrl+C in this window to stop everything. " -ForegroundColor Green
    Write-Host "===================================================" -ForegroundColor Green
} else {
    Write-Host "[-] Failed to retrieve Serveo link." -ForegroundColor Red
    Write-Host "    Logs to debug:" -ForegroundColor Red
    if (Test-Path $npmLog) {
        Write-Host "--- NPM DEV SERVER LOG ---" -ForegroundColor Gray
        Get-Content $npmLog -Tail 10
    }
    if (Test-Path $npmErr) {
        Write-Host "--- NPM DEV SERVER ERROR LOG ---" -ForegroundColor Gray
        Get-Content $npmErr -Tail 10
    }
    if (Test-Path $serveoLog) {
        Write-Host "--- SERVEO TUNNEL LOG ---" -ForegroundColor Gray
        Get-Content $serveoLog -Tail 10
    }
    if (Test-Path $serveoErr) {
        Write-Host "--- SERVEO TUNNEL ERROR LOG ---" -ForegroundColor Gray
        Get-Content $serveoErr -Tail 10
    }
}

# Keep window open to keep tunnel and servers alive
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host "`nStopping all processes..." -ForegroundColor Yellow
    
    # Terminate SSH tunnel
    if ($sshProc) { $sshProc | Stop-Process -Force -ErrorAction SilentlyContinue }
    # Terminate Node/npm
    if ($npmProc) { $npmProc | Stop-Process -Force -ErrorAction SilentlyContinue }
    # Terminate Python
    if ($fastapiProc) { $fastapiProc | Stop-Process -Force -ErrorAction SilentlyContinue }
    
    # Backup port cleanup
    foreach ($port in $ports) {
        $pids = netstat -ano | Select-String ":$port\s+" | ForEach-Object {
            $parts = $_.Line.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
            $parts[$parts.Length - 1]
        }
        foreach ($p in $pids) {
            if ($p -match '^\d+$' -and $p -ne '0') {
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
            }
        }
    }
    
    Write-Host "All processes cleaned up successfully." -ForegroundColor Green
}
