# Windows Launcher for AI Meeting Assistant — DeepSeek Free Cloud via OpenCode

# 1. OpenCode Zen free cloud (Port 4096)
$is4096 = netstat -ano | findstr ":4096" | findstr "LISTENING"
if (-not $is4096) {
    Write-Host "[1/4] Starting OpenCode DeepSeek V4.1 Flash Free..." -ForegroundColor Cyan
    Start-Process -FilePath "opencode" -ArgumentList @("serve", "--port", "4096", "--hostname", "127.0.0.1") -WorkingDirectory "D:\project\MeetingAssistant" -WindowStyle Minimized
} else {
    Write-Host "[1/4] OpenCode cloud gateway already running." -ForegroundColor Green
}

# 2. Deno Web Server (Port 18788). 8088 is occupied by XQ daq.exe.
$ours = $false
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:18788/api/health" -TimeoutSec 2
    $ours = $health.app -eq "meeting-assistant"
} catch {}
if (-not $ours) {
    Write-Host "[2/4] Starting Meeting Assistant Web Server..." -ForegroundColor Cyan
    $denoArgs = @("run", "-A", "--no-check", "D:\project\MeetingAssistant\server.ts")
    Start-Process -FilePath "D:\project\deno.exe" -ArgumentList $denoArgs -WorkingDirectory "D:\project\MeetingAssistant" -WindowStyle Minimized
} else {
    Write-Host "[2/4] Meeting Assistant Web Server is already running." -ForegroundColor Green
}

# 3. Poll for readiness
Write-Host "[3/4] Checking server readiness..." -ForegroundColor Yellow
for ($i = 1; $i -le 25; $i++) {
    Start-Sleep -Milliseconds 600
    try {
        $llm = Invoke-RestMethod -Uri "http://127.0.0.1:18788/api/llm-status" -TimeoutSec 2
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:18788/" -UseBasicParsing -TimeoutSec 1
        if ($res.StatusCode -eq 200 -and $llm.ready) { break }
        if ($res.StatusCode -eq 200 -and $i -gt 8) { break }
    } catch {}
    Write-Host "      Waiting for server ($i/25)..."
}

# 4. Open Dedicated App Window
Write-Host "[4/4] Services ready! Opening application window..." -ForegroundColor Green
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

if (Test-Path $edge) {
    Start-Process -FilePath $edge -ArgumentList @("--app=http://127.0.0.1:18788/", "--window-size=1420,920")
} else {
    Start-Process "http://127.0.0.1:18788/"
}

Start-Sleep -Seconds 1
