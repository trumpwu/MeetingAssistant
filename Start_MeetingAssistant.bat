@echo off
chcp 65001 >nul
title AI Meeting Assistant - Launching...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_all.ps1"
exit
