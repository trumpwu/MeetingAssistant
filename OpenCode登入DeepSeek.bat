@echo off
"%SystemRoot%\System32\chcp.com" 65001 >nul
title OpenCode 登入（DeepSeek 免費雲端）
cd /d "D:\project\MeetingAssistant"
set "OPENCODE_CMD=%APPDATA%\npm\opencode.cmd"
if not exist "%OPENCODE_CMD%" set "OPENCODE_CMD=opencode"

echo.
echo ============================================================
echo  會議助理要連 DeepSeek，需要「API 憑證」寫入本機 auth.json
echo  注意：opencode console login 只登入網頁後台，不會讓會議助理通過！
echo ============================================================
echo.
echo 1) 瀏覽器開 https://opencode.ai/auth （會進 Console）
echo    登入 trumpwu@gmail.com 後點「Create API Key」複製金鑰（常見 oc_sk_...）
echo    文件：https://opencode.ai/docs/providers/#opencode-zen
echo    進階 Service Account：https://opencode.ai/console → 左側 Keys
echo 2) 若 CLI 出現瀏覽器授權，請在網頁按「Approve」；若要求貼 key 再貼上
echo.
"%OPENCODE_CMD%" auth login -p opencode
echo.
echo --- 檢查結果（應至少 1 組 credentials，且 auth.json 存在）---
"%OPENCODE_CMD%" auth list
if exist "%USERPROFILE%\.local\share\opencode\auth.json" (
  echo [OK] auth.json 已建立
) else (
  echo [失敗] 尚無 auth.json，請重新執行並正確貼上 API key
)
echo.
echo 完成後：執行會議助理捷徑，瀏覽器 Ctrl+F5，底部應顯示 DeepSeek 已連線。
pause
