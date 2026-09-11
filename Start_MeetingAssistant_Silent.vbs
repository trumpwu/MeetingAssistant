Set WshShell = CreateObject("WScript.Shell")
powershellCmd = "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File ""D:\project\ensure_server.ps1"""
WshShell.Run powershellCmd, 0, True
