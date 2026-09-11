@echo off
chcp 65001 >nul
title GitHub 認證與推送
echo ========================================================
echo   🚀 正在連接 GitHub 並啟動微軟 Git 憑證登入認證...
echo ========================================================
echo.
cd /d "%~dp0"
set GIT_EXE=D:\project\git\cmd\git.exe
if not exist "%GIT_EXE%" set GIT_EXE=git

"%GIT_EXE%" push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   🎉 上傳成功！已成功推送至您的 GitHub 儲存庫！
    echo ========================================================
) else (
    echo.
    echo 提示：若需要設定或自訂 GitHub 儲存庫網址，
    echo 請執行 push_to_github.bat 輸入完整網址即可！
)
echo.
pause
