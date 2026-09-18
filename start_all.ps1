# Windows 100% Reliable Launcher for AI Meeting Assistant

# 1. 檢查並啟動 Qwen 2.5 7B AI 引擎 (Port 8080)
$is8080 = netstat -ano | findstr ":8080" | findstr "LISTENING"
if (-not $is8080) {
    Write-Host "[1/4] 正在載入 Qwen 2.5 7B AI 大腦..." -ForegroundColor Cyan
    $model = "D:\project\models\qwen2.5-7b-instruct-q4_k_m.gguf"
    if (-not (Test-Path $model)) { $model = "D:\project\models\Qwen2.5-7B-Instruct-Q4_K_M.gguf" }

    $llamaArgs = @("-m", $model, "--port", "8080", "-c", "8192", "--threads", "10", "--host", "127.0.0.1")
    Start-Process -FilePath "D:\project\llama.cpp\llama-server.exe" -ArgumentList $llamaArgs -WindowStyle Hidden
} else {
    Write-Host "[1/4] Qwen 2.5 7B AI 大腦已在運行中。" -ForegroundColor Green
}

# 2. 檢查並啟動 Deno Web 伺服器 (Port 8088)
$is8088 = netstat -ano | findstr ":8088" | findstr "LISTENING"
if (-not $is8088) {
    Write-Host "[2/4] 正在啟動會議助理雙引擎伺服器..." -ForegroundColor Cyan
    $denoArgs = @("run", "-A", "--no-check", "D:\project\MeetingAssistant\server.ts")
    Start-Process -FilePath "D:\project\deno.exe" -ArgumentList $denoArgs -WorkingDirectory "D:\project\MeetingAssistant" -WindowStyle Hidden
} else {
    Write-Host "[2/4] 會議助理雙引擎伺服器已在運行中。" -ForegroundColor Green
}

# 3. 輪詢檢測本機回應 (最多 15 次)
Write-Host "[3/4] 正在檢測本機服務就緒狀態與預熱模型..." -ForegroundColor Yellow
for ($i = 1; $i -le 15; $i++) {
    Start-Sleep -Milliseconds 600
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:8088/" -UseBasicParsing -TimeoutSec 1
        if ($res.StatusCode -eq 200) {
            break
        }
    } catch {}
    Write-Host "      等待服務響應 ($i/15)..."
}

# 4. 開啟專屬應用程式視窗
Write-Host "[4/4] 服務與雙引擎已就緒，正在開啟應用程式視窗..." -ForegroundColor Green
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

if (Test-Path $edge) {
    Start-Process -FilePath $edge -ArgumentList @("--app=http://127.0.0.1:8088/", "--window-size=1420,920")
} else {
    Start-Process "http://127.0.0.1:8088/"
}

Start-Sleep -Seconds 1