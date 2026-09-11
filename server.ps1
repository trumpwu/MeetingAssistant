$port = 8088
$prefix = "http://localhost:$port/"
$root = "D:\project\MeetingAssistant"
$meetingsDir = "D:\project\Meetings"
$tempDir = "D:\project\temp_transcribe"
$desktop = [System.Environment]::GetFolderPath('Desktop')

if (-not (Test-Path $meetingsDir)) { New-Item -ItemType Directory -Path $meetingsDir -Force | Out-Null }
if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }

$ffmpeg = "D:\project\MeetingAssistant\ffmpeg.exe"
if (-not (Test-Path $ffmpeg)) { $ffmpeg = "D:\project\MeetingAI_Package\Meetily\ffmpeg.exe" }
$whisperCli = "D:\project\whisper.cpp\Release\whisper-cli.exe"
$whisperModel = "D:\project\models\ggml-base.bin"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Meeting Assistant Server running at $prefix"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq "/" -or [string]::IsNullOrWhiteSpace($path)) {
            $path = "/index.html"
        }

        # 1. API: Real-Time Translation (English -> Traditional Chinese via Qwen 2.5)
        if ($path -eq "/api/translate" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $json = ConvertFrom-Json $body
                $textToTrans = $json.text

                if ($textToTrans) {
                    $llamaReq = [System.Net.WebRequest]::Create("http://127.0.0.1:8080/v1/chat/completions")
                    $llamaReq.Method = "POST"
                    $llamaReq.ContentType = "application/json; charset=utf-8"
                    $llamaReq.Timeout = 10000

                    $reqData = @{
                        model = "qwen2.5-1.5b-instruct"
                        messages = @(
                            @{ role = "system"; content = "你是專業即時同聲傳譯員，請將英文直接翻譯成流暢的繁體中文，僅輸出翻譯結果：" },
                            @{ role = "user"; content = $textToTrans }
                        )
                        temperature = 0.1
                        max_tokens = 256
                    } | ConvertTo-Json -Depth 5

                    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($reqData)
                    $reqStream = $llamaReq.GetRequestStream()
                    $reqStream.Write($bodyBytes, 0, $bodyBytes.Length)
                    $reqStream.Close()

                    $llamaRes = $llamaReq.GetResponse()
                    $resStream = $llamaRes.GetResponseStream()
                    $resReader = New-Object System.IO.StreamReader($resStream, [System.Text.Encoding]::UTF8)
                    $llamaJson = $resReader.ReadToEnd()
                    $resReader.Close()
                    $llamaRes.Close()

                    $parsed = ConvertFrom-Json $llamaJson
                    $transText = $parsed.choices[0].message.content.Trim()
                    $resJson = @{ success = $true; translated = $transText } | ConvertTo-Json
                } else {
                    $resJson = @{ success = $false; translated = "" } | ConvertTo-Json
                }
            } catch {
                $resJson = @{ success = $false; error = $_.Exception.Message; translated = $textToTrans } | ConvertTo-Json
            }

            $bytes = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # 2. API: AI Summarize via local Qwen 2.5
        if ($path -eq "/api/ai-summarize" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                
                $llamaReq = [System.Net.WebRequest]::Create("http://127.0.0.1:8080/v1/chat/completions")
                $llamaReq.Method = "POST"
                $llamaReq.ContentType = "application/json; charset=utf-8"
                $llamaReq.Timeout = 120000
                
                $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
                $reqStream = $llamaReq.GetRequestStream()
                $reqStream.Write($bodyBytes, 0, $bodyBytes.Length)
                $reqStream.Close()

                $llamaRes = $llamaReq.GetResponse()
                $resStream = $llamaRes.GetResponseStream()
                $resReader = New-Object System.IO.StreamReader($resStream, [System.Text.Encoding]::UTF8)
                $resBody = $resReader.ReadToEnd()
                $resReader.Close()
                $llamaRes.Close()

                $bytes = [System.Text.Encoding]::UTF8.GetBytes($resBody)
                $response.ContentType = "application/json; charset=utf-8"
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $errMsg = @{ error = $_.Exception.Message } | ConvertTo-Json
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errMsg)
                $response.ContentType = "application/json; charset=utf-8"
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
            $response.Close()
            continue
        }

        # 3. API: Transcribe Audio/Video File (Drag and Drop)
        if ($path -eq "/api/transcribe-file" -and $request.HttpMethod -eq "POST") {
            try {
                $rawWav = Join-Path $tempDir "uploaded_audio.wav"
                $tempInput = Join-Path $tempDir "input_raw.bin"

                $fs = [System.IO.File]::Create($tempInput)
                $request.InputStream.CopyTo($fs)
                $fs.Close()

                & $ffmpeg -i $tempInput -ar 16000 -ac 1 -c:a pcm_s16le -y $rawWav 2>$null

                $outPrefix = Join-Path $tempDir "uploaded_trans"
                & $whisperCli -m $whisperModel -f $rawWav -otxt -of $outPrefix -t 8 2>$null

                $txtFile = "$outPrefix.txt"
                $rawText = ""
                if (Test-Path $txtFile) {
                    $rawText = [System.IO.File]::ReadAllText($txtFile, [System.Text.Encoding]::UTF8).Trim()
                }

                $finalChinese = ""
                if ($rawText) {
                    $llamaReq = [System.Net.WebRequest]::Create("http://127.0.0.1:8080/v1/chat/completions")
                    $llamaReq.Method = "POST"
                    $llamaReq.ContentType = "application/json; charset=utf-8"
                    $llamaReq.Timeout = 60000

                    $reqData = @{
                        model = "qwen2.5-1.5b-instruct"
                        messages = @(
                            @{ role = "system"; content = "請將以下語音逐字稿全文翻譯為道地流暢的繁體中文逐字稿，保留發言人標籤，僅輸出繁中結果：" },
                            @{ role = "user"; content = $rawText }
                        )
                        temperature = 0.1
                        max_tokens = 3000
                    } | ConvertTo-Json -Depth 5

                    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($reqData)
                    $reqStream = $llamaReq.GetRequestStream()
                    $reqStream.Write($bodyBytes, 0, $bodyBytes.Length)
                    $reqStream.Close()

                    $llamaRes = $llamaReq.GetResponse()
                    $resStream = $llamaRes.GetResponseStream()
                    $resReader = New-Object System.IO.StreamReader($resStream, [System.Text.Encoding]::UTF8)
                    $llamaJson = $resReader.ReadToEnd()
                    $resReader.Close()
                    $llamaRes.Close()

                    $parsed = ConvertFrom-Json $llamaJson
                    $finalChinese = $parsed.choices[0].message.content.Trim()
                }

                if (-not $finalChinese) { $finalChinese = $rawText }
                $resJson = @{ success = $true; transcript = $finalChinese } | ConvertTo-Json
            } catch {
                $resJson = @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
            }

            $bytes = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # 4. API: Auto-Save Minutes & Transcripts
        if ($path -eq "/api/auto-save" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $json = ConvertFrom-Json $body

                $filename = $json.filename
                $content = $json.content
                $type = $json.type
                $customDir = $json.customDir

                if ($filename -and $content) {
                    $ext = if ($type -eq 'markdown') { ".md" } else { ".txt" }
                    $cleanName = [System.IO.Path]::ChangeExtension($filename, $ext)
                    
                    $saveTarget = $meetingsDir
                    if ($customDir -and [System.IO.Directory]::Exists($customDir)) {
                        $saveTarget = $customDir
                    }
                    
                    $projFile = Join-Path $saveTarget $cleanName
                    $deskFile = Join-Path $desktop $cleanName

                    [System.IO.File]::WriteAllText($projFile, $content, [System.Text.Encoding]::UTF8)
                    [System.IO.File]::WriteAllText($deskFile, $content, [System.Text.Encoding]::UTF8)

                    $resJson = @{ success = $true; path = $projFile; desktopPath = $deskFile } | ConvertTo-Json
                } else {
                    $resJson = @{ success = $false; error = "Missing filename or content" } | ConvertTo-Json
                }
            } catch {
                $resJson = @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
            }

            $bytes = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # Static File Serving
        $localPath = Join-Path $root $path.TrimStart('/')
        if (Test-Path $localPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".svg"  { "image/svg+xml" }
                default { "application/octet-stream" }
            }

            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }

        $response.Close()
    } catch {
        # Continue on connection errors
    }
}
