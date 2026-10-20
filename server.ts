import * as OpenCC from "npm:opencc-js";
const toTaiwanTraditional = OpenCC.Converter({ from: "cn", to: "tw" });

// Deno server. 8088 is taken on this PC by XQ daq.exe, so the app uses 18788.
const port = 18788;
const root = "D:\\project\\MeetingAssistant";
const meetingsDir = "D:\\project\\Meetings";
const tempDir = "D:\\project\\temp_transcribe";
const desktopDir = `${Deno.env.get("USERPROFILE") ?? "C:\\Users\\觀達"}\\Desktop`;
const whisperCli = "D:\\project\\whisper.cpp\\Release\\whisper-cli.exe";
const whisperModel = "D:\\project\\models\\ggml-base.bin";
const ffmpeg = "D:\\project\\MeetingAssistant\\ffmpeg.exe";

// Alibaba SenseVoice (sherpa-onnx FunASR Nano int8)
const senseVoiceCli = "D:\\project\\SenseVoice\\sherpa-onnx-v1.13.8-win-x64-shared-MT-Release\\bin\\sherpa-onnx-offline.exe";
const senseVoiceModel = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\model.int8.onnx";
const senseVoiceTokens = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\tokens.txt";

// OpenCode Zen free cloud (DeepSeek V4.1 Flash Free) — via local `opencode serve`
const OPENCODE_BASE = Deno.env.get("OPENCODE_URL") ?? "http://127.0.0.1:4096";
const CLOUD_MODEL = {
  providerID: "opencode",
  modelID: Deno.env.get("OPENCODE_MODEL") ?? "deepseek-v4.1-flash-free",
};
const LLM_ENGINE_LABEL = "DeepSeek V4.1 Flash Free（OpenCode 雲端）";

type ChatMessage = { role: string; content: string };

/** Chat-only call through OpenCode serve (plan agent = no file tools). */
async function cloudChat(messages: ChatMessage[]): Promise<string> {
  const sessRes = await fetch(`${OPENCODE_BASE}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "meeting-assistant" }),
  });
  if (!sessRes.ok) {
    throw new Error(`OpenCode session 失敗 (${sessRes.status})：請確認已啟動 opencode serve（port 4096）`);
  }
  const sess = await sessRes.json();
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const userText = messages
    .filter((m) => m.role !== "system")
    .map((m) => (m.role === "assistant" ? `【助理】${m.content}` : m.content))
    .join("\n\n");

  const body: Record<string, unknown> = {
    model: CLOUD_MODEL,
    agent: "plan",
    parts: [{ type: "text", text: userText || "（空內容）" }],
  };
  if (system) body.system = system;

  const msgRes = await fetch(`${OPENCODE_BASE}/session/${sess.id}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!msgRes.ok) {
    const errText = await msgRes.text();
    throw new Error(`OpenCode 推論失敗 (${msgRes.status}): ${errText.slice(0, 400)}`);
  }
  const msg = await msgRes.json();
  const texts = (msg.parts || [])
    .filter((p: { type?: string; text?: string }) => p.type === "text" && p.text)
    .map((p: { text: string }) => p.text);
  const content = texts.join("").trim();
  if (!content) throw new Error("OpenCode 回傳空白內容");
  return content;
}

async function openaiStyleChat(messages: ChatMessage[]): Promise<{
  choices: Array<{ message: { role: string; content: string } }>;
}> {
  const content = await cloudChat(messages);
  return { choices: [{ message: { role: "assistant", content } }] };
}

function getOpenCodeAuthPath(): string {
  const home = Deno.env.get("USERPROFILE") ?? Deno.env.get("HOME") ?? "";
  return `${home}\\.local\\share\\opencode\\auth.json`;
}

function hasOpenCodeCredentials(): boolean {
  try {
    const authPath = getOpenCodeAuthPath();
    const st = Deno.statSync(authPath);
    if (!st.isFile || st.size < 3) return false;
    const parsed = JSON.parse(Deno.readTextFileSync(authPath));
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === "object") return Object.keys(parsed).length > 0;
    return false;
  } catch {
    return false;
  }
}

