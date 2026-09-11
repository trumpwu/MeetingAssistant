@echo off
chcp 65001 >nul
echo ========================================================
echo   🚀 推送 AI 智慧會議記錄助理至 GitHub 私人儲存庫
echo ========================================================
echo.

set GIT_EXE=D:\project\git\cmd\git.exe

if not exist "%GIT_EXE%" (
    echo 找不到 Git，正在使用系統預設 Git...
    set GIT_EXE=git
)

set /p REPO_URL=請輸入您的 GitHub 私人儲存庫網址 (例如 https://github.com/username/MeetingAssistant.git): 

if "%REPO_URL%"=="" (
    echo 錯誤: 網址不能為空！
    pause
    exit /b
)

cd /d "D:\project\MeetingAssistant"
"%GIT_EXE%" branch -M main
"%GIT_EXE%" remote remove origin 2>nul
"%GIT_EXE%" remote add origin %REPO_URL%
"%GIT_EXE%" add .
"%GIT_EXE%" commit -m "feat: AI Meeting Assistant with Qwen2.5, SenseVoice, Whisper" 2>nul
echo 正在推送到 GitHub...
"%GIT_EXE%" push -u origin main

echo.
echo ========================================================
echo   🎉 推送完成！
echo ========================================================
pause
