// Deno High-Performance Server for Meeting Assistant (Port 8088)
const port = 8088;
const root = "D:\\project\\MeetingAssistant";
const meetingsDir = "D:\\project\\Meetings";
const tempDir = "D:\\project\\temp_transcribe";
const desktopDir = "C:\\Users\\Innovare\\Desktop";
const whisperCli = "D:\\project\\whisper.cpp\\Release\\whisper-cli.exe";
const whisperModel = "D:\\project\\models\\ggml-base.bin";
const ffmpeg = "D:\\project\\MeetingAssistant\\ffmpeg.exe";

try { Deno.mkdirSync(meetingsDir, { recursive: true }); } catch (_) {}
try { Deno.mkdirSync(tempDir, { recursive: true }); } catch (_) {}

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

console.log(`Meeting Assistant Server running on http://127.0.0.1:${port}/ ...`);

Deno.serve({ hostname: "127.0.0.1", port }, async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

  // 1. API: /api/transcribe-file (Transcribes M4A, MP3, WAV, WebM, AAC, MP4, FLAC)
  if (pathname === "/api/transcribe-file" && req.method === "POST") {
    try {
      const rawFilename = decodeURIComponent(req.headers.get("X-Filename") || "uploaded_audio.mp3");
      const dotIndex = rawFilename.lastIndexOf(".");
      const ext = dotIndex !== -1 ? rawFilename.substring(dotIndex).toLowerCase() : ".mp3";
      
      const buffer = new Uint8Array(await req.arrayBuffer());
      const ts = Date.now();
      const inputPath = `${tempDir}\\upload_${ts}${ext}`;
      const wavPath = `${tempDir}\\upload_${ts}.wav`;
      const outPrefix = `${tempDir}\\upload_${ts}`;
      const txtPath = `${outPrefix}.txt`;

      Deno.writeFileSync(inputPath, buffer);

      // 1. Convert to 16kHz 16-bit Mono WAV via ffmpeg
      const ffmpegCmd = new Deno.Command(ffmpeg, {
        args: ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath]
      });
      const ffOut = await ffmpegCmd.output();
      if (ffOut.code !== 0) {
        console.warn("FFmpeg transcode notice:", new TextDecoder().decode(ffOut.stderr));
      }

      // 2. Transcribe via Whisper (Multi-threaded AVX2 Acceleration)
      const whisper = new Deno.Command(whisperCli, {
        args: ["-m", whisperModel, "-l", "zh", "-t", "10", "-bs", "1", "-bo", "1", "-f", wavPath, "-otxt", "-of", outPrefix]
      });
      await whisper.output();

      let transcript = "";
      try {
        transcript = Deno.readTextFileSync(txtPath).trim();
      } catch (_) {
        transcript = "";
      }

      // Cleanup
      try { Deno.removeSync(inputPath); } catch (_) {}
      try { Deno.removeSync(wavPath); } catch (_) {}
      try { Deno.removeSync(txtPath); } catch (_) {}

      if (!transcript) {
        return Response.json({ success: false, error: "音訊轉錄結果為空，請確認檔案是否有清晰人聲。" });
      }

      return Response.json({ success: true, transcript, filename: rawFilename });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 2. API: /api/translate (English to Traditional Chinese)
  if (pathname === "/api/translate" && req.method === "POST") {
    try {
      const { text } = await req.json();
      if (!text) return Response.json({ success: false, translated: "" });

      const llamaRes = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5-7b-instruct",
          messages: [
            { role: "system", content: "你是專業即時同聲傳譯員，請將英文句子直接翻譯成流暢的繁體中文，僅輸出繁中結果：" },
            { role: "user", content: text }
          ],
          temperature: 0.1,
          max_tokens: 256
        })
      });
      const data = await llamaRes.json();
      const translated = data?.choices?.[0]?.message?.content?.trim() || text;
      return Response.json({ success: true, translated });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 2. API: /api/ai-summarize (Industry Standard Map-Reduce Distillation Engine)
  if (pathname === "/api/ai-summarize" && req.method === "POST") {
    try {
      const rawReq = await req.json();
      const messages = rawReq.messages || [];
      const userPrompt = messages.find((m: any) => m.role === "user")?.content || "";

      const transcriptMarker = "會議逐字稿：";
      const markerIdx = userPrompt.indexOf(transcriptMarker);
      const rawTranscript = markerIdx !== -1 ? userPrompt.substring(markerIdx + transcriptMarker.length).trim() : userPrompt;

      // Step 1: Text De-noiser & Cleaner
      const cleanedTranscript = rawTranscript
        .replace(/(他[說就]|對呀|那個|嗯|啊|這這|我我|你你){2,}/g, "$1")
        .replace(/\n{3,}/g, "\n\n");

      // Step 2: Map-Reduce Chunking
      const CHUNK_SIZE = 3500;
      let consolidatedFacts = "";

      if (cleanedTranscript.length > CHUNK_SIZE) {
        const chunks: string[] = [];
        for (let i = 0; i < cleanedTranscript.length; i += CHUNK_SIZE) {
          chunks.push(cleanedTranscript.substring(i, i + CHUNK_SIZE));
        }

        // Map Phase: Extract factual key points per segment
        const extractedSegments: string[] = [];
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];
          const mapRes = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "qwen2.5-7b-instruct",
              messages: [
                {
                  role: "system",
                  content: "你是事實提煉特助。請從以下會議片段中客觀提取：1. 討論主題與達成之共識 2. 提及的數據/規格/型號/數值 3. 明確的待辦任務與責任人。只列事實，絕不添加無關人名或數據。"
                },
                { role: "user", content: `【會議片段 ${idx + 1}/${chunks.length}】：\n${chunk}` }
              ],
              temperature: 0.1,
              max_tokens: 600
            })
          });
          const mapData = await mapRes.json();
          const factText = mapData?.choices?.[0]?.message?.content?.trim();
          if (factText) extractedSegments.push(factText);
        }
        consolidatedFacts = extractedSegments.join("\n\n---\n\n");
      } else {
        consolidatedFacts = cleanedTranscript;
      }

      // Step 3: Reduce Phase (Global Executive Synthesis)
      const reducePrompt = `你是上市公司執行長特助。請根據以下【各段已提煉之會議事實清單】，直接整理成【1 頁極簡高管精華版】會議紀錄。

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
${consolidatedFacts.slice(0, 16000)}`;

      const finalRes = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5-7b-instruct",
          messages: [
            {
              role: "system",
              content: "你是上市公司執行長特助，專門將各段會議事實綜合成 1 頁極簡、精準、事實嚴格接地、具備高度商業價值的決策紀要。嚴禁任何口語廢話與幻覺捏造。"
            },
            { role: "user", content: reducePrompt }
          ],
          temperature: 0.1,
          max_tokens: 1500
        })
      });

      const finalData = await finalRes.json();
      const polishedText = finalData?.choices?.[0]?.message?.content || "";

      return Response.json({
        choices: [
          {
            message: {
              role: "assistant",
              content: polishedText
            }
          }
        ]
      });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 });
    }
  }

  // 3. API: /api/list-meetings (Scans Meetings and Desktop)
  if (pathname === "/api/list-meetings" && req.method === "GET") {
    try {
      const list: Array<{ name: string; path: string; size: number; mtime: string }> = [];
      const seen = new Set<string>();

      function scan(dir: string) {
        try {
          for (const f of Deno.readDirSync(dir)) {
            if (f.isFile && f.name.endsWith(".md")) {
              const full = `${dir}\\${f.name}`;
              if (!seen.has(f.name)) {
                seen.add(f.name);
                const stat = Deno.statSync(full);
                list.push({
                  name: f.name,
                  path: full,
                  size: stat.size,
                  mtime: stat.mtime ? stat.mtime.toISOString() : new Date().toISOString()
                });
              }
            }
          }
        } catch (_) {}
      }

      scan(meetingsDir);
      scan(desktopDir);

      list.sort((a, b) => b.name.localeCompare(a.name));
      return Response.json({ success: true, files: list });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 4. API: /api/read-meeting
  if (pathname === "/api/read-meeting" && req.method === "POST") {
    try {
      const { path } = await req.json();
      if (!path) return Response.json({ success: false, error: "Missing path" });
      const content = Deno.readTextFileSync(path);
      return Response.json({ success: true, content });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 5. API: /api/chat-with-meeting (Q&A with current meeting file via Qwen 2.5 7B)
  if (pathname === "/api/chat-with-meeting" && req.method === "POST") {
    try {
      const { docContent, question } = await req.json();
      if (!docContent || !question) {
        return Response.json({ success: false, error: "Missing docContent or question" });
      }

      const llamaRes = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5-7b-instruct",
          messages: [
            {
              role: "system",
              content: "你是由 Google DeepMind 團隊設計的高階 AI 會議特助 Antigravity。請根據使用者提供的會議紀錄內容，使用專業、精準、結構化的繁體中文回答使用者的問題。若會議內容未提及，請如實告知。"
            },
            {
              role: "user",
              content: `【會議紀錄內容】：\n${docContent.slice(0, 20000)}\n\n【使用者問題】：\n${question}`
            }
          ],
          temperature: 0.3,
          presence_penalty: 0.5,
          frequency_penalty: 0.5,
          max_tokens: 2048
        })
      });
      const data = await llamaRes.json();
      const answer = data?.choices?.[0]?.message?.content?.trim() || "抱歉，無法取得回答。";
      return Response.json({ success: true, answer });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 6. API: /api/delete-meeting (Deletes from Meetings & Desktop)
  if (pathname === "/api/delete-meeting" && req.method === "POST") {
    try {
      const { path } = await req.json();
      if (!path) return Response.json({ success: false, error: "Missing path" });

      const filename = path.substring(path.lastIndexOf("\\") + 1);
      const projPath = `${meetingsDir}\\${filename}`;
      const deskPath = `${desktopDir}\\${filename}`;
      const docProjPath = projPath.replace(/\.md$/, ".doc");
      const docDeskPath = deskPath.replace(/\.md$/, ".doc");

      try { Deno.removeSync(path); } catch (_) {}
      try { Deno.removeSync(projPath); } catch (_) {}
      try { Deno.removeSync(deskPath); } catch (_) {}
      try { Deno.removeSync(docProjPath); } catch (_) {}
      try { Deno.removeSync(docDeskPath); } catch (_) {}

      return Response.json({ success: true, message: `已成功刪除會議檔案：${filename}` });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 7. API: /api/import-meeting (Imports an external .md or .txt file)
  if (pathname === "/api/import-meeting" && req.method === "POST") {
    try {
      const { filename, content } = await req.json();
      if (!filename || !content) {
        return Response.json({ success: false, error: "Missing filename or content" });
      }

      const cleanName = filename.endsWith(".md") ? filename : `${filename.replace(/\.[^/.]+$/, "")}.md`;
      const projPath = `${meetingsDir}\\${cleanName}`;
      const deskPath = `${desktopDir}\\${cleanName}`;

      Deno.writeTextFileSync(projPath, content);
      try { Deno.writeTextFileSync(deskPath, content); } catch (_) {}

      return Response.json({ success: true, path: projPath, filename: cleanName });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 6. API: /api/save-audio (Automatically saves recorded audio blob)
  if (pathname === "/api/save-audio" && req.method === "POST") {
    try {
      const filename = req.headers.get("X-Filename") || `Recording_${Date.now()}.webm`;
      const cleanName = filename.endsWith(".webm") ? filename : `${filename}.webm`;
      const rawBytes = new Uint8Array(await req.arrayBuffer());

      const projPath = `${meetingsDir}\\${cleanName}`;
      const deskPath = `${desktopDir}\\${cleanName}`;

      Deno.writeFileSync(projPath, rawBytes);
      try { Deno.writeFileSync(deskPath, rawBytes); } catch (_) {}

      return Response.json({ success: true, path: projPath });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 8. API: /api/get-memory (Retrieve learned company context & entities)
  if (pathname === "/api/get-memory" && req.method === "GET") {
    try {
      const memoryPath = `${root}\\data\\company_memory.json`;
      if (Deno.statSync(memoryPath)) {
        const text = Deno.readTextFileSync(memoryPath);
        return new Response(text, { headers: { "Content-Type": "application/json" } });
      }
      return Response.json({ success: true, learned_rules: [], enterprise_entities: {} });
    } catch (_) {
      return Response.json({ success: true, learned_rules: [], enterprise_entities: {} });
    }
  }

  // 9. API: /api/feedback (Record positive feedback & dynamically learn new entities)
  if (pathname === "/api/feedback" && req.method === "POST") {
    try {
      const { type, topic, rawTranscript, editedContent } = await req.json();
      const datasetPath = `${root}\\data\\preference_dataset.jsonl`;
      const memoryPath = `${root}\\data\\company_memory.json`;

      const record = JSON.stringify({
        timestamp: new Date().toISOString(),
        type: type || "thumbs_up",
        topic: topic || "一般會議",
        input_transcript: rawTranscript || "",
        chosen_output: editedContent || ""
      }) + "\n";

      try {
        const file = Deno.openSync(datasetPath, { create: true, append: true, write: true });
        file.writeSync(new TextEncoder().encode(record));
        file.close();
      } catch (_) {}

      // Asynchronously extract and merge new entities into company_memory.json via Qwen 2.5 7B
      if (editedContent && editedContent.length > 50) {
        (async () => {
          try {
            const extractPrompt = `請從以下會議紀錄中，提煉出該企業的核心人名、專用設備型號、系統名稱與重要數據指標，以 JSON 格式輸出：{"personnel":[], "equipment_models":[], "systems_partners":[], "subsidies_metrics":[]}\n\n會議內容：\n${editedContent.slice(0, 4000)}`;
            const llamaRes = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "qwen2.5-7b-instruct",
                messages: [
                  { role: "system", content: "你是一個專業的實體識別與知識圖譜建構專家，請僅輸出乾淨的 JSON 物件。" },
                  { role: "user", content: extractPrompt }
                ],
                temperature: 0.1,
                max_tokens: 600
              })
            });
            const data = await llamaRes.json();
            const rawJson = data?.choices?.[0]?.message?.content?.trim();
            const cleanJsonMatch = rawJson.match(/\{[\s\S]*\}/);
            if (cleanJsonMatch) {
              const newEntities = JSON.parse(cleanJsonMatch[0]);
              let currentMem = { learned_rules: [], enterprise_entities: {} };
              try { currentMem = JSON.parse(Deno.readTextFileSync(memoryPath)); } catch (_) {}
              
              const ent = currentMem.enterprise_entities || {};
              for (const [k, arr] of Object.entries(newEntities)) {
                if (Array.isArray(arr)) {
                  ent[k] = Array.from(new Set([...(ent[k] || []), ...arr]));
                }
              }
              currentMem.enterprise_entities = ent;
              currentMem.last_updated = new Date().toISOString();
              Deno.writeTextFileSync(memoryPath, JSON.stringify(currentMem, null, 2));
              console.log("Enterprise memory automatically reinforced and updated!");
            }
          } catch (e) {
            console.warn("Auto-learning extraction notice:", e);
          }
        })();
      }

      return Response.json({ success: true, message: "已納入地端 AI 強化學習與企業記憶庫！" });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 10. API: /api/auto-save
  if (pathname === "/api/auto-save" && req.method === "POST") {
    try {
      const { filename, content, type, customDir } = await req.json();
      if (!filename || !content) return Response.json({ success: false, error: "Missing data" });

      const ext = type === "markdown" ? ".md" : ".txt";
      const cleanName = filename.endsWith(ext) ? filename : `${filename}${ext}`;

      let targetDir = meetingsDir;
      if (customDir) {
        try {
          if (Deno.statSync(customDir).isDirectory) targetDir = customDir;
        } catch (_) {}
      }

      const projPath = `${targetDir}\\${cleanName}`;
      const deskPath = `${desktopDir}\\${cleanName}`;

      Deno.writeTextFileSync(projPath, content);
      try { Deno.writeTextFileSync(deskPath, content); } catch (_) {}

      return Response.json({ success: true, path: projPath, desktopPath: deskPath });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // Static File Serving
  try {
    const filePath = `${root}${pathname.replace(/\//g, "\\")}`;
    const fileBytes = Deno.readFileSync(filePath);
    const ext = pathname.substring(pathname.lastIndexOf(".")).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new Response(fileBytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
  } catch (_) {
    return new Response("404 Not Found", { status: 404 });
  }
});
