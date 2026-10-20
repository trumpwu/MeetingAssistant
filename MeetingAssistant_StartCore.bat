@echo off
setlocal EnableExtensions
"%SystemRoot%\System32\chcp.com" 65001 >nul
cd /d "D:\project\MeetingAssistant"

set "PORT=18788"
set "APPURL=http://127.0.0.1:%PORT%/"
set "DENO=D:\project\deno.exe"
set "SERVER_TS=D:\project\MeetingAssistant\server.ts"
set "CURL=%SystemRoot%\System32\curl.exe"
set "FINDSTR=%SystemRoot%\System32\findstr.exe"
set "NETSTAT=%SystemRoot%\System32\netstat.exe"
set "TIMEOUT=%SystemRoot%\System32\timeout.exe"
set "OPENCODE_CMD=%APPDATA%\npm\opencode.cmd"
if not exist "%OPENCODE_CMD%" set "OPENCODE_CMD=opencode"

set "LAUNCH_MODE=%~1"
if "%LAUNCH_MODE%"=="" set "LAUNCH_MODE=window"

if not exist "%DENO%" (
    echo [ERROR] Deno not found: %DENO%
    pause
    exit /b 1
)

"%NETSTAT%" -ano | "%FINDSTR%" ":4096" | "%FINDSTR%" "LISTENING" >nul
if errorlevel 1 (
    echo [1/3] Starting OpenCode on port 4096...
    start "OpenCode_Cloud_LLM" /min "%OPENCODE_CMD%" serve --port 4096 --hostname 127.0.0.1
) else (
    echo [1/3] OpenCode already running.
)

echo [2/3] Checking Meeting Assistant on %PORT%...
call :ma_health_ok
if errorlevel 1 (
    echo [2/3] Starting Deno server...
    start "Meeting_Assistant_Server" /min "%DENO%" run -A --no-check "%SERVER_TS%"
) else (
    echo [2/3] Meeting Assistant already running.
)

echo [3/3] Waiting for server...
set /a TRIES=0
:waitloop
set /a TRIES+=1
call :ma_health_ok
if not errorlevel 1 goto openapp
if %TRIES% GEQ 40 (
    echo [ERROR] Server not ready on port %PORT%.
    pause
    exit /b 1
)
"%TIMEOUT%" /t 1 /nobreak >nul
goto waitloop

:openapp
call :ma_open_browser
endlocal
exit /b 0

:ma_health_ok
if not exist "%CURL%" exit /b 1
"%CURL%" -s -m 2 "%APPURL%api/health" 2>nul | "%FINDSTR%" /C:"meeting-assistant" >nul
exit /b %errorlevel%

:ma_open_browser
set "EDGE_X86=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE_PF=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "EDGE_LOCAL=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
set "CHROME_PF=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME_X86=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if "%LAUNCH_MODE%"=="desktop" goto ma_desktop
goto ma_window

:ma_desktop
if exist "%EDGE_X86%" (
    echo Opening desktop app mode via Edge...
    start "" "%EDGE_X86%" --app=%APPURL% --window-size=1420,920
    goto :eof
)
if exist "%EDGE_PF%" (
    start "" "%EDGE_PF%" --app=%APPURL% --window-size=1420,920
    goto :eof
)
if exist "%EDGE_LOCAL%" (
    start "" "%EDGE_LOCAL%" --app=%APPURL% --window-size=1420,920
    goto :eof
)
if exist "%CHROME_PF%" (
    start "" "%CHROME_PF%" --app=%APPURL% --window-size=1420,920
    goto :eof
)
if exist "%CHROME_X86%" (
    start "" "%CHROME_X86%" --app=%APPURL% --window-size=1420,920
    goto :eof
)
start "" "%APPURL%"
goto :eof

:ma_window
if exist "%EDGE_X86%" (
    echo Opening Meeting Assistant in Edge...
    start "" "%EDGE_X86%" --new-window --window-size=1420,920 "%APPURL%"
    goto :eof
)
if exist "%EDGE_PF%" (
    start "" "%EDGE_PF%" --new-window --window-size=1420,920 "%APPURL%"
    goto :eof
)
if exist "%EDGE_LOCAL%" (
    start "" "%EDGE_LOCAL%" --new-window --window-size=1420,920 "%APPURL%"
    goto :eof
)
start "" "%APPURL%"
goto :eof
