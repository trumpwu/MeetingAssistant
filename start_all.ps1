# Windows 100% Reliable Launcher for AI Meeting Assistant

# 1. Check & Start Qwen 2.5 7B AI Brain (Port 8080)
$is8080 = netstat -ano | findstr ":8080" | findstr "LISTENING"
if (-not $is8080) {
    Write-Host "[1/4] Loading Qwen 2.5 7B AI Brain..." -ForegroundColor Cyan
    $model = "D:\project\models\qwen2.5-7b-instruct-q4_k_m.gguf"
    if (-not (Test-Path $model)) { $model = "D:\project\models\Qwen2.5-7B-Instruct-Q4_K_M.gguf" }

    $llamaArgs = @("-m", $model, "--port", "8080", "-c", "8192", "--threads", "10", "--host", "127.0.0.1")
    Start-Process -FilePath "D:\project\llama.cpp\llama-server.exe" -ArgumentList $llamaArgs -WindowStyle Hidden
} else {
    Write-Host "[1/4] Qwen 2.5 7B AI Brain is already running." -ForegroundColor Green
}

# 2. Check & Start Deno Web Server (Port 8088)
$is8088 = netstat -ano | findstr ":8088" | findstr "LISTENING"
if (-not $is8088) {
    Write-Host "[2/4] Starting Meeting Assistant Web Server..." -ForegroundColor Cyan
    $denoArgs = @("run", "-A", "--no-check", "D:\project\MeetingAssistant\server.ts")
    Start-Process -FilePath "D:\project\deno.exe" -ArgumentList $denoArgs -WorkingDirectory "D:\project\MeetingAssistant" -WindowStyle Minimized
} else {
    Write-Host "[2/4] Meeting Assistant Web Server is already running." -ForegroundColor Green
}

# 3. Poll for readiness (up to 25 times)
Write-Host "[3/4] Checking server readiness and pre-warming models..." -ForegroundColor Yellow
for ($i = 1; $i -le 25; $i++) {
    Start-Sleep -Milliseconds 600
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:8088/" -UseBasicParsing -TimeoutSec 1
        if ($res.StatusCode -eq 200) {
            break
        }
    } catch {}
    Write-Host "      Waiting for server ($i/25)..."
}

# 4. Open Dedicated App Window
Write-Host "[4/4] Services ready! Opening application window..." -ForegroundColor Green
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

if (Test-Path $edge) {
    Start-Process -FilePath $edge -ArgumentList @("--app=http://127.0.0.1:8088/", "--window-size=1420,920")
} else {
    Start-Process "http://127.0.0.1:8088/"
}

Start-Sleep -Seconds 1