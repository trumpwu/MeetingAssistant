import * as OpenCC from "npm:opencc-js";

const toTaiwanTraditional = OpenCC.Converter({ from: "cn", to: "tw" });
const ffmpeg = "D:\\project\\MeetingAssistant\\ffmpeg.exe";
const senseVoiceCli = "D:\\project\\SenseVoice\\sherpa-onnx-v1.13.8-win-x64-shared-MT-Release\\bin\\sherpa-onnx-offline.exe";
const senseVoiceModel = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\model.int8.onnx";
const senseVoiceTokens = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\tokens.txt";
const meetingsDir = "D:\\project\\Meetings";
const desktopDir = "C:\\Users\\Innovare\\Desktop";
const trainingDir = "D:\\project\\TrainingData";
const tempDir = "D:\\project\\temp_transcribe\\weekly_chunks";

try { Deno.mkdirSync(tempDir, { recursive: true }); } catch (_) {}
try { Deno.mkdirSync(trainingDir, { recursive: true }); } catch (_) {}

const audioSource = "D:\\project\\Meetings\\2026-09-29_公司大會議室_週會.webm";

console.log("=================================================");
console.log("🚀 開始處理會議錄音：2026-09-29_公司大會議室_週會");
console.log("=================================================");

// 1. Slicing into 120-second (2-minute) chunks via ffmpeg
console.log("[1/4] 正在將音訊進行高精度 2 分鐘分段切片 (PCM 16kHz Mono)...");
const segmentPattern = `${tempDir}\\chunk_%03d.wav`;

const sliceCmd = new Deno.Command(ffmpeg, {
  args: [
    "-y",
    "-i", audioSource,
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
  console.error("FFmpeg slicing error:", new TextDecoder().decode(sliceOut.stderr));
}

// 2. Scan and Sort Chunks
const chunkFiles: string[] = [];
for (const entry of Deno.readDirSync(tempDir)) {
  if (entry.isFile && entry.name.startsWith("chunk_") && entry.name.endsWith(".wav")) {
    chunkFiles.push(entry.name);
  }
}
chunkFiles.sort();
console.log(`音訊切片完成，共 ${chunkFiles.length} 個音訊片段！`);

// 3. Transcribe each chunk with SenseVoice
console.log("[2/4] 正在以阿里 SenseVoice 50x 極速引擎進行逐段離線轉錄...");
const fullTranscriptLines: string[] = [];

for (let i = 0; i < chunkFiles.length; i++) {
  const chunkName = chunkFiles[i];
  const chunkPath = `${tempDir}\\${chunkName}`;
  const startSec = i * 120;
  const startMin = Math.floor(startSec / 60);
  const startSecRem = startSec % 60;
  const timeLabel = `[${String(startMin).padStart(2, '0')}:${String(startSecRem).padStart(2, '0')}]`;

  const svCmd = new Deno.Command(senseVoiceCli, {
    args: [
      `--tokens=${senseVoiceTokens}`,
      `--sense-voice-model=${senseVoiceModel}`,
      "--sense-voice-language=auto",
      "--sense-voice-use-itn=true",
      "--num-threads=8",
      chunkPath
    ]
  });
  const svOut = await svCmd.output();
  let chunkText = "";
  if (svOut.code === 0) {
    const rawStdout = new TextDecoder("utf-8").decode(svOut.stdout);
    for (const line of rawStdout.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{") && trimmed.includes('"text"')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.text) {
            chunkText = parsed.text.trim();
            break;
          }
        } catch (_) {}
      }
    }
  }

  if (chunkText) {
    const traditional = toTaiwanTraditional(chunkText);
    console.log(`${timeLabel} (${i + 1}/${chunkFiles.length}): ${traditional.substring(0, 45)}...`);
    fullTranscriptLines.push(`${timeLabel} ${traditional}`);
  } else {
    console.log(`${timeLabel} (${i + 1}/${chunkFiles.length}): [靜音或無人聲]`);
  }

  // Clean chunk file
  try { Deno.removeSync(chunkPath); } catch (_) {}
}

const finalFullTranscript = fullTranscriptLines.join("\n\n");
const transcriptFile = `${meetingsDir}\\2026-09-29_公司大會議室_週會_(逐字稿).txt`;
const transcriptDesktop = `${desktopDir}\\2026-09-29_公司大會議室_週會_(逐字稿).txt`;

Deno.writeTextFileSync(transcriptFile, finalFullTranscript);
try { Deno.writeTextFileSync(transcriptDesktop, finalFullTranscript); } catch (_) {}
console.log(`✨ 完整繁體中文逐字稿已儲存至：\n  - ${transcriptFile}\n  - ${transcriptDesktop}`);

// 4. Map-Reduce Summarization via local Qwen 2.5 7B (Port 8080) to capture 地端初稿
console.log("\n[3/4] 正在透過本地 Qwen 2.5 7B 模擬網頁版 Map-Reduce 生成地端初稿...");
let localDraft = "";

try {
  const CHUNK_SIZE = 3500;
  const chunks: string[] = [];
  for (let i = 0; i < finalFullTranscript.length; i += CHUNK_SIZE) {
    chunks.push(finalFullTranscript.substring(i, i + CHUNK_SIZE));
  }

  console.log(`分 ${chunks.length} 個區塊進行 Map 萃取...`);
  const extractedSegments: string[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
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
          { role: "user", content: `【會議片段 ${idx + 1}/${chunks.length}】：\n${chunks[idx]}` }
        ],
        temperature: 0.1,
        max_tokens: 600
      })
    });
    const mapData = await mapRes.json();
    const factText = mapData?.choices?.[0]?.message?.content?.trim();
    if (factText) extractedSegments.push(factText);
  }

  const consolidatedFacts = extractedSegments.join("\n\n---\n\n");

  const reducePrompt = `你是上市公司執行長特助。請根據以下【各段已提煉之會議事實清單】，直接整理成【1 頁極簡高管精華版】會議紀錄。

【嚴格規則】：
1. 嚴禁重複拷貝相同內容！嚴禁按人名條列重複的樣板句！
2. 嚴禁捏造任何未在會議中提及的無關數據、規格或數值！
3. 所有內容必須 100% 來自以下事實清單！

請直接輸出以下標準格式：
# 📋 2026-09-29 公司大會議室週會 - 極簡高管精華紀錄
> **會議日期**：2026-09-29 | **地點**：公司大會議室

## 🎯 一、30 秒核心決策與共識 (Key Decisions)
（精簡列出最核心的 3~4 點定案事項，每點以【粗體標題】+ 1~2 句話結論呈現）

## 📊 二、關鍵進度與業務指標 (Key Metrics)
| 項目 | 核心進展 / 數值 | 責任部門與備註 |
| :--- | :---: | :--- |

## ✅ 三、行動追蹤矩陣 (Action Matrix)
| 項次 | 具體待辦事項說明 | 優先級 | 負責人 | 預計完成時程 |
| :---: | :--- | :---: | :---: | :---: |

## ⚠️ 四、重點風險與下一步 (Next Steps)

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
  localDraft = finalData?.choices?.[0]?.message?.content || "";
} catch (err) {
  console.warn("Local Qwen summarization error:", err);
}

if (localDraft) {
  const draftFile = `${trainingDir}\\2026-09-29_公司大會議室_週會_(地端初稿).md`;
  Deno.writeTextFileSync(draftFile, localDraft);
  console.log(`✨ 地端初稿已保存至：${draftFile}`);
}

console.log("=================================================");
console.log("🎉 逐字稿與地端初稿處理完畢！");
console.log("=================================================");
