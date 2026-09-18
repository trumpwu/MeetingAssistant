@echo off
chcp 65001 >nul
title AI Meeting Assistant - Launching...

powershell -NoProfile -ExecutionPolicy Bypass -File "D:\project\MeetingAssistant\start_all.ps1"

exit
