# PowerShell Script: Automatic Control Vector Training & Module Setup
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   🧠 亨創 AI 會議助理 - 本機表徵控制向量訓練器" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoDir = Split-Path -Parent $scriptDir
$trainingDir = Join-Path $repoDir "TrainingData"
$modelsDir = "D:\project\models"
$llamaDir = "D:\project\llama.cpp"
$cvectorExe = Join-Path $llamaDir "llama-cvector-generator.exe"
$modelPath = Join-Path $modelsDir "qwen2.5-7b-instruct-q4_k_m.gguf"
$outputVector = Join-Path $modelsDir "hengchuang_style.gguf"

# 1. 檢查訓練數據集
$dpoPath = Join-Path $trainingDir "training_dpo.jsonl"
if (-not (Test-Path $dpoPath)) {
    Write-Host "❌ 尚未找到 training_dpo.jsonl！請先執行 '一鍵配對與模型訓練.bat' 產生配對數據！" -ForegroundColor Red
    Pause
    exit 1
}

# 2. 檢查 llama-cvector-generator.exe 執行檔
if (-not (Test-Path $cvectorExe)) {
    Write-Host "⚠️ 未在 $llamaDir 找到 llama-cvector-generator.exe。" -ForegroundColor Yellow
    Write-Host "正在嘗試從 llama.cpp 官方 GitHub 下載 Windows Release..." -ForegroundColor Cyan
    $zipUrl = "https://github.com/ggerganov/llama.cpp/releases/download/b3600/llama-b3600-bin-win-avx2-x64.zip"
    $zipDest = Join-Path $llamaDir "llama_tools.zip"
    try {
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipDest -TimeoutSec 60
        Expand-Archive -Path $zipDest -DestinationPath $llamaDir -Force
        Remove-Item $zipDest -Force
        Write-Host "✅ 工具下載並解壓縮完成！" -ForegroundColor Green
    } catch {
        Write-Host "❌ 自動下載失敗，請手動將 llama-cvector-generator.exe 放置於 $llamaDir" -ForegroundColor Red
        Pause
        exit 1
    }
}

# 3. 檢查模型權重檔
if (-not (Test-Path $modelPath)) {
    Write-Host "❌ 未在 $modelsDir 找到模型檔案 $modelPath！" -ForegroundColor Red
    Pause
    exit 1
}

# 4. 準備訓練數據格式
Write-Host "正在準備表徵控制向量校準樣本..." -ForegroundColor Cyan
$datasetTxt = Join-Path $trainingDir "cvector_training_pairs.txt"
$lines = Get-Content $dpoPath | ConvertFrom-Json
$pairContent = ""
foreach ($item in $lines) {
    $pairContent += "=== POSITIVE ===`n" + $item.chosen + "`n=== NEGATIVE ===`n" + $item.rejected + "`n`n"
}
[System.IO.File]::WriteAllText($datasetTxt, $pairContent, [System.Text.Encoding]::UTF8)

# 5. 啟動訓練
Write-Host "🚀 正在啟動 CPU 表徵控制向量訓練 (約需 2~3 分鐘)..." -ForegroundColor Green
$trainArgs = @("-m", $modelPath, "-o", $outputVector, "--threads", "10")
& $cvectorExe $trainArgs

if (Test-Path $outputVector) {
    Write-Host "🎉 訓練大成功！風格控制向量已生成：" -ForegroundColor Green
    Write-Host "   📁 $outputVector" -ForegroundColor Cyan
    Write-Host "下次啟動會議助理時，模型將自動套用此專屬高管風格向量！" -ForegroundColor Green
} else {
    Write-Host "❌ 訓練過程中斷，請檢查記憶體與日誌。" -ForegroundColor Red
}

Pause
