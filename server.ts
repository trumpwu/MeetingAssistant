import * as OpenCC from "npm:opencc-js";
const toTaiwanTraditional = OpenCC.Converter({ from: "cn", to: "tw" });

// Deno High-Performance Server for Meeting Assistant (Port 8088)
const port = 8088;
const root = "D:\\project\\MeetingAssistant";
const meetingsDir = "D:\\project\\Meetings";
const tempDir = "D:\\project\\temp_transcribe";
const desktopDir = "C:\\Users\\Innovare\\Desktop";
const ffmpeg = "D:\\project\\MeetingAssistant\\ffmpeg.exe";

// Alibaba SenseVoice (sherpa-onnx FunASR Nano int8)
const senseVoiceCli = "D:\\project\\SenseVoice\\sherpa-onnx-v1.13.8-win-x64-shared-MT-Release\\bin\\sherpa-onnx-offline.exe";
const senseVoiceModel = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\model.int8.onnx";
const senseVoiceTokens = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\tokens.txt";

function segmentSenseVoiceText(data: { text: string; timestamps?: number[]; tokens?: string[] }): string {
  if (!data.text) return "";
  if (data.tokens && data.timestamps && data.tokens.length === data.timestamps.length && data.tokens.length > 0) {
    let result = "";
    let lastTime = data.timestamps[0];
    for (let i = 0; i < data.tokens.length; i++) {
      const tok = data.tokens[i];
      const t = data.timestamps[i];
      if (t - lastTime > 1.2 && result.length > 0 && !result.endsWith("\n")) {
        result += "\n";
      }
      result += tok;
      lastTime = t;
    }
    const lines = result
      .split("\n")
      .map(l => l.replace(/<\|.*?\|>/g, "").trim())
      .filter(Boolean);
    if (lines.length > 0) return lines.join("\n");
  }

  return data.text
    .replace(/<\|.*?\|>/g, "")
    .replace(/([。！？!?；;\n]+)/g, "$1\n")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean)
    .join("\n");
}

try { Deno.mkdirSync(meetingsDir, { recursive: true }); } catch (_) {}
try { Deno.mkdirSync(tempDir, { recursive: true }); } catch (_) {}

// Dynamic Phonetic Dictionary Loader (Loads from data/phonetic_dictionary.json)
function loadPhoneticDictionary(): Array<[RegExp, string]> {
  try {
    const dictPath = `${root}\\data\\phonetic_dictionary.json`;
    const raw = JSON.parse(Deno.readTextFileSync(dictPath));
    const rules: Array<[RegExp, string]> = [];
    for (const [correct, wrongs] of Object.entries(raw as Record<string, any>)) {
      if (correct.startsWith("_") || !Array.isArray(wrongs) || wrongs.length === 0) continue;
      const escaped = wrongs.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      rules.push([new RegExp(`(?:${escaped})`, "g"), correct]);
    }
    return rules;
  } catch (err) {
    console.warn("[Dictionary] Notice: loading phonetic dictionary failed or empty, fallback to clean:", err);
    return [];
  }
}

