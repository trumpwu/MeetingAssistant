# 🎙️ AI 智慧會議記錄助理 (AI Meeting Assistant)

基於 **DeepSeek V4.1 Flash Free（OpenCode 免費雲端）** 與 **本地語音識別引擎** 的會議助理系統。

> **現行 LLM**：OpenCode Zen 免費模型 `opencode/deepseek-v4.1-flash-free`（經本機 `opencode serve` :4096）。  
> 語音轉錄（SenseVoice / Whisper）仍在本機；**會議摘要／翻譯會送上免費雲端**，免費期間資料可能用於模型改進——機密會議請改回本地 Qwen 或勿使用。

---

## 🌟 核心特色

1. **雙核心 AI 架構**：
   - **現場即時同傳**：麥克風／分頁音訊；英文即時英翻繁中；中文 SenseVoice + 同音詞庫 + Qwen 雙層校準。
   - **會議紀錄**：優先本機 Qwen 2.5（:8080）；未啟動時自動改用 **DeepSeek Free（OpenCode）**；亦可一鍵複製逐字稿貼 **Gemini**。
2. **🌐 一鍵打包**：複製繁中逐字稿（Gemini / NotebookLM 格式）與「一鍵產出正式會議紀錄」並存。
3. **👥 發言人對應**、**📧 Outlook / `scripts/export_to_outlook.ts`**、**會議專屬子資料夾存檔**。
4. **啟動**：`Start_MeetingAssistant.bat`（一般視窗）／`AI智慧會議助理_桌面版.bat`（`--app`）；核心邏輯在 `MeetingAssistant_StartCore.bat`（`curl` 健康檢查，不依賴 PATH 的 `powershell`）。
5. **健康檢查**：`http://127.0.0.1:18788/api/llm-status`（OpenCode 登入見 `OpenCode登入DeepSeek.bat`）。

---

## 🚀 快速開始

### 1. 安裝與部署 (首次使用)
雙擊執行 `install.bat`，系統將自動完成環境設定與 AI 模型下載。

### 2. 啟動軟體
雙擊桌面上的 **`AI智慧會議助理.exe`**，系統將自動以原生桌面視窗喚醒 AI 核心並秒開啟動。

### 3. 🧠 AI 模型持續進化與微調 (Data Flywheel)

1. 產出會議紀錄時，系統自動將初稿存於 `TrainingData/[主題]_(地端初稿).md`。
2. 將線上滿意版本存為 `TrainingData/[主題]_(線上AI).md`。
3. 雙擊執行 **`一鍵配對與模型訓練.bat`**，全自動生成 SFT 監督微調與 DPO 強化學習數據集！
4. 可使用 Google Colab 或地端 GPU 載入 `scripts/train_qwen_lora.ipynb` 進行 LoRA 微調，產出專屬 `.gguf` 格式模型。
5. 詳見完整微調手冊：[`docs/AI_TRAINING_GUIDE.md`](docs/AI_TRAINING_GUIDE.md)。

---

## 📁 目錄結構

```
D:\project\
├── MeetingAssistant\             # 前端介面、原生桌面執行檔與部署腳本
│   ├── AI智慧會議助理.exe        # 🖥️ Windows 原生桌面一鍵主程式
│   ├── 一鍵配對與模型訓練.bat    # 🧠 自動配對 SFT/DPO 數據集
│   ├── TrainingData/             # 📁 訓練數據收集目錄 (地端初稿 vs 線上AI)
│   ├── scripts/                  # 🛠️ 自動配對與表徵微調管線腳本
│   ├── docs/AI_TRAINING_GUIDE.md # 📖 模型訓練與數據飛輪完整指南
│   ├── Launcher.cs               # 原生 C# GUI 啟動器源碼
│   ├── index.html / app.js       # 單頁極速介面 (即時同傳 & 會議提煉)
│   ├── server.ts                 # 高效能 Deno 閘道伺服器 (Map-Reduce 引擎)
│   ├── install.bat               # 全自動安裝、模型下載與封裝腳本
│   └── push_to_github.bat        # GitHub 推送工具
├── llama.cpp\                    # AVX2 本地極速 LLM 推論與微調引擎
├── models\                       # 本地 AI 模型庫
│   └── qwen2.5-7b-instruct-q4_k_m.gguf
└── Meetings\                     # 會議紀錄與逐字稿自動存檔目錄
```

---

## 💡 專案緣起與協作模式 (Concept & Development)

> **「我是一面工作一面依照需求貢獻，希望有機會幫助到大家；我是概念，你幫我寫。」**
>
> *"I build and contribute as real needs arise from my daily work, hoping to help the community. I bring the concepts from the frontline; AI helps me craft the code."*
> — **Quanta Wu**

### 🇹🇼 中文說明 (Traditional Chinese)
* **💡 核心概念與需求定義 (Concept & Requirements)**：**Quanta Wu**
  - **痛點洞察**：解決高階商務會議與線上視訊即時同傳、冗長逐字稿難以快速提煉核心決策與行動清單的真實痛點。
  - **產品架構**：定義「雙核心即時同傳 + 1 頁高管精華提煉 + Outlook 富文本一鍵複製 + 100% 地端離線隱私」的完整產品 SOP。
* **🤖 程式碼撰寫與演算法工程 (AI Implementation)**：**Antigravity (Google DeepMind)**
  - 實作雙核心 Map-Reduce 精華提煉引擎、本地 Whisper/SenseVoice 語音推論管線、Deno 閘道伺服器與原生 C# 桌面啟動器。

---

### 🌐 English Overview & Story
* **💡 Concept, Requirements & Vision**: **Quanta Wu**
  - **Real-World Motivation**: Born from enterprise boardroom needs—eliminating the headache of manual transcription and noisy meeting notes while protecting corporate confidentiality.
  - **Architecture Design**: Combining ultra-fast live speech translation with a 1-page executive summary engine and 100% on-premise offline execution.
  - *Philosophy: Built through daily work challenges, contributed freely to the open-source community to empower others.*
* **🤖 Implementation & Engineering**: **Antigravity (Google DeepMind)**
  - Two-stage LLM distillation engine, offline speech recognition pipeline, and self-contained Windows desktop packaging.
