import * as OpenCC from "npm:opencc-js";

const toTaiwanTraditional = OpenCC.Converter({ from: "cn", to: "tw" });
const ffmpeg = "D:\\project\\MeetingAssistant\\ffmpeg.exe";
const senseVoiceCli = "D:\\project\\SenseVoice\\sherpa-onnx-v1.13.8-win-x64-shared-MT-Release\\bin\\sherpa-onnx-offline.exe";
const senseVoiceModel = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\model.int8.onnx";
const senseVoiceTokens = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\tokens.txt";
const meetingsDir = "D:\\project\\Meetings";
const desktopDir = "C:\\Users\\Innovare\\Desktop";
const tempDir = "D:\\project\\temp_transcribe\\delta_chunks";

try { Deno.mkdirSync(tempDir, { recursive: true }); } catch (_) {}

const audioSource = "D:\\project\\Meetings\\2026-09-18_公司大會議室_台達電來訪.webm";

console.log("=================================================");
console.log("🚀 開始處理 104 分鐘會議錄音：台達電來訪");
console.log("=================================================");

// 1. Slicing into 120-second (2-minute) chunks via ffmpeg
console.log("[1/3] 正在將音訊進行高精度 2 分鐘分段切片 (PCM 16kHz Mono)...");
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
console.log("[2/3] 正在以阿里 SenseVoice 50x 極速引擎進行逐段離線轉錄...");
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
    console.log(`${timeLabel} (${i + 1}/${chunkFiles.length}): ${traditional.substring(0, 40)}...`);
    fullTranscriptLines.push(`${timeLabel} ${traditional}`);
  }

  // Clean chunk file
  try { Deno.removeSync(chunkPath); } catch (_) {}
}

const finalFullTranscript = fullTranscriptLines.join("\n\n");
const transcriptFile = `${meetingsDir}\\2026-09-18_公司大會議室_台達電來訪_(逐字稿).txt`;
const transcriptDesktop = `${desktopDir}\\2026-09-18_公司大會議室_台達電來訪_(逐字稿).txt`;

Deno.writeTextFileSync(transcriptFile, finalFullTranscript);
try { Deno.writeTextFileSync(transcriptDesktop, finalFullTranscript); } catch (_) {}
console.log(`✨ 完整繁體中文逐字稿已儲存至：\n  - ${transcriptFile}\n  - ${transcriptDesktop}`);

// 4. Map-Reduce Summarization via Qwen 2.5 7B (Port 8080)
console.log("\n[3/3] 正在透過本地 Qwen 2.5 7B 進行 Map-Reduce 兩段式高管精華提煉...");

const CHUNK_SIZE = 3500;
const chunks: string[] = [];
for (let i = 0; i < finalFullTranscript.length; i += CHUNK_SIZE) {
  chunks.push(finalFullTranscript.substring(i, i + CHUNK_SIZE));
}

console.log(`逐字稿總長度 ${finalFullTranscript.length} 字，分 ${chunks.length} 個區塊進行 Map 萃取...`);
const extractedSegments: string[] = [];

for (let idx = 0; idx < chunks.length; idx++) {
  console.log(`正在提煉第 ${idx + 1}/${chunks.length} 段事實...`);
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

// Reduce Phase
console.log("正在執行 Reduce 階段（綜合為 1 頁高管商業報告）...");
const reducePrompt = `你是上市公司執行長特助。請根據以下【各段已提煉之會議事實清單】，直接整理成【1 頁極簡高管精華版】會議紀錄。

【嚴格規則】：
1. 嚴禁重複拷貝相同內容！嚴禁按人名條列重複的樣板句！
2. 嚴禁捏造任何未在會議中提及的無關數據、規格或數值！
3. 所有內容必須 100% 來自以下事實清單！

請直接輸出以下標準格式：
# 📋 台達電來訪技術交流討論會 - 極簡高管精華紀錄
> **會議日期**：2026-09-18 | **地點**：公司大會議室 | **出席人員**：台達電團隊、公司專案團隊

## 🎯 一、30 秒核心決策與共識 (Key Decisions)
（精簡列出最核心的 3~4 點定案事項，每點以【粗體標題】+ 1~2 句話結論呈現）

## 📊 二、關鍵規格與技術參數指標 (Key Metrics)
| 項目 | 核心規格 / 數值 | 實務說明與場域 |
| :--- | :---: | :--- |
（列出本次對話中實際提及的核心數值、型號、雲端監控方案架構或規格參數，無則省略）

## ✅ 三、行動追蹤矩陣 (Action Matrix)
| 項次 | 具體待辦事項說明 | 優先級 | 負責人 | 預計完成時程 |
| :---: | :--- | :---: | :---: | :---: |
（列出最核心的 3~5 項具體任務，優先級標註 [🔥最高]、[⚡高優先] 或 [📌中優先]）

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
const polishedMarkdown = finalData?.choices?.[0]?.message?.content || "";

const mdFile = `${meetingsDir}\\2026-09-18_公司大會議室_台達電來訪.md`;
const mdDesktop = `${desktopDir}\\2026-09-18_公司大會議室_台達電來訪.md`;

Deno.writeTextFileSync(mdFile, polishedMarkdown);
try { Deno.writeTextFileSync(mdDesktop, polishedMarkdown); } catch (_) {}

console.log("=================================================");
console.log("🎉 全部完成！高管精華會議紀錄已存至：");
console.log(`  - ${mdFile}`);
console.log(`  - ${mdDesktop}`);
console.log("=================================================");
