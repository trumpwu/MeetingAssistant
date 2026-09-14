@echo off
chcp 65001 >nul
title 🧠 亨創 AI 會議助理 - 一鍵自動配對與模型訓練管線
cd /d "%~dp0"

if exist "..\deno.exe" (
    "..\deno.exe" run -A "scripts\build_and_train.ts"
) else (
    deno run -A "scripts\build_and_train.ts"
)

echo.
pause
