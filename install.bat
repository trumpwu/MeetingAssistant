@echo off
chcp 65001 >nul
title AI 智慧會議記錄助理 - 自動安裝與環境部署精靈

echo ====================================================================
echo      🚀 AI 智慧會議記錄助理 - 跨電腦全自動安裝與部署精靈
echo ====================================================================
echo.

:: 判斷安裝根目錄 (若在 D 槽優先使用 D:\project，否則使用目前所在磁碟)
set "BASE_DIR=%~d0\project"
if not exist "%~d0\" set "BASE_DIR=C:\project"
set "APP_DIR=%~dp0"
set "MODELS_DIR=%BASE_DIR%\models"
set "LLAMA_DIR=%BASE_DIR%\llama.cpp"

if not exist "%BASE_DIR%" mkdir "%BASE_DIR%"
if not exist "%MODELS_DIR%" mkdir "%MODELS_DIR%"
if not exist "%LLAMA_DIR%" mkdir "%LLAMA_DIR%"

echo 📁 安裝目標路徑：%BASE_DIR%
echo.

:: 1. Deno 環境
echo [1/4] 檢查 Deno 高效能伺服器環境...
if not exist "%BASE_DIR%\deno.exe" (
    echo 正在下載 Deno 執行檔...
    curl -L -o "%BASE_DIR%\deno.zip" "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip" --progress-bar
    tar -xf "%BASE_DIR%\deno.zip" -C "%BASE_DIR%"
    del "%BASE_DIR%\deno.zip"
)
echo  Deno 運行環境就緒！
echo.

:: 2. llama.cpp 引擎
echo [2/4] 檢查 llama.cpp 本機 AI 推論引擎...
if not exist "%LLAMA_DIR%\llama-server.exe" (
    echo 正在下載 llama.cpp 引擎 (AVX2 高速版)...
    curl -L -o "%BASE_DIR%\llama-bin.zip" "https://github.com/ggerganov/llama.cpp/releases/download/b4200/llama-b4200-bin-win-avx2-x64.zip" --progress-bar
    tar -xf "%BASE_DIR%\llama-bin.zip" -C "%LLAMA_DIR%"
    del "%BASE_DIR%\llama-bin.zip"
)
echo  llama.cpp 引擎就緒！
echo.

:: 3. 選擇 AI 模型 (適配不同硬體規格)
echo [3/4] 請選擇適合這台電腦規格的 AI 核心模型：
echo.
echo   [1] 🏆 旗艦標準版 - Qwen 2.5 7B (推薦 16GB RAM，深度推理與精準提煉) [4.46 GB]
echo   [2] ⚡ 輕量高階版 - Qwen 2.5 3B (推薦 8GB~12GB RAM 舊筆電，超快速度)  [1.93 GB]
echo   [3] 🚀 極速省電版 - Qwen 2.5 1.5B (推薦 4GB~8GB 老舊筆電，極致輕巧)   [1.06 GB]
echo.
set /p MODEL_CHOICE="請輸入選項 (預設 1，直接按 Enter 選擇 1): "

if "%MODEL_CHOICE%"=="2" (
    set "MODEL_FILE=Qwen2.5-3B-Instruct-Q4_K_M.gguf"
    set "MODEL_URL=https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf"
) else if "%MODEL_CHOICE%"=="3" (
    set "MODEL_FILE=Qwen2.5-1.5B-Instruct-Q4_K_M.gguf"
    set "MODEL_URL=https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf"
) else (
    set "MODEL_FILE=Qwen2.5-7B-Instruct-Q4_K_M.gguf"
    set "MODEL_URL=https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf"
)

if not exist "%MODELS_DIR%\%MODEL_FILE%" (
    echo.
    echo 正在下載 AI 核心模型 [%MODEL_FILE%]...
    curl -L -o "%MODELS_DIR%\%MODEL_FILE%" "%MODEL_URL%" --progress-bar
)
echo  核心 AI 模型 [%MODEL_FILE%] 就緒！
echo.

:: 4. 編譯與建立原生 Windows 桌面主程式 (.exe) 與訓練工具
echo [4/4] 正在封裝原生 Windows 桌面程式與自動微調工具...
if not exist "%APP_DIR%\TrainingData" mkdir "%APP_DIR%\TrainingData"
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /out:"%APP_DIR%\AI智慧會議助理.exe" /r:System.Windows.Forms.dll,System.Drawing.dll,System.dll "%APP_DIR%\Launcher.cs" >nul 2>&1
copy /Y "%APP_DIR%\AI智慧會議助理.exe" "%USERPROFILE%\Desktop\AI智慧會議助理.exe" >nul
copy /Y "%APP_DIR%\一鍵配對與模型訓練.bat" "%USERPROFILE%\Desktop\一鍵配對與模型訓練.bat" >nul
echo  桌面主程式已建立至：%USERPROFILE%\Desktop\AI智慧會議助理.exe
echo  自動微調工具已建立至：%USERPROFILE%\Desktop\一鍵配對與模型訓練.bat
echo.

echo ====================================================================
echo   🎉 全自動原生桌面應用程式與 AI 微調管線封裝完成！
echo   1. 雙擊桌面【AI智慧會議助理.exe】立即開始使用會議助理！
echo   2. 雙擊桌面【一鍵配對與模型訓練.bat】可自動配對微調數據！
echo ====================================================================
echo.
pause
