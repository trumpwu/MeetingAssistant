@echo off
chcp 65001 >nul
title AI Meeting Assistant

:: 1. 檢查並啟動 Qwen 2.5 7B AI 大腦 (Port 8080)
netstat -ano | findstr ":8080" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo [1/3] 正在載入 Qwen 2.5 7B AI 大腦...
    start "" /min "D:\project\llama.cpp\llama-server.exe" -m "D:\project\models\qwen2.5-7b-instruct-q4_k_m.gguf" --port 8080 -c 8192 --threads 10 --host 127.0.0.1
)

:: 2. 檢查並啟動會議助理 Web 伺服器 (Port 8088)
netstat -ano | findstr ":8088" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo [2/3] 正在啟動會議助理雙引擎伺服器...
    cd /d "D:\project\MeetingAssistant"
    start "" /min "D:\project\deno.exe" run -A --no-check "D:\project\MeetingAssistant\server.ts"
)

:: 3. 等候就緒並開啟專屬應用程式視窗
echo [3/3] 正在開啟專屬應用程式視窗...
timeout /t 2 /nobreak >nul

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8088/ --window-size=1420,920
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8088/ --window-size=1420,920
) else (
    start "" "http://127.0.0.1:8088/"
)

exit
