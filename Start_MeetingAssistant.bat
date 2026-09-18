@echo off
chcp 65001 >nul
title 🚀 AI 智慧會議記錄助理 - 正在啟動...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_all.ps1"
exit