async function isOpenCodeServiceUp(): Promise<boolean> {
  try {
    const res = await fetch(`${OPENCODE_BASE}/global/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.healthy;
  } catch {
    return false;
  }
}

/** Health only — use llm-status API for “can actually call DeepSeek”. */
async function isCloudLlmReady(): Promise<boolean> {
  const up = await isOpenCodeServiceUp();
  return up && hasOpenCodeCredentials();
}

/** Local Qwen (8080) when available; otherwise OpenCode / DeepSeek Free cloud. */
async function localOrCloudChat(
  messages: ChatMessage[],
  options?: { temperature?: number; max_tokens?: number; timeoutMs?: number },
): Promise<string> {
  const temperature = options?.temperature ?? 0.2;
  const max_tokens = options?.max_tokens ?? 2000;
  const timeoutMs = options?.timeoutMs ?? 90000;
  try {
    const res = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5-7b-instruct",
        messages,
        temperature,
        max_tokens,
      }),
      signal: AbortSignal.timeout(Math.min(timeoutMs, 120000)),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    }
  } catch (_) {
    /* fall through to cloud */
  }
  const wrapped = await openaiStyleChat(messages);
  return wrapped.choices[0]?.message?.content?.trim() || "";
}

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
console.log(`LLM: ${LLM_ENGINE_LABEL} via ${OPENCODE_BASE}`);
isCloudLlmReady().then((ok) => {
  console.log(ok ? `[OK] OpenCode 雲端就緒` : `[WARN] OpenCode serve 未就緒（請啟動 port 4096）`);
});

Deno.serve({ hostname: "127.0.0.1", port }, async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

  if (pathname === "/api/health" && req.method === "GET") {
    return Response.json({ ok: true, app: "meeting-assistant", port });
  }

  // 0. API: /api/llm-status
  if (pathname === "/api/llm-status" && req.method === "GET") {
    const serviceUp = await isOpenCodeServiceUp();
    const authenticated = hasOpenCodeCredentials();
    const ready = serviceUp && authenticated;
    let hint = "";
    if (!serviceUp) {
      hint = "OpenCode 未啟動：請執行 Start_MeetingAssistant.bat 或 opencode serve --port 4096 --hostname 127.0.0.1";
    } else if (!authenticated) {
      hint =
        "尚未設定 OpenCode API 憑證：請執行 OpenCode登入DeepSeek.bat，或 opencode auth login -p opencode 並貼上 https://opencode.ai/auth 建立的 oc_sk API key（console login 不算）";
    }
    return Response.json({
      success: true,
      ready,
      serviceUp,
      authenticated,
      hint,
      engine: LLM_ENGINE_LABEL,
      model: `${CLOUD_MODEL.providerID}/${CLOUD_MODEL.modelID}`,
      endpoint: OPENCODE_BASE,
      authPath: getOpenCodeAuthPath(),
    });
  }

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

      const translated = await localOrCloudChat(
        [
          { role: "system", content: "你是專業即時同聲傳譯員，請將英文句子直接翻譯成流暢的繁體中文，僅輸出繁中結果：" },
          { role: "user", content: text },
        ],
        { temperature: 0.1, max_tokens: 256, timeoutMs: 8000 },
      ) || text;
      return Response.json({ success: true, translated });
    } catch (err) {
      return Response.json({ success: false, error: String(err) });
    }
  }

  // 2. API: /api/ai-summarize (Supports Online Gemini API & Grounded Local LLM Engine)
  if (pathname === "/api/ai-summarize" && req.method === "POST") {
    try {
      const rawReq = await req.json();
      const messages = rawReq.messages || [];
      const userPrompt = messages.find((m: any) => m.role === "user")?.content || "";
      const geminiApiKey = rawReq.geminiApiKey || Deno.env.get("GEMINI_API_KEY") || "";
      const useModel = rawReq.model || (geminiApiKey ? "gemini-1.5-flash" : "qwen2.5-7b-instruct");

      const transcriptMarker = "會議逐字稿：";
      const markerIdx = userPrompt.indexOf(transcriptMarker);
      const rawTranscript = markerIdx !== -1 ? userPrompt.substring(markerIdx + transcriptMarker.length).trim() : userPrompt;

      // Clean redundant verbal tics
      const cleanedTranscript = rawTranscript
        .replace(/(他[說就]|對呀|那個|嗯|啊|這這|我我|你你){3,}/g, "$1")
        .replace(/\n{3,}/g, "\n\n");

      // Professional Business Meeting Minutes Prompt
      const formalSystemPrompt = `你是資深專案總監與高階會議紀錄專家。
請根據使用者提供的會議逐字稿，客觀整理出【正規、詳實、結構化的商務正式會議紀錄】。

【嚴格紀律】：
1. 嚴禁任何「30秒」、「極簡」、「速讀」等浮誇標題與縮水內容。
2. 嚴格事實接地 (100% Grounding)：所有議題、數字、人名、結論必須完全來自逐字稿。未提及者嚴禁憑空捏造！
3. 保留實質討論細節：詳細記錄討論中的關鍵考量、方案優劣比較、爭議點與決策理由。
4. 每一項核心討論與決議末尾務必標註時間出處（如 [MM:SS]）。

請直接輸出以下標準格式：
# 📝 [會議主題] - 正式會議紀錄

| 項目 | 內容 |
| :--- | :--- |
| **會議日期** | [年-月-日] |
| **會議地點** | [地點] |
| **出席人員** | [實際與會者，未提及則填「相關專案同仁」] |
| **會議目的** | [本次會議核心召開緣由與目標] |

---

### 壹、會議緣起與背景說明
（簡要說明本次會議召開背景、前情提要或外部觸發事件）

### 貳、各項議題詳細討論紀要
（請依討論主題拆分：【議題一：...】、【議題二：...】等。
每一議題詳實記錄：
- 討論核心與痛點
- 各方發言觀點與論證依據，附時間標籤 [MM:SS]
- 方案比較與決策考量）

### 參、核心決議事項 (Resolutions)
（以清晰清單明確列出本場會議拍板定案的所有重大事項，不含糊、不遺漏，附時間標籤）

### 肆、工作分工與行動追蹤表 (Action Items)
| 項次 | 待辦工作事項 | 具體交付成果 | 主責人員 | 協辦/支援 | 預計完成期限 | 時間出處 |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
（具體任務列出，不空泛，責任到人）

### 伍、後續待辦與未決追蹤事項 (Pending Issues)
（記錄會中提及但需會後確認、查證或下次再議的事項，附時間出處）`;

      // Branch A: Call Online Gemini 1.5 API (Ultra Fast & Native 1M Context)
      if (geminiApiKey) {
        console.log(`[Summarize] Using Online Gemini API (${useModel})...`);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${geminiApiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: `${formalSystemPrompt}\n\n會議逐字稿如下：\n${cleanedTranscript}` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 4096
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          if (generatedText) {
            return Response.json({
              choices: [{ message: { role: "assistant", content: generatedText } }],
              provider: "gemini"
            });
          }
        } else {
          const errText = await geminiRes.text();
          console.warn("[Summarize] Gemini API notice, falling back to local:", errText);
        }
      }

      // Branch B: Local Qwen 2.5 7B Engine (With Anti-Repetition & Grounded Parameters)
      console.log("[Summarize] Running Local Qwen 2.5 Engine with Anti-Loop protection...");
      const CHUNK_SIZE = 12000;
      let consolidatedFacts = "";

      if (cleanedTranscript.length > CHUNK_SIZE) {
        const chunks: string[] = [];
        for (let i = 0; i < cleanedTranscript.length; i += CHUNK_SIZE) {
          chunks.push(cleanedTranscript.substring(i, i + CHUNK_SIZE));
        }

        console.log(`[Summarize] Map-Reduce: 分 ${chunks.length} 個大區塊客觀提取事實...`);
        const extractedSegments: string[] = [];
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];
          const factText = await localOrCloudChat(
            [
              {
                role: "system",
                content:
                  "你是事實提煉特助。請從以下會議片段中客觀提取事實，嚴禁使用口號：1. 討論主題與各方意見 2. 提及的數據/規格/數值 3. 達成的共識與待辦任務。每一點必須標註時間標籤（如 [MM:SS]）。只列真實事實，嚴禁腦補未提及的人名或情境。",
              },
              { role: "user", content: `【會議片段 ${idx + 1}/${chunks.length}】：\n${chunk}` },
            ],
            { temperature: 0.2, max_tokens: 1000 },
          );
          if (factText) extractedSegments.push(factText);
        }
        consolidatedFacts = extractedSegments.join("\n\n---\n\n");
      } else {
        consolidatedFacts = cleanedTranscript;
      }

      const polishedText = await localOrCloudChat(
        [
          { role: "system", content: formalSystemPrompt },
          {
            role: "user",
            content: `請根據以下【真實會議事實清單】，嚴格依據標準格式整理出正式會議紀錄：\n\n${consolidatedFacts.slice(0, 16000)}`,
          },
        ],
        { temperature: 0.2, max_tokens: 3500 },
      );

      const provider = hasOpenCodeCredentials() ? "opencode-deepseek" : "local-qwen";

      return Response.json({
        choices: [
          {
            message: {
              role: "assistant",
              content: polishedText
            }
          }
        ],
        provider,
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

  // 5. API: /api/chat-with-meeting (Q&A via DeepSeek Free cloud)
  if (pathname === "/api/chat-with-meeting" && req.method === "POST") {
    try {
      const { docContent, question } = await req.json();
      if (!docContent || !question) {
        return Response.json({ success: false, error: "Missing docContent or question" });
      }

      const data = await openaiStyleChat([
        {
          role: "system",
          content: "你是高階 AI 會議特助。請根據使用者提供的會議紀錄內容，使用專業、精準、結構化的繁體中文回答使用者的問題。若會議內容未提及，請如實告知。",
        },
        {
          role: "user",
          content: `【會議紀錄內容】：\n${docContent.slice(0, 20000)}\n\n【使用者問題】：\n${question}`,
        },
      ]);
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

      // Asynchronously extract and merge new entities into company_memory.json via DeepSeek Free
      if (editedContent && editedContent.length > 50) {
        (async () => {
          try {
            const extractPrompt = `請從以下會議紀錄中，提煉出該企業的核心人名、專用設備型號、系統名稱與重要數據指標，以 JSON 格式輸出：{"personnel":[], "equipment_models":[], "systems_partners":[], "subsidies_metrics":[]}\n\n會議內容：\n${editedContent.slice(0, 4000)}`;
            const data = await openaiStyleChat([
              { role: "system", content: "你是一個專業的實體識別與知識圖譜建構專家，請僅輸出乾淨的 JSON 物件。" },
              { role: "user", content: extractPrompt },
            ]);
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
        "Expires": "0",
        "Permissions-Policy": "microphone=(self), display-capture=(self)",
      },
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

