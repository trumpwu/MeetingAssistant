@echo off
chcp 65001 >nul
title 🚀 GitHub 儲存庫推送中...

echo ====================================================================
echo   🚀 正在連接 GitHub 儲存庫...
echo ====================================================================
echo.

cd /d "%~dp0"
set GIT_EXE=D:\project\git\cmd\git.exe
if not exist "%GIT_EXE%" set GIT_EXE=git

"%GIT_EXE%" branch -M main

echo 正在執行 git push -u origin main...
echo.

"%GIT_EXE%" push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ====================================================================
    echo   🎉 上傳成功！已成功推送至 GitHub 儲存庫！
    echo ====================================================================
) else (
    echo --------------------------------------------------------------------
    echo 提示：若瀏覽器跳出授權確認，請點選綠色「Authorize」完成授權；
    echo 若儲存庫尚未建立，請確認已在 GitHub 建立同名儲存庫。
    echo --------------------------------------------------------------------
)
echo.
pause
