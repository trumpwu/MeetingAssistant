# 🧠 亨創 AI 會議助理 - 模型訓練與數據飛輪完整指南 (AI Training Guide)

本指南說明如何透過「數據飛輪 (Data Flywheel)」流程，將您滿意的「線上 AI (Claude / ChatGPT)」或人工修訂版本，全自動訓練並對齊到「地端 Qwen 2.5 7B 模型」中。

---

## 🚀 一、極簡工作流程 (3 步驟)

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                      🔄 亨創 AI 自動對齊與微調工作流 (Data Flywheel)                  │
├───────────────────┬───────────────────────────────────────────────────────────────────┤
│ 步驟 1：地端初稿  │ • 每次在會議助理產出並儲存會議紀錄時，系統自動存放至：            │
│       (全自動)    │   📁 `TrainingData/[主題]_(地端初稿).md`                          │
├───────────────────┼───────────────────────────────────────────────────────────────────┤
│ 步驟 2：線上標準  │ • 將線上 AI (Claude/ChatGPT) 產出的滿意版本命名為：               │
│                   │   📁 `TrainingData/[主題]_(線上AI).md`                            │
│                   │ • 直接存入 `TrainingData/` 資料夾！                               │
├───────────────────┼───────────────────────────────────────────────────────────────────┤
│ 步驟 3：一鍵配對  │ • 雙擊執行根目錄的 **`【一鍵配對與模型訓練.bat】`**                │
│                   │ • 系統自動配對同名檔案，生成標準微調訓練集！                      │
└───────────────────┴───────────────────────────────────────────────────────────────────┘
```

---

## 📊 二、產出的訓練數據集規格

執行 `一鍵配對與模型訓練.bat` 後，系統會自動在 `TrainingData/` 目錄生成兩大主流格式：

1. **`training_sft.jsonl` (監督微調格式 - 適用於 LoRA / SFT)**：
   ```json
   {
     "instruction": "你是上市公司執行長特助。請將本場會議逐字稿整理為標準一頁極簡高管紀要：",
     "input": "【逐字稿】：（地端初稿/逐字稿內容）",
     "output": "（線上AI/黃金標準內容）"
   }
   ```
2. **`training_dpo.jsonl` (偏好強化學習格式 - 適用於 DPO / RLHF)**：
   ```json
   {
     "topic": "會議主題",
     "prompt": "請將本場會議逐字稿整理為極簡一頁高管紀要：",
     "chosen": "（線上AI黃金內容 - 正向獎勵）",
     "rejected": "（地端初稿口語內容 - 負向懲罰）"
   }
   ```

---

## 🛠️ 三、兩種模型訓練模式

### 模式 A：本機 CPU 表徵控制向量訓練 (5~10 組會議即可，耗時 3 分鐘)
* **適用情境**：純 CPU 筆電環境，不需 GPU 顯卡。
* **執行方法**：
  在 PowerShell 執行：
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\train_control_vector.ps1
  ```
* **效果**：生成 `hengchuang_style.gguf` 控制向量，在神經網路激發層面強制注入高管精煉風格。

---

### 模式 B：Google Colab 免費 GPU 微調 (20~30 組會議，耗時 25 分鐘)
* **適用情境**：追求 100% 媲美雲端大型模型的高質量權重微調。
* **步驟**：
  1. 打開 Google Colab 免費 T4 GPU 環境。
  2. 使用開源最速微調框架 **Unsloth**：
     ```python
     !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
     from unsloth import FastLanguageModel
     model, tokenizer = FastLanguageModel.from_pretrained(
         model_name = "Qwen/Qwen2.5-7B-Instruct",
         max_seq_length = 4096,
         load_in_4bit = True,
     )
     # 載入 training_sft.jsonl 進行 LoRA 訓練
     ```
  3. 將訓練後的 `adapter.gguf` 下載回本機 `D:\project\models\`，啟動時帶入 `--lora adapter.gguf` 即可永久生效！

---

## 📁 四、目錄結構說明

```text
MeetingAssistant/
├── TrainingData/                 <-- 數據收集目錄 (已納入 Git 結構)
│   ├── .gitkeep
│   ├── [主題]_(地端初稿).md     <-- 地端產出初稿
│   └── [主題]_(線上AI).md       <-- 您滿意的線上 AI 成果
├── scripts/
│   ├── build_and_train.ts       <-- 全自動配對與數據集生成腳本
│   └── train_control_vector.ps1 <-- 本機控制向量訓練器
├── 一鍵配對與模型訓練.bat       <-- 雙擊立即自動配對
└── docs/
    └── AI_TRAINING_GUIDE.md     <-- 本訓練指南
```
