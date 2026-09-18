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

        # 2. API: AI Summarize (Map-Reduce Distillation Engine via local Qwen 2.5)
        if ($path -eq "/api/ai-summarize" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $json = ConvertFrom-Json $body
                
                $userMsg = ""
                foreach ($m in $json.messages) {
                    if ($m.role -eq "user") { $userMsg = $m.content; break }
                }

                $marker = "會議逐字稿："
                $mIdx = $userMsg.IndexOf($marker)
                $rawTranscript = if ($mIdx -ge 0) { $userMsg.Substring($mIdx + $marker.Length).Trim() } else { $userMsg }

                # Text De-noiser & Cleaner
                $cleaned = [regex]::Replace($rawTranscript, "(他[說就]|對呀|那個|嗯|啊|這這|我我|你你){2,}", '$1')
                $cleaned = [regex]::Replace($cleaned, "\n{3,}", "`n`n")

                $chunkSize = 3500
                $consolidatedFacts = ""

                if ($cleaned.Length -gt $chunkSize) {
                    $chunks = @()
                    for ($ci = 0; $ci -lt $cleaned.Length; $ci += $chunkSize) {
                        $len = [Math]::Min($chunkSize, $cleaned.Length - $ci)
                        $chunks += $cleaned.Substring($ci, $len)
                    }

                    # Map Phase
                    $extracted = @()
                    for ($idx = 0; $idx -lt $chunks.Count; $idx++) {
                        $mapReq = @{
                            model = "qwen2.5-7b-instruct"
                            messages = @(
                                @{ role = "system"; content = "你是事實提煉特助。請從以下會議片段中客觀提取：1. 討論主題與達成之共識 2. 提及的數據/規格/型號/數值 3. 明確的待辦任務與責任人。只列事實，絕不添加無關人名或數據。" },
                                @{ role = "user"; content = "【會議片段 $($idx + 1)/$($chunks.Count)】：`n$($chunks[$idx])" }
                            )
                            temperature = 0.1
                            max_tokens = 600
                        } | ConvertTo-Json -Depth 5

                        $resMap = Invoke-RestMethod -Uri "http://127.0.0.1:8080/v1/chat/completions" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($mapReq)) -ContentType "application/json; charset=utf-8" -TimeoutSec 60
                        if ($resMap.choices -and $resMap.choices[0].message.content) {
                            $extracted += $resMap.choices[0].message.content.Trim()
                        }
                    }
                    $consolidatedFacts = $extracted -join "`n`n---`n`n"
                } else {
                    $consolidatedFacts = $cleaned
                }

                # Reduce Phase (Global Executive Synthesis)
                $maxFacts = if ($consolidatedFacts.Length -gt 16000) { $consolidatedFacts.Substring(0, 16000) } else { $consolidatedFacts }
                $reducePrompt = @"
你是上市公司執行長特助。請根據以下【各段已提煉之會議事實清單】，直接整理成【1 頁極簡高管精華版】會議紀錄。

【嚴格規則】：
1. 嚴禁重複拷貝相同內容！嚴禁按人名條列重複的樣板句！
2. 嚴禁捏造任何未在會議中提及的無關數據、規格或數值！
3. 所有內容必須 100% 來自以下事實清單！

請直接輸出以下標準格式：
# 📋 [會議主題] - 極簡精華紀錄
> **會議日期**：[日期] | **地點**：[地點] | **出席人員**：[出席人員]

## 🎯 一、30 秒核心決策與共識 (Key Decisions)
（精簡列出最核心的 3~4 點定案事項，每點以【粗體標題】+ 1~2 句話結論呈現）

## 📊 二、關鍵規格與技術參數指標 (Key Metrics)
| 項目 | 核心規格 / 數值 | 實務說明與場域 |
| :--- | :---: | :--- |
（僅列出本次對話中實際提及的 3~4 項核心數值、型號或電流/功率，無則省略）

## ✅ 三、行動追蹤矩陣 (Action Matrix)
| 項次 | 具體待辦事項說明 | 優先級 | 負責人 | 預計完成時程 |
| :---: | :--- | :---: | :---: | :---: |
（僅列出最核心的 3~5 項具體任務，優先級標註 [🔥最高]、[⚡高優先] 或 [📌中優先]）

## ⚠️ 四、重點風險與下一步 (Next Steps)
（1~2 點本次會議提及之實際風險與下步行動）

【會議提煉事實清單】：
$maxFacts
"@

                $finalReq = @{
                    model = "qwen2.5-7b-instruct"
                    messages = @(
                        @{ role = "system"; content = "你是上市公司執行長特助，專門將各段會議事實綜合成 1 頁極簡、精準、事實嚴格接地、具備高度商業價值的決策紀要。嚴禁任何口語廢話與幻覺捏造。" },
                        @{ role = "user"; content = $reducePrompt }
                    )
                    temperature = 0.1
                    max_tokens = 1500
                } | ConvertTo-Json -Depth 5

                $resFinal = Invoke-RestMethod -Uri "http://127.0.0.1:8080/v1/chat/completions" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($finalReq)) -ContentType "application/json; charset=utf-8" -TimeoutSec 90
                $polished = $resFinal.choices[0].message.content

                $retObj = @{
                    choices = @(
                        @{ message = @{ role = "assistant"; content = $polished } }
                    )
                } | ConvertTo-Json -Depth 5

                $bytes = [System.Text.Encoding]::UTF8.GetBytes($retObj)
                $response.ContentType = "application/json; charset=utf-8"
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $errMsg = @{ error = $_.Exception.Message } | ConvertTo-Json
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errMsg)
                $response.ContentType = "application/json; charset=utf-8"
                $response.StatusCode = 500
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
