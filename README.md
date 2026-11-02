# 🎙️ AI 智慧會議記錄助理 (AI Meeting Assistant)

基於 **Qwen 2.5 7B Instruct (32K 超長上下文)** 與 **本地即時語音識別 / 翻譯引擎** 的高階離線商務會議助理系統。

---

## 🌟 核心特色

1. **🌍 NVIDIA Nemotron 3.5 (40 語系串流語音模型) 跨國多語同傳**：
   - 整合 NVIDIA 最新釋出的 **`nvidia/nemotron-3.5-asr-streaming-0.6b`** (40 國語言串流 ASR 模型) 與 **阿里 SenseVoice 50x 極速語音**。
   - 支援 **英文 (`en-US`)、日文 (`ja-JP`)、韓文 (`ko-KR`)、德文 (`de-DE`)、法文 (`fr-FR`)、西班牙文 (`es-ES`)、越南文 (`vi-VN`)、泰文 (`th-TH`) 及全球 40 語系自動偵測**，即時將外語發言翻譯為流暢地道的**台灣繁體中文**。
2. **🙈 智慧語系分流（中文自動隱藏逐字稿 • 外語自動顯示即時字幕與逐字稿）**：
   - **🇹🇼 中文會議模式**：預設自動遮蔽冗長的原始逐字稿畫面，於背景靜默收錄並即時統計字數，開完會直接點擊按鈕一鍵複製貼給 Gemini / Outlook / NotebookLM（亦保留臨時展開檢視開關）。
   - **🌐 外語多語系模式**：切換至任何外語時，自動展開「⚡ 外語 ➔ 繁中即時字幕列」與「完整繁中逐字稿視窗」，方便跨國會議即時閱讀。
3. **🎯 智慧上下文發言人歸納（告別單一麥克風 Speaker 亂跳）**：
   - 針對單一麥克風會議室場景，移除干擾的假性 `Speaker 1/2/3` 輪跳標籤；只需在步驟 1 填寫「👥 出席人員與單位」，複製 Prompt 貼給 Gemini 時即會自動結合對話上下文語意與出席名單精準歸納各方觀點與待辦負責人。
4. **🌐 全平台 AI 一鍵無縫對接（含綠色視覺確認橫幅）**：
   - 內建三大一鍵複製按鈕：**「📋 複製：貼給 Gemini (產出正式會議紀錄)」**、**「📧 複製：貼給 Gemini (產出 Outlook 極簡版)」**、**「📓 複製：NotebookLM 格式」**，點擊後按鈕立即變綠並顯示複製字數確認。
5. **📧 Outlook 富文本與 EML / HTML 一鍵匯出**：
   - 支援一鍵複製為標準 HTML 郵件格式，直接在 Outlook / Word 按 `Ctrl + V` 貼上，或使用 `scripts/export_to_outlook.ts` 匯出 `.eml` 郵件草稿與 `.html` 檔案。
6. **100% 離線隱私安全**：
   - 錄音檔、語音轉錄與話者分離均於本地端（Localhost）執行，保障企業資訊安全。
7. **一鍵跨電腦部署**：
   - 內建 `install.bat`，新電腦下載後雙擊即可自動拉取所有依賴、NeMo 引擎與 AI 模型。

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
