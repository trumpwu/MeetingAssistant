@echo off
chcp 65001 >nul
title AI 智慧會議記錄助理

:: 1. 檢查 8088 伺服器是否正在運行，如果沒有則在背景最小化啟動
netstat -ano | findstr ":8088" >nul
if %errorlevel% neq 0 (
    start "" /min powershell -NoProfile -ExecutionPolicy Bypass -File "D:\project\MeetingAssistant\server.ps1"
    timeout /t 1 /nobreak >nul
)

:: 2. 以獨立軟體視窗模式開啟 (Edge App 模式)
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:8088/ --window-size=1280,850
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:8088/ --window-size=1280,850
) else (
    start "" "http://localhost:8088/"
)

exit
