@echo off
setlocal
cd /d "D:\project\MeetingAssistant"

REM Step 1: Check and start Qwen 2.5 7B AI on Port 8080
netstat -ano | findstr ":8080" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo [1/3] Loading Qwen 2.5 7B AI Engine...
    start "Qwen_AI_Engine" /min "D:\project\llama.cpp\llama-server.exe" -m "D:\project\models\qwen2.5-7b-instruct-q4_k_m.gguf" --port 8080 -c 8192 --threads 10 --host 127.0.0.1
)

REM Step 2: Check and start Meeting Assistant Web Server on Port 8088
netstat -ano | findstr ":8088" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo [2/3] Starting Meeting Assistant Web Server...
    start "Meeting_Assistant_Server" /min "D:\project\deno.exe" run -A --no-check "D:\project\MeetingAssistant\server.ts"
)

REM Step 3: Launch Native Window
echo [3/3] Launching Meeting Assistant App...
timeout /t 2 /nobreak >nul

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8088/ --window-size=1420,920
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8088/ --window-size=1420,920
) else (
    start "" "http://127.0.0.1:8088/"
)

endlocal
exit
