// Deno Script: Auto-Pairing & Dataset Builder for Continuous Alignment
// Searches for TrainingData locally or in parent folder
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";

let trainingDir = path.resolve("./TrainingData");
if (!existsSync(trainingDir)) {
  const parentTrainingDir = path.resolve("../TrainingData");
  if (existsSync(parentTrainingDir)) {
    trainingDir = parentTrainingDir;
  } else {
    try {
      Deno.mkdirSync(trainingDir, { recursive: true });
    } catch (_) {}
  }
}

function existsSync(filePath: string): boolean {
  try {
    Deno.statSync(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

console.log("==========================================================");
console.log("   🧠 亨創 AI 會議助理 - 自動配對與模型微調管線 (Git 整合版)");
console.log("==========================================================");
console.log(`數據目錄：${trainingDir}\n`);

const files: string[] = [];
try {
  for (const f of Deno.readDirSync(trainingDir)) {
    if (f.isFile && f.name.endsWith(".md")) {
      files.push(f.name);
    }
  }
} catch (e) {
  console.log("無法讀取 TrainingData 目錄：", (e as any).message);
  Deno.exit(1);
}

console.log(`目前 TrainingData 資料夾中共有 ${files.length} 個 Markdown 檔案。\n`);

// Group files by normalized topic name
const groups: Record<string, { draft?: string; chosen?: string }> = {};

for (const file of files) {
  let base = file.replace(/\.md$/, "");
  let isDraft = false;
  let isChosen = false;

  if (base.includes("_(地端初稿)") || base.includes("(地端初稿)")) {
    base = base.replace(/_?\(地端初稿\)/, "").trim();
    isDraft = true;
  } else if (
    base.includes("_(線上AI)") || base.includes("(線上AI)") ||
    base.includes("_(標準版)") || base.includes("(標準版)") ||
    base.includes("_(Claude)") || base.includes("(Claude)") ||
    base.includes("_(GPT)") || base.includes("(GPT)")
  ) {
    base = base.replace(/_?\((?:線上AI|標準版|Claude|GPT)\)/, "").trim();
    isChosen = true;
  } else {
    isDraft = true;
  }

  if (!groups[base]) groups[base] = {};
  if (isDraft) groups[base].draft = file;
  if (isChosen) groups[base].chosen = file;
}

const pairs: Array<{
  topic: string;
  draftFile: string;
  chosenFile: string;
  draftContent: string;
  chosenContent: string;
}> = [];

const missingChosen: string[] = [];
const missingDraft: string[] = [];

for (const [topic, g] of Object.entries(groups)) {
  if (g.draft && g.chosen) {
    try {
      const draftContent = Deno.readTextFileSync(path.join(trainingDir, g.draft));
      const chosenContent = Deno.readTextFileSync(path.join(trainingDir, g.chosen));
      pairs.push({
        topic,
        draftFile: g.draft,
        chosenFile: g.chosen,
        draftContent,
        chosenContent
      });
    } catch (_) {}
  } else if (g.draft && !g.chosen) {
    missingChosen.push(topic);
  } else if (!g.draft && g.chosen) {
    missingDraft.push(topic);
  }
}

console.log(`📊 【配對狀態總覽】：成功配對 [${pairs.length}] 組會議 | 待補齊 [${missingChosen.length + missingDraft.length}] 組\n`);

if (pairs.length > 0) {
  console.log("✅ 【已成功配對之黃金教材】：");
  pairs.forEach((p, idx) => {
    console.log(`  [${idx + 1}] ${p.topic}`);
    console.log(`      ├── 地端初稿 (Rejected): ${p.draftFile}`);
    console.log(`      └── 線上標準 (Chosen):   ${p.chosenFile}`);
  });
  console.log("");
}

if (missingChosen.length > 0) {
  console.log("⏳ 【缺少線上標準檔 (請丟入 _(線上AI).md)】：");
  missingChosen.forEach((m) => {
    console.log(`  - ${m} ➔ 請放入 "${m}_(線上AI).md"`);
  });
  console.log("");
}

// Export datasets
if (pairs.length > 0) {
  const dpoPath = path.join(trainingDir, "training_dpo.jsonl");
  const sftPath = path.join(trainingDir, "training_sft.jsonl");

  const dpoLines = pairs.map((p) =>
    JSON.stringify({
      topic: p.topic,
      prompt: `請將本場【${p.topic}】會議逐字稿整理為極簡一頁高管紀要：`,
      chosen: p.chosenContent,
      rejected: p.draftContent
    })
  );

  const sftLines = pairs.map((p) =>
    JSON.stringify({
      instruction: `你是上市公司執行長特助。請將本場【${p.topic}】會議逐字稿整理為標準一頁極簡高管紀要：`,
      input: `【逐字稿】：\n${p.draftContent}`,
      output: p.chosenContent
    })
  );

  Deno.writeTextFileSync(dpoPath, dpoLines.join("\n") + "\n");
  Deno.writeTextFileSync(sftPath, sftLines.join("\n") + "\n");

  console.log(`✨ 微調數據集已全自動建置完成！`);
  console.log(`   📁 DPO 強化學習數據集: ${dpoPath}`);
  console.log(`   📁 SFT 監督微調數據集: ${sftPath}`);
  console.log("");

  if (pairs.length < 5) {
    console.log(`💡 建議進度：目前已收集 ${pairs.length}/5 組。建議累積至 5 組以上啟動微調，效果最顯著！`);
  } else {
    console.log(`🎉 恭喜！目前已達標 ${pairs.length} 組黃金教材，已完全具備模型微調水準！`);
    console.log(`👉 您可直接執行 scripts/train_control_vector.ps1 或將 SFT 數據集送入 Colab 進行 LoRA 微調！`);
  }
} else {
  console.log("ℹ️ 提示：目前尚未偵測到成對的會議紀錄。");
  console.log("   請將線上 AI (Claude/ChatGPT) 整理好的檔案命名為：");
  console.log("   [主題]_(線上AI).md 並丟入 TrainingData 資料夾即可自動配對！");
}

console.log("\n==========================================================");
