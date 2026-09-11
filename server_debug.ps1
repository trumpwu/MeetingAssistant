$logFile = "D:\project\server_debug.log"
"Starting server at $(Get-Date)" | Out-File $logFile

try {
    $port = 8088
    $prefix = "http://localhost:$port/"
    $root = "D:\project\MeetingAssistant"

    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
    "Listener started on $prefix at $(Get-Date)" | Out-File $logFile -Append

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq "/" -or [string]::IsNullOrWhiteSpace($path)) {
            $path = "/index.html"
        }

        $localPath = Join-Path $root ($path.TrimStart('/'))
        if (Test-Path $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            if ($localPath.EndsWith(".html")) { $response.ContentType = "text/html; charset=utf-8" }
            elseif ($localPath.EndsWith(".css")) { $response.ContentType = "text/css; charset=utf-8" }
            elseif ($localPath.EndsWith(".js")) { $response.ContentType = "application/javascript; charset=utf-8" }
            elseif ($localPath.EndsWith(".json")) { $response.ContentType = "application/json; charset=utf-8" }
            else { $response.ContentType = "application/octet-stream" }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
        }
        $response.OutputStream.Close()
    }
} catch {
    "FATAL ERROR at $(Get-Date): $($_.Exception.ToString())" | Out-File $logFile -Append
}
