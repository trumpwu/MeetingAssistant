@echo off
setlocal EnableExtensions
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\Wbem;%SystemRoot%\System32\WindowsPowerShell\v1.0;%PATH%"

echo ====================================================================
echo   AI Meeting Assistant - Auto Installer (Supports C: and D: Drives)
echo ====================================================================
echo.

set "BASE_DIR=C:\project"
if exist "D:\project\MeetingAssistant" set "BASE_DIR=D:\project"
set "APP_DIR=%BASE_DIR%\MeetingAssistant"
set "SV_DIR=%BASE_DIR%\SenseVoice"
set "NEMO_DIR=%BASE_DIR%\NeMo-Speech"

if not exist "%BASE_DIR%" mkdir "%BASE_DIR%"
if not exist "%APP_DIR%" mkdir "%APP_DIR%"
if not exist "%BASE_DIR%\Meetings" mkdir "%BASE_DIR%\Meetings"
if not exist "%BASE_DIR%\temp_transcribe" mkdir "%BASE_DIR%\temp_transcribe"

echo [Step 0] Copying application files to %APP_DIR% ...
if /I not "%~dp0"=="%APP_DIR%\" (
    xcopy "%~dp0*.*" "%APP_DIR%\" /E /I /Y >nul 2>&1
)

echo [Step 1/4] Checking Deno runtime (%BASE_DIR%\deno.exe) ...
if not exist "%BASE_DIR%\deno.exe" (
    echo Downloading Deno runtime ...
    "%SystemRoot%\System32\curl.exe" -L -o "%BASE_DIR%\deno.zip" "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip"
    "%SystemRoot%\System32\tar.exe" -xf "%BASE_DIR%\deno.zip" -C "%BASE_DIR%"
    del /f /q "%BASE_DIR%\deno.zip" >nul 2>&1
)
echo [OK] Deno ready.
echo.

echo [Step 2/4] Checking FFmpeg (%APP_DIR%\ffmpeg.exe) ...
if not exist "%APP_DIR%\ffmpeg.exe" (
    echo Downloading FFmpeg ...
    "%SystemRoot%\System32\curl.exe" -L -o "%BASE_DIR%\ffmpeg.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    "%SystemRoot%\System32\tar.exe" -xf "%BASE_DIR%\ffmpeg.zip" -C "%BASE_DIR%"
    for /r "%BASE_DIR%\ffmpeg-master-latest-win64-gpl" %%F in (ffmpeg.exe) do (
        if exist "%%F" copy /Y "%%F" "%APP_DIR%\ffmpeg.exe" >nul
    )
    rmdir /s /q "%BASE_DIR%\ffmpeg-master-latest-win64-gpl" >nul 2>&1
    del /f /q "%BASE_DIR%\ffmpeg.zip" >nul 2>&1
)
echo [OK] FFmpeg ready.
echo.

echo [Step 3/4] Checking SenseVoice 50x STT Engine ...
if not exist "%SV_DIR%\sherpa-onnx-v1.13.8-win-x64-shared-MT-Release\bin\sherpa-onnx-offline.exe" (
    if not exist "%SV_DIR%" mkdir "%SV_DIR%"
    echo Downloading sherpa-onnx runtime ...
    "%SystemRoot%\System32\curl.exe" -L -o "%SV_DIR%\sherpa.tar.bz2" "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-v1.13.8-win-x64-shared-MT-Release.tar.bz2"
    "%SystemRoot%\System32\tar.exe" -xf "%SV_DIR%\sherpa.tar.bz2" -C "%SV_DIR%"
    del /f /q "%SV_DIR%\sherpa.tar.bz2" >nul 2>&1
)
if not exist "%SV_DIR%\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\model.int8.onnx" (
    if not exist "%SV_DIR%" mkdir "%SV_DIR%"
    echo Downloading SenseVoice multilingual model ...
    "%SystemRoot%\System32\curl.exe" -L -o "%SV_DIR%\sv_model.tar.bz2" "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17.tar.bz2"
    "%SystemRoot%\System32\tar.exe" -xf "%SV_DIR%\sv_model.tar.bz2" -C "%SV_DIR%"
    del /f /q "%SV_DIR%\sv_model.tar.bz2" >nul 2>&1
)
echo [OK] SenseVoice ready.
echo.

echo [Step 4/4] Building Desktop Launcher ...
if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:winexe /out:"%APP_DIR%\AI_Meeting_Assistant.exe" /r:System.Windows.Forms.dll,System.Drawing.dll,System.dll "%APP_DIR%\Launcher.cs" >nul 2>&1
    copy /Y "%APP_DIR%\AI_Meeting_Assistant.exe" "%USERPROFILE%\Desktop\AI_Meeting_Assistant.exe" >nul 2>&1
)
copy /Y "%APP_DIR%\MeetingAssistant_StartCore.bat" "%USERPROFILE%\Desktop\Start_Meeting_Assistant.bat" >nul 2>&1

echo ====================================================================
echo   [SUCCESS] Installation Complete!
echo   Starting AI Meeting Assistant now ...
echo ====================================================================
call "%APP_DIR%\MeetingAssistant_StartCore.bat"
pause
