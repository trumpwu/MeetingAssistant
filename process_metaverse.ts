import * as OpenCC from "npm:opencc-js";

const toTaiwanTraditional = OpenCC.Converter({ from: "cn", to: "tw" });
const senseVoiceCli = "D:\\project\\SenseVoice\\sherpa-onnx-v1.13.8-win-x64-shared-MT-Release\\bin\\sherpa-onnx-offline.exe";
const senseVoiceModel = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\model.int8.onnx";
const senseVoiceTokens = "D:\\project\\SenseVoice\\sherpa-onnx-sense-voice-funasr-nano-int8-2025-12-17\\tokens.txt";
const meetingsDir = "D:\\project\\Meetings";
const desktopDir = "C:\\Users\\Innovare\\Desktop";
const tempDir = "D:\\project\\temp_transcribe\\metaverse_chunks";

// 1. Scan and Sort Chunks
const chunkFiles: string[] = [];
for (const entry of Deno.readDirSync(tempDir)) {
  if (entry.isFile && entry.name.startsWith("chunk_") && entry.name.endsWith(".wav")) {
    chunkFiles.push(entry.name);
  }
}
chunkFiles.sort();
console.log(`Found ${chunkFiles.length} chunks to transcribe.`);

// 2. Transcribe each chunk with SenseVoice
console.log("Starting SenseVoice transcription...");
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
    console.log(`${timeLabel} (${i + 1}/${chunkFiles.length}): ${traditional.substring(0, 50)}...`);
    fullTranscriptLines.push(`${timeLabel} ${traditional}`);
  } else {
    console.log(`${timeLabel} (${i + 1}/${chunkFiles.length}): [靜音或無人聲]`);
  }
}

const finalFullTranscript = fullTranscriptLines.join("\n\n");
const transcriptFile = `${meetingsDir}\\2026-09-29_公司大會議室_元宇宙_(逐字稿).txt`;
const transcriptDesktop = `${desktopDir}\\2026-09-29_公司大會議室_元宇宙_(逐字稿).txt`;

Deno.writeTextFileSync(transcriptFile, finalFullTranscript);
try { Deno.writeTextFileSync(transcriptDesktop, finalFullTranscript); } catch (_) {}

console.log("=================================================");
console.log(`✨ 完整繁體中文逐字稿已儲存至：`);
console.log(`  - ${transcriptFile}`);
console.log(`  - ${transcriptDesktop}`);
console.log(`總段落數: ${fullTranscriptLines.length}, 總字數: ${finalFullTranscript.length}`);
console.log("=================================================");