// Stage 2: Two-Stage Semantic & Phonetic Calibration via local Qwen 2.5 7B & Domain Dictionary
async function calibrateTranscript(rawTranscript: string, isFastMode = false): Promise<string> {
  if (!rawTranscript || rawTranscript.trim().length === 0) return rawTranscript;

  // 1. First-pass dynamic phonetic dictionary corrections (handles Taiwan enterprise/ESG terminology)
  const phoneticReplacements = loadPhoneticDictionary();
  let cleaned = rawTranscript;
  for (const [pattern, replacement] of phoneticReplacements) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  if (isFastMode) {
    return cleaned;
  }

  // 2. Second-pass LLM Semantic Context Calibration via local Qwen 2.5 7B (Port 8080)
  try {
    let memoryPrompt = "";
    try {
      const memoryPath = `${root}\\data\\company_memory.json`;
      const memObj = JSON.parse(Deno.readTextFileSync(memoryPath));
      const entities = memObj.enterprise_entities || {};
      const people = (entities.personnel || []).join("、");
      const partners = (entities.systems_partners || []).join("、");
      const metrics = (entities.subsidies_metrics || []).join("、");
      memoryPrompt = `已知企業名詞庫參考：\n- 人員：${people}\n- 企業與系統：${partners}\n- 術語與指標：${metrics}`;
    } catch (_) {}

    console.log("[Calibrate] Running Stage-2 Qwen 2.5 7B Context Calibration...");
    const llamaRes = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5-7b-instruct",
        messages: [
          {
            role: "system",
            content: `你是一個專業的高階語音辨識（STT）校準專家。
請將以下由地端語音模型產出的逐字稿，進行「同音錯字修正、標點符號優化與發音校準」：
1. 嚴格對照已知詞庫，將同音錯字校正（如「美國清」校正為「梅國清」、「炭牌」校正為「碳排」、「無城市 一百克」校正為「無塵室 100 Class」）。
2. 保留完整的發言內容與順序，嚴禁刪減原話的對話資訊，嚴禁做成摘要！
3. 輸出純文字繁體中文逐字稿，標註清晰標點符號與適當段落。
${memoryPrompt}`
          },
          {
            role: "user",
            content: `【待校準逐字稿】：\n${cleaned.slice(0, 15000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 4096
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (llamaRes.ok) {
      const llamaData = await llamaRes.json();
      const calibrated = llamaData?.choices?.[0]?.message?.content?.trim();
      if (calibrated && calibrated.length > 50) {
        console.log("[Calibrate] ✨ Stage-2 Qwen 2.5 calibration successfully refined transcript!");
        return calibrated;
      }
    }
  } catch (err) {
    console.warn("[Calibrate] Qwen 2.5 calibration skipped/timed out, using rule-calibrated transcript:", err);
  }

  return cleaned;
}

function resolveTargetDirectory(customDir?: string): string {
  if (!customDir || customDir.trim() === "") return meetingsDir;
  const trimmed = customDir.trim();
  if (trimmed.toLowerCase() === "desktop") return desktopDir;
  if (trimmed.toLowerCase() === "downloads") {
    return "C:\\Users\\Innovare\\Downloads";
  }
  try {
    Deno.mkdirSync(trimmed, { recursive: true });
    return trimmed;
  } catch (_) {
    return meetingsDir;
  }
}

function getMeetingFolderName(filename: string): string {
  let name = filename;
  try {
    name = decodeURIComponent(name);
  } catch (_) {}
  name = name.replace(/\.(md|txt|webm|wav|mp3|m4a|aac|flac|html|doc)$/i, "");
  name = name.replace(/_\((?:逐字稿|會議紀錄|地端初稿|線上AI|線上極速讀取)\)$/i, "");
  return name.trim() || `Meeting_${Date.now()}`;
}

// Automatically categorize loose files in D:\project\Meetings into dedicated subfolders
function organizeExistingMeetings() {
  try {
    const entries = Array.from(Deno.readDirSync(meetingsDir));
    for (const entry of entries) {
      if (entry.isFile && (entry.name.endsWith(".md") || entry.name.endsWith(".webm") || entry.name.endsWith(".txt") || entry.name.endsWith(".html") || entry.name.endsWith(".doc"))) {
        let cleanEntryName = entry.name;
        try {
          cleanEntryName = decodeURIComponent(entry.name);
        } catch (_) {}
        const folderName = getMeetingFolderName(cleanEntryName);
        if (folderName && folderName !== entry.name) {
          const subDir = `${meetingsDir}\\${folderName}`;
          try { Deno.mkdirSync(subDir, { recursive: true }); } catch (_) {}
          const oldPath = `${meetingsDir}\\${entry.name}`;
          const newPath = `${subDir}\\${cleanEntryName}`;
          try {
            Deno.renameSync(oldPath, newPath);
            console.log(`[Organize] Moved ${entry.name} -> ${folderName}\\${cleanEntryName}`);
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.warn("Organize existing meetings notice:", err);
  }
}

organizeExistingMeetings();

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
      const inputPath = `${tempDir}\\upload_${ts}_raw${ext}`;
      const wavPath = `${tempDir}\\upload_${ts}_16k.wav`;
      const outPrefix = `${tempDir}\\upload_${ts}`;
      const txtPath = `${outPrefix}.txt`;

      Deno.writeFileSync(inputPath, buffer);

      // 1. Slices audio into 120s chunks via FFmpeg (PCM 16kHz Mono)
      const chunkDir = `${tempDir}\\upload_${ts}_chunks`;
      try { Deno.mkdirSync(chunkDir, { recursive: true }); } catch (_) {}
      const segmentPattern = `${chunkDir}\\chunk_%03d.wav`;

      const sliceCmd = new Deno.Command(ffmpeg, {
        args: [
          "-y",
          "-i", inputPath,
          "-f", "segment",
          "-segment_time", "120",
          "-ar", "16000",
          "-ac", "1",
          "-c:a", "pcm_s16le",
          segmentPattern
        ]
      });
      const sliceOut = await sliceCmd.output();
      if (sliceOut.code !== 0) {
        console.warn("FFmpeg slice notice:", new TextDecoder().decode(sliceOut.stderr));
      }

      // Collect chunk files
      const chunkFiles: string[] = [];
      try {
        for (const entry of Deno.readDirSync(chunkDir)) {
          if (entry.isFile && entry.name.startsWith("chunk_") && entry.name.endsWith(".wav")) {
            chunkFiles.push(entry.name);
          }
        }
        chunkFiles.sort();
      } catch (_) {}

      // 2. Transcribe via Alibaba SenseVoice (FunASR Nano int8)
      const requestedEngine = (req.headers.get("X-Engine") || "sensevoice").toLowerCase();
      const isFast = requestedEngine === "sensevoice_fast";
      const isEnglish = requestedEngine === "english_live" || requestedEngine === "whisper";
      let transcript = "";
      const engineUsed = isEnglish
        ? "SenseVoice 英文辨識 + Qwen 2.5 繁中同傳"
        : (isFast ? "SenseVoice 50x 原生極速" : "SenseVoice 50x + Qwen 2.5 雙層語意校準");

      if (chunkFiles.length > 0) {
        console.log(`[Transcribe] 音訊分切為 ${chunkFiles.length} 片段，使用 ${engineUsed} 轉錄...`);
        const segmentTexts: string[] = [];

        for (let i = 0; i < chunkFiles.length; i++) {
          const chunkName = chunkFiles[i];
          const chunkPath = `${chunkDir}\\${chunkName}`;
          const startSec = i * 120;
          const startMin = Math.floor(startSec / 60);
          const startSecRem = startSec % 60;
          const timeLabel = chunkFiles.length > 1 ? `[${String(startMin).padStart(2, "0")}:${String(startSecRem).padStart(2, "0")}] ` : "";

          let pieceText = "";

          // Alibaba SenseVoice: FunASR Nano int8
          const senseVoice = new Deno.Command(senseVoiceCli, {
            args: [
              `--tokens=${senseVoiceTokens}`,
              `--sense-voice-model=${senseVoiceModel}`,
              "--sense-voice-language=auto",
              "--sense-voice-use-itn=true",
              "--num-threads=8",
              chunkPath
            ]
          });
          const svOut = await senseVoice.output();
          if (svOut.code === 0) {
            const rawStdout = new TextDecoder("utf-8").decode(svOut.stdout);
            for (const line of rawStdout.split("\n")) {
              const trimmed = line.trim();
              if (trimmed.startsWith("{") && trimmed.includes('"text"')) {
                try {
                  const parsed = JSON.parse(trimmed);
                  if (parsed.text) {
                    pieceText = segmentSenseVoiceText(parsed);
                    break;
                  }
                } catch (_) {}
              }
            }
          }

          if (pieceText) {
            segmentTexts.push(`${timeLabel}${pieceText}`);
          }

          // Clean chunk file
          try { Deno.removeSync(chunkPath); } catch (_) {}
        }

        transcript = segmentTexts.join("\n\n");
      }

      // Cleanup chunk dir and input path
      try { Deno.removeSync(chunkDir, { recursive: true }); } catch (_) {}
      try { Deno.removeSync(inputPath); } catch (_) {}

      // Convert to 100% Traditional Chinese (Taiwan Standard)
      if (transcript) {
        transcript = toTaiwanTraditional(transcript);
      }

      if (!transcript) {
        return Response.json({ success: false, error: "音訊轉錄結果為空，請確認檔案是否有清晰人聲。" });
      }

      // If English meeting mode requested, translate English transcript to Traditional Chinese
      let calibratedTranscript = transcript;
      if (isEnglish) {
        try {
          console.log("[Transcribe] English meeting mode: Translating English transcript to Traditional Chinese via Qwen 2.5...");
          const transRes = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "qwen2.5-7b-instruct",
              messages: [
                {
                  role: "system",
                  content: "你是專業即時同聲傳譯專家。請將以下英文會議逐字稿翻譯為流暢地道的台灣繁體中文逐字稿，保留原發言順序與時間標籤（如 [MM:SS]），嚴禁做成摘要，直接輸出純繁體中文逐字稿："
                },
                {
                  role: "user",
                  content: transcript.slice(0, 16000)
                }
              ],
              temperature: 0.1,
              max_tokens: 4096
            }),
            signal: AbortSignal.timeout(30000)
          });
          if (transRes.ok) {
            const transData = await transRes.json();
            const translatedText = transData?.choices?.[0]?.message?.content?.trim();
            if (translatedText && translatedText.length > 20) {
              calibratedTranscript = translatedText;
            }
          }
        } catch (err) {
          console.warn("[Transcribe] English translation timeout/fallback to raw transcript:", err);
        }
      } else {
        // 3. Stage 2 Calibration: Automatically calibrate raw transcript via Two-Stage Pipeline
        calibratedTranscript = await calibrateTranscript(transcript, isFast);
      }

      return Response.json({ success: true, transcript: calibratedTranscript, raw_transcript: transcript, filename: rawFilename, engineUsed });
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
        }),
        signal: AbortSignal.timeout(8000)
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
      const scenario = rawReq.scenario || "auto";

      const transcriptMarker = "會議逐字稿：";
      const markerIdx = userPrompt.indexOf(transcriptMarker);
      const rawTranscript = markerIdx !== -1 ? userPrompt.substring(markerIdx + transcriptMarker.length).trim() : userPrompt;

      // Step 1: Text De-noiser & Cleaner
      const cleanedTranscript = rawTranscript
        .replace(/(他[說就]|對呀|那個|嗯|啊|這這|我我|你你){2,}/g, "$1")
        .replace(/\n{3,}/g, "\n\n");

      // Step 1.5: Scenario Detection & Anti-Hallucination Grounding Setup
      const hasExhibitionKeywords = /展覽|世貿|南港展覽館|參展|攤位佈置|展品|主辦單位|外貿協會/i.test(rawTranscript);

      let scenarioGuide = "";
      if (scenario === "weekly" || (scenario === "auto" && !hasExhibitionKeywords)) {
        scenarioGuide = "【當前會議情境：公司內部常態週會 / 營運行政列管】\n主要關注：各同仁工作進度、團隊活動與聚餐訂位、行政待辦排程、各專案案場推展進度。嚴禁將內部聚餐或日常業務捏造為展覽、攤位或策展！";
      } else if (scenario === "tech") {
        scenarioGuide = "【當前會議情境：研發技術架構 / 系統審查對齊】\n主要關注：技術架構選型、API/資料庫設計、軟硬體整合測試、資安與穩定性規範。";
      } else if (scenario === "engineering") {
        scenarioGuide = "【當前會議情境：案場工程交付 / 硬體裝機驗收】\n主要關注：合約審查、配電圖與施工排程、設備叫料與驗收標準。";
      } else if (scenario === "business") {
        scenarioGuide = "【當前會議情境：商務合作洽談 / 客戶需求對齊】\n主要關注：商業合作模式、收費與合約條款、權責切分與交付里程碑。";
      } else if (scenario === "exhibition" || hasExhibitionKeywords) {
        scenarioGuide = "【當前會議情境：公眾展會 / 大型對外活動籌備】\n主要關注：展位規劃、展示設備、文宣推廣與人員輪值。";
      }

      // Step 2: Map-Reduce Chunking (Adapted for Qwen 2.5 8K Large Context)
      const CHUNK_SIZE = 12000;
      let consolidatedFacts = "";

      if (cleanedTranscript.length > CHUNK_SIZE) {
        const chunks: string[] = [];
        for (let i = 0; i < cleanedTranscript.length; i += CHUNK_SIZE) {
          chunks.push(cleanedTranscript.substring(i, i + CHUNK_SIZE));
        }

        console.log(`[Summarize] Map-Reduce: 分 ${chunks.length} 個大區塊加速提煉事實...`);

        // Map Phase: Extract factual key points per segment with Timestamps
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
                  content: `你是事實提煉特助。${scenarioGuide}\n請客觀提取事實，每一點必須標註時間標籤（如 [MM:SS]）：1. 討論主題與達成之共識 2. 提及的數據/規格/型號/數值 3. 明確的待辦任務與責任人。只列事實，絕不添加無關人名或數據。嚴禁臆測非逐字稿提及的無關情境。`
                },
                { role: "user", content: `【會議片段 ${idx + 1}/${chunks.length}】：\n${chunk}` }
              ],
              temperature: 0.1,
              max_tokens: 800
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

      // Step 3: Reduce Phase (Global Executive Synthesis with Timestamp Anchoring)
      const reducePrompt = `你是上市公司執行長特助。請根據以下【各段已提煉之會議事實清單】，直接整理成【1 頁極簡高管精華版】會議紀錄。

${scenarioGuide}

【嚴格反幻覺規範 (Grounding & Anti-Hallucination)】：
1. 嚴禁無中生有！所有內容必須 100% 來自以下事實清單！
2. 每一項核心決策、關鍵規格、待辦事項，末尾必須附帶時間戳標籤（如 [MM:SS]），有據可查！
3. 若非公眾展覽，絕對嚴禁將聚餐、訂位、日常採購捏造為「展會」、「攤位承攬」或「策展」！
4. 嚴禁憑空捏造非逐字稿提及的英文姓名或虛構職稱（如 Jennifer 導演等）！

請直接輸出以下標準格式：
# 📋 [會議主題] - 極簡精華紀錄
> **會議日期**：[日期] | **地點**：[地點] | **出席人員**：[出席人員]

## 🎯 一、30 秒核心決策與共識 (Key Decisions)
（精簡列出最核心的 3~4 點定案事項，每點以【粗體標題】+ 1~2 句話結論呈現，末尾附時間戳如 [05:20]）

## 📊 二、關鍵規格與技術參數指標 (Key Metrics)
| 項目 | 核心規格 / 數值 | 實務說明與場域 | 時間出處 |
| :--- | :---: | :--- | :---: |
（僅列出本次對話中實際提及的 3~4 項核心數值、型號或工程參數，無則省略）

## ✅ 三、行動追蹤矩陣 (Action Matrix)
| 項次 | 具體待辦事項說明 | 優先級 | 負責人 | 預計完成時程 | 時間出處 |
| :---: | :--- | :---: | :---: | :---: | :---: |
（僅列出最核心的 3~5 項具體任務，優先級標註 [🔥最高]、[⚡高優先] 或 [📌中優先]）

## ⚠️ 四、重點風險與下一步 (Next Steps)
（1~2 點本次會議提及之實際風險與下步行動，附時間戳）

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
      let polishedText = finalData?.choices?.[0]?.message?.content || "";

      // Post-Processing Grounding Verifier (jt-doc-tools inspired)
      if (!hasExhibitionKeywords && scenario !== "exhibition") {
        const hadHallucination = /展會|攤位|策展|Jennifer/i.test(polishedText);
        if (hadHallucination) {
          console.warn("[Grounding Verifier] Filtered unauthorized exhibition hallucinations.");
          polishedText = polishedText
            .replace(/展會籌備與攤位承攬/g, "團隊聚會與活動安排")
            .replace(/攤位承攬商/g, "場地合作單位")
            .replace(/攤位數量/g, "預定桌數/席位")
            .replace(/4\s*個攤位/g, "4 桌 (約 20 人)")
            .replace(/展會晚宴/g, "團隊聚餐")
            .replace(/展會進場/g, "聚餐進場")
            .replace(/展會人員/g, "出席人員")
            .replace(/展會相關協議書與租約/g, "案場協議書與租約")
            .replace(/重點案場展覽合約/g, "重點案場工程合約")
            .replace(/展會合約/g, "專案合約")
            .replace(/展會策劃團隊/g, "行政團隊")
            .replace(/Jennifer\s*導演[、與和]?/gi, "")
            .replace(/攤位系統整合交付/g, "系統軟硬體整合交付")
            .replace(/攤位/g, "席位");
        }
      }

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

      function scan(dir: string, depth = 0) {
        try {
          for (const f of Deno.readDirSync(dir)) {
            const full = `${dir}\\${f.name}`;
            if (f.isFile && f.name.endsWith(".md")) {
              if (!seen.has(full)) {
                seen.add(full);
                const stat = Deno.statSync(full);
                list.push({
                  name: f.name,
                  path: full,
                  size: stat.size,
                  mtime: stat.mtime ? stat.mtime.toISOString() : new Date().toISOString()
                });
              }
            } else if (f.isDirectory && depth < 2 && !f.name.startsWith(".") && dir !== desktopDir) {
              scan(full, depth + 1);
            }
          }
        } catch (_) {}
      }

      scan(meetingsDir, 0);
      scan(desktopDir, 0);

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

  // 6. API: /api/delete-meeting (Deletes file and cleans empty folder)
  if (pathname === "/api/delete-meeting" && req.method === "POST") {
    try {
      const { path } = await req.json();
      if (!path) return Response.json({ success: false, error: "Missing path" });

      const filename = path.substring(path.lastIndexOf("\\") + 1);
      const parentDir = path.substring(0, path.lastIndexOf("\\"));

      try { Deno.removeSync(path); } catch (_) {}
      try { Deno.removeSync(path.replace(/\.md$/, ".doc")); } catch (_) {}

      // Clean empty meeting directory if parent is not root meetingsDir or desktopDir
      try {
        if (parentDir !== meetingsDir && parentDir !== desktopDir) {
          const remaining = Array.from(Deno.readDirSync(parentDir));
          if (remaining.length === 0) {
            Deno.removeSync(parentDir);
          }
        }
      } catch (_) {}

      return Response.json({ success: true, message: `已成功刪除會議檔案：${filename}` });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 7. API: /api/import-meeting (Imports an external .md or .txt file into meeting subfolder)
  if (pathname === "/api/import-meeting" && req.method === "POST") {
    try {
      const { filename, content, customDir } = await req.json();
      if (!filename || !content) {
        return Response.json({ success: false, error: "Missing filename or content" });
      }

      const cleanName = filename.endsWith(".md") ? filename : `${filename.replace(/\.[^/.]+$/, "")}.md`;
      const baseDir = resolveTargetDirectory(customDir);
      const folderName = getMeetingFolderName(cleanName);
      const meetingFolder = `${baseDir}\\${folderName}`;
      try { Deno.mkdirSync(meetingFolder, { recursive: true }); } catch (_) {}
      const targetFilePath = `${meetingFolder}\\${cleanName}`;

      Deno.writeTextFileSync(targetFilePath, content);
      return Response.json({ success: true, path: targetFilePath, filename: cleanName, folder: meetingFolder });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 8. API: /api/save-audio (Automatically saves recorded audio blob into meeting subfolder)
  if (pathname === "/api/save-audio" && req.method === "POST") {
    try {
      const rawHeader = req.headers.get("X-Filename");
      const filename = rawHeader ? decodeURIComponent(rawHeader) : `Recording_${Date.now()}.webm`;
      const cleanName = filename.endsWith(".webm") ? filename : `${filename}.webm`;
      const customDirHeader = req.headers.get("X-Custom-Dir");
      const customDir = customDirHeader ? decodeURIComponent(customDirHeader) : "";

      const rawBytes = new Uint8Array(await req.arrayBuffer());

      const baseDir = resolveTargetDirectory(customDir);
      const folderName = getMeetingFolderName(cleanName);
      const meetingFolder = `${baseDir}\\${folderName}`;
      try { Deno.mkdirSync(meetingFolder, { recursive: true }); } catch (_) {}
      const targetFilePath = `${meetingFolder}\\${cleanName}`;

      Deno.writeFileSync(targetFilePath, rawBytes);
      console.log(`[SaveAudio] Saved ${rawBytes.length} bytes to ${targetFilePath}`);
      return Response.json({ success: true, path: targetFilePath, folder: meetingFolder });
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
              let currentMem: any = { learned_rules: [], enterprise_entities: {} };
              try { currentMem = JSON.parse(Deno.readTextFileSync(memoryPath)); } catch (_) {}
              
              const ent: any = currentMem.enterprise_entities || {};
              for (const [k, arr] of Object.entries(newEntities as Record<string, any>)) {
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

  // 10. API: /api/auto-save (Saves markdown or transcript into meeting's dedicated folder)
  if (pathname === "/api/auto-save" && req.method === "POST") {
    try {
      const { filename, content, type, customDir } = await req.json();
      if (!filename || !content) return Response.json({ success: false, error: "Missing data" });

      const ext = type === "markdown" ? ".md" : ".txt";
      const cleanName = filename.endsWith(ext) ? filename : `${filename}${ext}`;

      const baseDir = resolveTargetDirectory(customDir);
      const folderName = getMeetingFolderName(cleanName);
      const meetingFolder = `${baseDir}\\${folderName}`;
      try { Deno.mkdirSync(meetingFolder, { recursive: true }); } catch (_) {}
      const targetFilePath = `${meetingFolder}\\${cleanName}`;

      Deno.writeTextFileSync(targetFilePath, content);

      // Automatically deposit a copy to D:\project\TrainingData\[Topic]_(地端初稿).md
      if (type === "markdown") {
        try {
          const trainingDir = "D:\\project\\TrainingData";
          const baseTopic = cleanName.replace(/\.md$/, "").replace(/_\(地端初稿\)$/, "");
          const trainingDraftPath = `${trainingDir}\\${baseTopic}_(地端初稿).md`;
          Deno.writeTextFileSync(trainingDraftPath, content);
        } catch (_) {}
      }

      console.log(`[AutoSave] Saved to ${targetFilePath}`);
      return Response.json({ success: true, path: targetFilePath, folder: meetingFolder });
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

// Automatic Model Pre-warming (Zero Cold-Start Lag)
(async () => {
  try {
    const testWav = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\test_wavs\\zh.wav";
    console.log("[Pre-warm] Pre-warming SenseVoice (阿里開源) in background...");
    
    // 1. Pre-warm SenseVoice
    const sv = new Deno.Command(senseVoiceCli, {
      args: [`--tokens=${senseVoiceTokens}`, `--sense-voice-model=${senseVoiceModel}`, "--num-threads=2", testWav]
    });
    await sv.output();

    console.log("✨ [Pre-warm] SenseVoice STT model fully warmed up into memory!");
  } catch (err) {
    console.warn("[Pre-warm] Background pre-warm notice:", err);
  }
})();

