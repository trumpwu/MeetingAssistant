@echo off
setlocal EnableExtensions
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\Wbem;%SystemRoot%\System32\WindowsPowerShell\v1.0;%PATH%"

set "BASE_DIR=C:\project"
if exist "D:\project\MeetingAssistant\server.ts" set "BASE_DIR=D:\project"
cd /d "%BASE_DIR%\MeetingAssistant"

set "PORT=8088"
set "APPURL=http://127.0.0.1:%PORT%/"
set "DENO=%BASE_DIR%\deno.exe"
set "SERVER_TS=%BASE_DIR%\MeetingAssistant\server.ts"
set "NETSTAT=%SystemRoot%\System32\netstat.exe"
set "FINDSTR=%SystemRoot%\System32\findstr.exe"
set "TIMEOUT=%SystemRoot%\System32\timeout.exe"

if not exist "%DENO%" (
    echo [ERROR] Deno not found at %DENO%. Please run install.bat first!
    pause
    exit /b 1
)

"%NETSTAT%" -ano | "%FINDSTR%" ":%PORT%" | "%FINDSTR%" "LISTENING" >nul
if errorlevel 1 (
    echo Starting Meeting Assistant Server on port %PORT%...
    start "Meeting_Assistant_Server" /min "%DENO%" run -A --no-check "%SERVER_TS%"
    "%TIMEOUT%" /t 3 /nobreak >nul
)

set "EDGE_X86=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE_PF=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHROME_PF=%ProgramFiles%\Google\Chrome\Application\chrome.exe"

if exist "%EDGE_X86%" (
    start "" "%EDGE_X86%" --app=%APPURL% --window-size=1420,920
    exit /b 0
)
if exist "%EDGE_PF%" (
    start "" "%EDGE_PF%" --app=%APPURL% --window-size=1420,920
    exit /b 0
)
if exist "%CHROME_PF%" (
    start "" "%CHROME_PF%" --app=%APPURL% --window-size=1420,920
    exit /b 0
)
start "" "%APPURL%"
exit /b 0
