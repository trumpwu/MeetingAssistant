Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 1. 確保背景伺服器運行
serverVbs = "D:\project\MeetingAssistant\Start_MeetingAssistant_Silent.vbs"
WshShell.Run "wscript.exe """ & serverVbs & """", 0, True

WScript.Sleep 300

' 2. 以獨立 App 視窗模式開啟 Edge
edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edgePath) Then
    edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
End If

If fso.FileExists(edgePath) Then
    WshShell.Run """" & edgePath & """ --app=http://localhost:8088/ --window-size=1280,850", 1, False
Else
    WshShell.Run "http://localhost:8088/", 1, False
End If
