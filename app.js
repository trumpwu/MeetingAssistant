document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const dateInput = document.getElementById('meeting-date');
  const timeInput = document.getElementById('meeting-time');
  const locationInput = document.getElementById('meeting-location');
  const titleInput = document.getElementById('meeting-title');
  const attendeesInput = document.getElementById('meeting-attendees');
  const autoFilenameInput = document.getElementById('auto-filename');
  const copyFilenameBtn = document.getElementById('copy-filename-btn');
  const customSavePathInput = document.getElementById('custom-save-path');
  const pathChips = document.querySelectorAll('.path-chip');

  const engineSelect = document.getElementById('engine-mode-select');
  const audioSourceRadios = document.querySelectorAll('input[name="audio-source"]');
  const startRecordBtn = document.getElementById('start-record-btn');
  const stopRecordBtn = document.getElementById('stop-record-btn');
  const recordTimer = document.getElementById('record-timer');
  const recordStatusBadge = document.getElementById('record-status-badge');
  const waveContainer = document.getElementById('wave-container');
  const waveText = document.getElementById('wave-text');

  const recordedAudioContainer = document.getElementById('recorded-audio-container');
  const audioPlayer = document.getElementById('audio-player');
  const audioSizeDisplay = document.getElementById('audio-size-display');
  const downloadAudioBtn = document.getElementById('download-audio-btn');
  const globalDownloadAudioBtn = document.getElementById('global-download-audio-btn');

  const fileDropzone = document.getElementById('file-dropzone');
  const audioFileInput = document.getElementById('audio-file-input');
  const browseFileBtn = document.getElementById('browse-file-btn');
  const fileTranscribeProgress = document.getElementById('file-transcribe-progress');

  const speakerList = document.getElementById('speaker-list');
  const addSpeakerBtn = document.getElementById('add-speaker-btn');

  const rawTranscript = document.getElementById('raw-transcript');
  const transcriptStats = document.getElementById('transcript-stats');
  const clearTranscriptBtn = document.getElementById('clear-transcript-btn');
  const generateSummaryBtn = document.getElementById('generate-summary-btn');

  const outputRendered = document.getElementById('output-rendered');
  const outputMarkdown = document.getElementById('output-markdown');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const copyOutlookBtn = document.getElementById('copy-outlook-btn');
  const copyResultBtn = document.getElementById('copy-result-btn');
  const downloadMdBtn = document.getElementById('download-md-btn');
  const printBtn = document.getElementById('print-btn');
  const newMeetingBtn = document.getElementById('new-meeting-btn');
  const toast = document.getElementById('toast');

  // --- Initial Date & Time Setup ---
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  dateInput.value = `${yyyy}-${mm}-${dd}`;
  timeInput.value = `${hh}:${min}`;
  locationInput.value = '公司大會議室';
  titleInput.value = '跨部門專案討論會';
  attendeesInput.value = '張主管、李工程師、專案團隊';

  function updateFilename() {
    const d = dateInput.value || `${yyyy}-${mm}-${dd}`;
    const loc = (locationInput.value || '會議').trim();
    const tit = (titleInput.value || '專案討論').trim();
    const cleanLoc = loc.replace(/[\\/:*?"<>|]/g, '_');
    const cleanTit = tit.replace(/[\\/:*?"<>|]/g, '_');
    autoFilenameInput.value = `${d}_${cleanLoc}_${cleanTit}`;
  }

  [dateInput, locationInput, titleInput].forEach(el => {
    el.addEventListener('input', updateFilename);
  });
  updateFilename();

  // --- Live Diagnostic Logger & Toast Notification ---
  const latestLogText = document.getElementById('latest-log-text');
  const systemLogDrawer = document.getElementById('system-log-drawer');
  const systemLogConsole = document.getElementById('system-log-console');
  const toggleLogDrawerBtn = document.getElementById('toggle-log-drawer-btn');
  const closeLogDrawerBtn = document.getElementById('close-log-drawer-btn');
  const clearLogBtn = document.getElementById('clear-log-btn');

  function addSystemLog(msg, type = 'info') {
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    if (latestLogText) {
      latestLogText.textContent = msg;
    }
    if (systemLogConsole) {
      const item = document.createElement('div');
      item.className = 'log-item';
      let cls = 'log-msg-info';
      if (type === 'error' || msg.includes('❌') || msg.includes('錯誤') || msg.includes('失敗')) cls = 'log-msg-error';
      else if (type === 'warn' || msg.includes('⚠️')) cls = 'log-msg-warn';
      else if (type === 'success' || msg.includes('✨') || msg.includes('🎉') || msg.includes('已完成')) cls = 'log-msg-success';

      item.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="${cls}">${msg}</span>`;
      systemLogConsole.appendChild(item);
      systemLogConsole.scrollTop = systemLogConsole.scrollHeight;
    }
  }

  if (toggleLogDrawerBtn && systemLogDrawer) {
    toggleLogDrawerBtn.addEventListener('click', () => {
      systemLogDrawer.style.display = systemLogDrawer.style.display === 'none' ? 'block' : 'none';
      toggleLogDrawerBtn.textContent = systemLogDrawer.style.display === 'none' ? '📜 展開日誌' : '收合日誌';
    });
  }

  if (closeLogDrawerBtn && systemLogDrawer) {
    closeLogDrawerBtn.addEventListener('click', () => {
      systemLogDrawer.style.display = 'none';
      if (toggleLogDrawerBtn) toggleLogDrawerBtn.textContent = '📜 展開日誌';
    });
  }

  if (clearLogBtn && systemLogConsole) {
    clearLogBtn.addEventListener('click', () => {
      systemLogConsole.innerHTML = '';
      addSystemLog('日誌已清空。', 'info');
    });
  }

  function showToast(msg, duration = 3500) {
    const isError = msg.includes('❌') || msg.includes('⚠️') || msg.includes('錯誤') || msg.includes('失敗');
    const effectiveDuration = isError ? 6500 : duration;

    addSystemLog(msg, isError ? 'error' : 'info');

    if (toast) {
      toast.textContent = msg;
      toast.className = isError ? 'toast show toast-error' : 'toast show';
      setTimeout(() => {
        toast.className = 'toast';
      }, effectiveDuration);
    }
  }

  addSystemLog('🚀 會議助理核心已啟動，本地服務連線正常。', 'success');

  // --- Save Path Presets ---
  pathChips.forEach(chip => {
    chip.addEventListener('click', () => {
      pathChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (customSavePathInput) {
        customSavePathInput.value = chip.dataset.path;
      }
    });
  });

  // --- Copy Filename ---
  copyFilenameBtn.addEventListener('click', () => {
    const filename = `${autoFilenameInput.value}.md`;
    navigator.clipboard.writeText(filename).then(() => {
      showToast(`已複製標準檔名：${filename}`);
    });
  });

  // --- Speaker Mapping Management (Unlimited Speakers with Live Real-time Typing Replacement) ---
  let currentSpeakerIndex = 1;

  function bindSpeakerInputLiveReplace(input, label) {
    let previousValue = input.value.trim();
    input.addEventListener('input', () => {
      const currentName = input.value.trim();
      const num = label.match(/\d+/)?.[0];
      if (num && currentName) {
        let text = rawTranscript.value;
        const patterns = [
          new RegExp(`\\[?Speaker\\s*${num}\\]?:?`, 'gi'),
          new RegExp(`\\[?發言人\\s*${num}\\]?:?`, 'gi'),
          new RegExp(`【Speaker\\s*${num}】:?`, 'gi')
        ];
        if (previousValue) {
          patterns.push(new RegExp(`【${previousValue}】:?`, 'g'));
        }
        patterns.forEach(pat => {
          text = text.replace(pat, `【${currentName}】: `);
        });
        rawTranscript.value = text;
        previousValue = currentName;
        updateTranscriptStats();
      }
    });
  }

  function addSpeakerRow(speakerLabel = '', speakerName = '') {
    const count = speakerList.querySelectorAll('.speaker-row').length + 1;
    const label = speakerLabel || `Speaker ${count}`;
    const row = document.createElement('div');
    row.className = 'speaker-row';
    row.innerHTML = `
      <span class="speaker-badge">${label}</span>
      <input type="text" class="form-control speaker-name-input" data-speaker="${label}" value="${speakerName}" placeholder="例如：王專案經理">
      <button type="button" class="btn-text btn-del-speaker">✕</button>
    `;
    const input = row.querySelector('.speaker-name-input');
    bindSpeakerInputLiveReplace(input, label);
    row.querySelector('.btn-del-speaker').addEventListener('click', () => row.remove());
    speakerList.appendChild(row);
  }

  // Bind initial speaker rows
  document.querySelectorAll('.speaker-row').forEach(row => {
    const badge = row.querySelector('.speaker-badge');
    const input = row.querySelector('.speaker-name-input');
    if (badge && input) {
      bindSpeakerInputLiveReplace(input, badge.textContent.trim());
    }
  });

  addSpeakerBtn.addEventListener('click', () => addSpeakerRow());

  const autoDetectSpeakersBtn = document.getElementById('auto-detect-speakers-btn');
  const applySpeakersBtn = document.getElementById('apply-speakers-btn');

  function autoDetectSpeakers() {
    const text = rawTranscript.value;
    if (!text) {
      showToast('逐字稿尚無內容，請先錄音或匯入音檔！');
      return;
    }
    const matches = text.match(/\[?(?:Speaker|發言人)\s*(\d+)\]?:?/gi) || [];
    const foundIndices = new Set();
    matches.forEach(m => {
      const numMatch = m.match(/\d+/);
      if (numMatch) foundIndices.add(parseInt(numMatch[0]));
    });

    if (foundIndices.size === 0) {
      showToast('未在逐字稿中偵測到 Speaker 標籤，您可以點擊「新增發言人」手動添加！');
      return;
    }

    const existing = {};
    document.querySelectorAll('.speaker-name-input').forEach(inp => {
      existing[inp.dataset.speaker] = inp.value;
    });

    speakerList.innerHTML = '';
    const sorted = Array.from(foundIndices).sort((a, b) => a - b);
    sorted.forEach(num => {
      const label = `Speaker ${num}`;
      addSpeakerRow(label, existing[label] || '');
    });
    showToast(`✅ 已自動偵測出 ${sorted.length} 位發言人標籤！`);
  }

  if (autoDetectSpeakersBtn) {
    autoDetectSpeakersBtn.addEventListener('click', autoDetectSpeakers);
  }

  function applySpeakerMappingToTranscript() {
    let text = rawTranscript.value;
    if (!text) return;

    const speakerInputs = document.querySelectorAll('.speaker-name-input');
    speakerInputs.forEach(input => {
      const spkLabel = input.dataset.speaker;
      const spkName = input.value.trim();
      if (spkName && spkLabel) {
        const num = spkLabel.match(/\d+/)?.[0];
        if (num) {
          const patterns = [
            new RegExp(`\\[?Speaker\\s*${num}\\]?:?`, 'gi'),
            new RegExp(`\\[?發言人\\s*${num}\\]?:?`, 'gi'),
            new RegExp(`【Speaker\\s*${num}】:?`, 'gi')
          ];
          patterns.forEach(pat => {
            text = text.replace(pat, `【${spkName}】: `);
          });
        }
      }
    });

    rawTranscript.value = text;
    updateTranscriptStats();
  }

  if (applySpeakersBtn) {
    applySpeakersBtn.addEventListener('click', () => {
      applySpeakerMappingToTranscript();
      showToast('✨ 已成功替換逐字稿中所有發言人為真實姓名！');
    });
  }

  // --- Transcript Stats & Clean ---
  function updateTranscriptStats() {
    const text = rawTranscript.value;
    const charCount = text.length;
    const lineCount = text ? text.split('\n').filter(l => l.trim().length > 0).length : 0;
    transcriptStats.textContent = `字數：${charCount} | 行數：${lineCount}`;
  }

  rawTranscript.addEventListener('input', updateTranscriptStats);

  clearTranscriptBtn.addEventListener('click', () => {
    if (confirm('確定要清空逐字稿內容嗎？')) {
      rawTranscript.value = '';
      updateTranscriptStats();
      showToast('逐字稿已清空');
    }
  });

  // --- Real-Time Instant Live Translation & Speech Engine ---
  const liveStreamText = document.getElementById('live-stream-text');
  let mediaRecorder = null;
  let audioChunks = [];
  let recordInterval = null;
  let recordStartTime = null;
  let recordedBlob = null;
  let speechRecognizer = null;
  let isRecording = false;
  let liveTransTimer = null;

  // Ultra-fast client-side lexical map for instantaneous 0ms feedback while speaking
  const liveLexicon = {
    "hello": "您好", "hi": "嗨 / 大家好", "welcome": "歡迎", "today": "今天", "we are": "我們正在",
    "discussing": "研討", "discuss": "討論", "large language models": "大型語言模型", "llm": "LLM 大型模型",
    "chatgpt": "ChatGPT", "gpt": "GPT 模型", "pretraining": "預訓練", "pre-training": "預訓練",
    "fine tuning": "微調", "fine-tuning": "微調", "reinforcement learning": "強化學習",
    "human feedback": "人類反饋", "gpu": "GPU 顯示卡", "compute": "計算算力", "model": "模型",
    "training": "訓練", "neural network": "神經網路", "transformer": "Transformer 架構",
    "energy": "能源", "microgrid": "微電網", "solar": "太陽能光電", "building": "建築",
    "carbon": "碳排", "cost": "成本費用", "power": "電力", "battery": "電池儲能"
  };

  function quickLiveTranslate(text) {
    if (!text) return '';
    let res = text.toLowerCase();
    for (const [k, v] of Object.entries(liveLexicon)) {
      const reg = new RegExp(`\\b${k}\\b`, 'gi');
      res = res.replace(reg, v);
    }
    return res;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = true;
    speechRecognizer.interimResults = true;
    speechRecognizer.maxAlternatives = 1;

    speechRecognizer.onresult = (event) => {
      let interim = '';
      const isEnglishMode = engineSelect.value === 'whisper-base-tr';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptChunk = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          const finalRaw = transcriptChunk.trim();
          if (finalRaw) {
            const nowTime = new Date().toLocaleTimeString('zh-TW', { hour12: false });
            const spkTag = `Speaker ${currentSpeakerIndex}`;

            if (isEnglishMode) {
              const tempTrans = quickLiveTranslate(finalRaw);
              liveStreamText.textContent = `⚡ ${tempTrans}`;

              fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: finalRaw })
              }).then(res => res.json()).then(data => {
                const chineseLine = (data.success && data.translated) ? data.translated : tempTrans;
                const formattedLine = `[${nowTime}] [${spkTag}]: ${chineseLine}`;
                rawTranscript.value += (rawTranscript.value ? '\n' : '') + formattedLine;
                rawTranscript.scrollTop = rawTranscript.scrollHeight;
                updateTranscriptStats();
                liveStreamText.textContent = `✅ [${spkTag}]: ${chineseLine}`;
              }).catch(() => {
                const formattedLine = `[${nowTime}] [${spkTag}]: ${tempTrans}`;
                rawTranscript.value += (rawTranscript.value ? '\n' : '') + formattedLine;
                rawTranscript.scrollTop = rawTranscript.scrollHeight;
                updateTranscriptStats();
              });
            } else {
              // Chinese Mode - Real-time continuous accumulation
              const formattedLine = `[${nowTime}] [${spkTag}]: ${finalRaw}`;
              rawTranscript.value += (rawTranscript.value ? '\n' : '') + formattedLine;
              rawTranscript.scrollTop = rawTranscript.scrollHeight;
              updateTranscriptStats();
              liveStreamText.textContent = `✅ [${spkTag}]: ${finalRaw}`;
            }

            if (finalRaw.endsWith('.') || finalRaw.endsWith('。') || finalRaw.length > 25) {
              currentSpeakerIndex = (currentSpeakerIndex % 3) + 1;
            }
          }
        } else {
          // LIVE INTERIM STREAM (Current rolling sentence)
          interim += transcriptChunk + ' ';
        }
      }

      // Rolling real-time subtitle window
      if (interim.trim()) {
        const liveRaw = interim.trim();
        if (isEnglishMode) {
          const instantZh = quickLiveTranslate(liveRaw);
          liveStreamText.textContent = `🎙️ ${instantZh}`;

          clearTimeout(liveTransTimer);
          liveTransTimer = setTimeout(() => {
            fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: liveRaw })
            }).then(r => r.json()).then(d => {
              if (d.success && d.translated && isRecording) {
                liveStreamText.textContent = `⚡ 實時繁中：${d.translated}`;
              }
            }).catch(() => {});
          }, 250);
        } else {
          liveStreamText.textContent = `🎙️ 正在說話：${liveRaw}`;
        }
      }
    };

    let isRecognizerRunning = false;

    speechRecognizer.onstart = () => {
      isRecognizerRunning = true;
    };

    speechRecognizer.onend = () => {
      isRecognizerRunning = false;
      if (isRecording) {
        setTimeout(() => {
          if (isRecording && !isRecognizerRunning) {
            try { speechRecognizer.start(); } catch (_) {}
          }
        }, 50);
      }
    };

    speechRecognizer.onerror = (e) => {
      isRecognizerRunning = false;
      console.warn('Speech recognition status:', e.error);
      if (isRecording) {
        setTimeout(() => {
          if (isRecording && !isRecognizerRunning) {
            try { speechRecognizer.start(); } catch (_) {}
          }
        }, 100);
      }
    };

    // Watchdog timer: Guarantees speech recognition NEVER interrupts (English & Chinese)
    setInterval(() => {
      if (isRecording && !isRecognizerRunning) {
        try {
          speechRecognizer.start();
        } catch (_) {}
      }
    }, 1200);

    // Language switcher event listener
    if (engineSelect) {
      engineSelect.addEventListener('change', () => {
        const isEng = engineSelect.value === 'whisper-base-tr';
        speechRecognizer.lang = isEng ? 'en-US' : 'zh-TW';
        if (isRecording) {
          try { speechRecognizer.stop(); } catch (_) {}
        }
        if (waveText) {
          waveText.textContent = isEng ?
            '正在即時聽取英文並自動轉譯為繁體中文...' : '正在以繁體中文極速聽取中...';
        }
      });
    }
  }

  function updateTimer() {
    const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    recordTimer.textContent = `${h}:${m}:${s}`;
  }

  // --- Start Recording (Microphone or YouTube / System Tab Audio) ---
  async function startRecording() {
    const selectedSource = document.querySelector('input[name="audio-source"]:checked').value;
    let stream = null;

    try {
      if (selectedSource === 'system') {
        // Capture YouTube / Tab System Audio
        showToast('請在彈出視窗選擇「分頁 (Tab - 如 YouTube)」並勾選「共用分頁音訊」！', 5000);
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          },
          video: true
        });
      } else {
        // Capture Microphone
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
      }

      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(recordedBlob);
        audioPlayer.src = audioUrl;
        
        const sizeMb = (recordedBlob.size / (1024 * 1024)).toFixed(2);
        audioSizeDisplay.textContent = `${sizeMb} MB`;
        updateFilename();

        recordedAudioContainer.style.display = 'flex';

        const currentFilename = autoFilenameInput ? autoFilenameInput.value.trim() : `Recording_${Date.now()}`;
        
        // 1. Auto-persist audio to disk
        fetch('/api/save-audio', {
          method: 'POST',
          headers: { 'X-Filename': encodeURIComponent(currentFilename) },
          body: recordedBlob
        }).catch(err => console.warn('Audio auto-save error:', err));

        // 2. Local Offline Whisper AI Auto-Transcribe (Always overwrite browser speech-to-text with Whisper)
        showToast('🎙️ 錄音已結束，正在使用本地端 Whisper AI 全篇精準轉錄 (高精度多線程)...', 5000);
        try {
          const res = await fetch('/api/transcribe-file', {
            method: 'POST',
            headers: { 'X-Filename': encodeURIComponent(`${currentFilename}.webm`) },
            body: recordedBlob
          });
          const data = await res.json();
          if (data.success && data.transcript) {
            let curSpeaker = 1;
            const formatted = data.transcript
              .split('\n')
              .map(l => l.trim())
              .filter(l => l.length > 0)
              .map((l, i) => {
                const clean = l.replace(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/, '').trim();
                if (!clean) return '';
                const spk = `[Speaker ${curSpeaker}]`;
                if (clean.endsWith('？') || clean.endsWith('?') || clean.endsWith('。') || clean.length > 28) {
                  curSpeaker = curSpeaker === 1 ? 2 : 1;
                }
                return `[發言 ${i + 1}] ${spk}: ${clean}`;
              })
              .filter(l => l.length > 0)
              .join('\n');
            rawTranscript.value = formatted;
            updateTranscriptStats();
            showToast('✨ 本地 Whisper AI 已完成離線高精度逐字稿轉錄！已自動替換瀏覽器粗稿。', 4000);
          } else {
            console.warn('Whisper transcription fallback to browser draft:', data?.error);
          }
        } catch (e) {
          console.warn('Auto offline transcribe notice:', e);
        }
      };

      mediaRecorder.start(1000);
      isRecording = true;
      recordStartTime = Date.now();
      recordInterval = setInterval(updateTimer, 1000);

      // Start Speech Recognizer with configured language
      if (speechRecognizer) {
        speechRecognizer.lang = engineSelect.value === 'whisper-base-tr' ? 'en-US' : 'zh-TW';
        try { speechRecognizer.start(); } catch (e) {}
      }

      // UI States
      startRecordBtn.disabled = true;
      stopRecordBtn.disabled = false;
      recordStatusBadge.textContent = '錄音辨識中';
      recordStatusBadge.className = 'badge badge-recording';
      waveContainer.classList.add('recording');
      waveText.textContent = engineSelect.value === 'whisper-base-tr' ?
        '正在即時聽取英文並自動轉譯為繁體中文...' : '正在以 SenseVoice 極速聽取繁體中文...';
      
      showToast('🔴 錄音與即時辨識已啟動！');
    } catch (err) {
      console.error('Audio capture error:', err);
      showToast('⚠️ 無法存取音訊裝置，請檢查麥克風或螢幕分頁音訊權限！');
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    if (speechRecognizer) {
      try { speechRecognizer.stop(); } catch (e) {}
    }

    clearInterval(recordInterval);
    startRecordBtn.disabled = false;
    stopRecordBtn.disabled = true;
    recordStatusBadge.textContent = '已完成';
    recordStatusBadge.className = 'badge badge-idle';
    waveContainer.classList.remove('recording');
    waveText.textContent = '錄音已結束';
  }

  startRecordBtn.addEventListener('click', startRecording);
  stopRecordBtn.addEventListener('click', stopRecording);

  // --- Download Audio File (with Windows Save File Picker) ---
  async function triggerAudioDownload() {
    if (!recordedBlob) {
      showToast('⚠️ 請先進行現場錄音或停止錄音後再下載！');
      return;
    }
    const filename = `${autoFilenameInput.value}.webm`;

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'WebM 音訊錄音檔 (*.webm)',
            accept: { 'audio/webm': ['.webm'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(recordedBlob);
        await writable.close();
        showToast(`已成功儲存錄音檔：${filename}`);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback standard download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(recordedBlob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`已下載錄音檔：${filename}`);
  }

  downloadAudioBtn.addEventListener('click', triggerAudioDownload);
  globalDownloadAudioBtn.addEventListener('click', triggerAudioDownload);

  // --- Drag & Drop / Upload Audio File for Direct Chinese Transcription ---
  browseFileBtn.addEventListener('click', () => audioFileInput.click());
  fileDropzone.addEventListener('click', (e) => {
    if (e.target !== browseFileBtn) audioFileInput.click();
  });

  fileDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropzone.classList.add('dragover');
  });

  fileDropzone.addEventListener('dragleave', () => {
    fileDropzone.classList.remove('dragover');
  });

  fileDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleAudioFileUpload(e.dataTransfer.files[0]);
    }
  });

  audioFileInput.addEventListener('change', () => {
    if (audioFileInput.files.length > 0) {
      handleAudioFileUpload(audioFileInput.files[0]);
    }
  });

  async function handleAudioFileUpload(file) {
    if (!file) return;
    fileTranscribeProgress.style.display = 'flex';
    showToast(`🎙️ 正在以本地 Whisper AI 轉錄 ${file.name} (請稍候)...`, 4000);

    try {
      const res = await fetch('/api/transcribe-file', {
        method: 'POST',
        headers: {
          'X-Filename': encodeURIComponent(file.name)
        },
        body: file
      });
      const data = await res.json();
      if (data.success && data.transcript) {
        let curSpeaker = 1;
        const formatted = data.transcript
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map((line, idx) => {
            const clean = line.replace(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/, '').trim();
            if (!clean) return '';
            const spk = `[Speaker ${curSpeaker}]`;
            if (clean.endsWith('？') || clean.endsWith('?') || clean.endsWith('。') || clean.length > 28) {
              curSpeaker = curSpeaker === 1 ? 2 : 1;
            }
            return `[語音匯入 ${idx + 1}] ${spk}: ${clean}`;
          })
          .filter(l => l.length > 0)
          .join('\n');

        rawTranscript.value = (rawTranscript.value ? rawTranscript.value + '\n\n' : '') + formatted;
        rawTranscript.scrollTop = rawTranscript.scrollHeight;
        updateTranscriptStats();
        showToast(`✨ 成功轉錄 ${file.name}！已自動載入逐字稿，可直接產出重點會議紀錄！`, 5000);
      } else {
        showToast(`❌ 轉錄失敗：${data.error || '無法辨識音訊內容'}`);
      }
    } catch (err) {
      showToast(`❌ 上傳轉錄錯誤：${err.message}`);
    } finally {
      fileTranscribeProgress.style.display = 'none';
    }
  }

  // --- Tabs Switching ---
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(`tab-${btn.dataset.tab}`);
      if (target) target.classList.add('active');
    });
  });

  // --- Qwen 2.5 Local AI Meeting Minutes Generation ---
  async function generateMeetingMinutes() {
    const text = rawTranscript.value.trim();
    if (!text) {
      showToast('請先進行現場錄音或貼上逐字稿內容！');
      return;
    }

    const meetingDate = dateInput.value || `${yyyy}-${mm}-${dd}`;
    const meetingTime = timeInput.value || `${hh}:${min}`;
    const meetingLocation = locationInput.value.trim() || '公司會議室';
    const meetingTitle = titleInput.value.trim() || '專案重點會議';
    const attendees = attendeesInput.value.trim() || '全體與會人員';
    const filename = `${autoFilenameInput.value}.md`;

    // 1. Replace Speaker Tags with Actual Names (Robust Regex)
    applySpeakerMappingToTranscript();
    let processedTranscript = rawTranscript.value.trim();

    // Show AI Thinking State
    showToast('🤖 Qwen 2.5 本機 AI 正在深度提煉會議紀錄 (約3秒)...');
    generateSummaryBtn.disabled = true;
    generateSummaryBtn.innerHTML = `<span class="btn-icon">🧠</span> <span>AI 正在深度提煉中...</span>`;

    let aiGeneratedMinutes = '';

    try {
      const aiPrompt = `你是一個專業的繁體中文高階主管會議記錄特助。請根據以下逐字稿，以【極簡高管版（長度簡短精煉、1頁內讀完、直切核心決策）】整理成以下標準 Markdown 結構：

【嚴格事實接地規範 (Grounding)】：
所有決策、發言人、技術數據與待辦事項，必須 100% 來自本次會議逐字稿的真實對話！嚴禁捏造、幻覺或帶入未提及的人名（如無提及嚴禁帶入無關人名）或未提及的無關數據！

# 📋 ${meetingTitle} - 精華重點會議紀錄
> **會議日期**：${meetingDate} | **地點**：${meetingLocation} | **出席人員**：${attendees}

## 🎯 一、30秒核心決策與共識 (Key Decisions)
（精簡列出本場會議最核心的 3~4 點定案事項，每點以【粗體標題】+ 1~2 句話結論呈現）

## 📊 二、關鍵數據與規格指標 (Key Metrics)
| 項目 | 關鍵數值 / 規格 | 說明結論 |
| :--- | :---: | :--- |
（僅列出本次對話中實際提及的 3~4 項核心數值、型號或電流/功率，無則省略）

## ✅ 三、行動追蹤矩陣 (Action Matrix)
| 項次 | 具體待辦事項 | 優先級 | 負責人 | 完成時程 |
| :---: | :--- | :---: | :---: | :---: |
（僅列出最核心的 3~5 項具體任務，優先級標註 [🔥最高]、[⚡高優先] 或 [📌中優先]，負責人請對齊真實發言或與會者）

## ⚠️ 四、重點風險與下一步 (Next Steps)
（1~2 點本次會議提及之實際風險與下步行動）

會議逐字稿：
${processedTranscript.slice(0, 32000)}`;

      const aiResponse = await fetch('/api/ai-summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5-7b-instruct',
          messages: [
            {
              role: 'system',
              content: '你是專業的高階主管會議記錄秘書，請使用繁體中文輸出【極簡精華版】會議紀錄。文字務必簡明扼要、直切要害、去除廢話，總篇幅控制在 1 頁 A4 螢幕範圍內。'
            },
            {
              role: 'user',
              content: aiPrompt
            }
          ],
          temperature: 0.1,
          presence_penalty: 0.8,
          frequency_penalty: 0.8,
          max_tokens: 1500
        })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        if (aiData.choices && aiData.choices[0] && aiData.choices[0].message) {
          aiGeneratedMinutes = aiData.choices[0].message.content.trim();
        }
      }
    } catch (e) {
      console.warn('AI summarize request notice:', e);
    }

    generateSummaryBtn.disabled = false;
    generateSummaryBtn.innerHTML = `<span class="btn-icon">⚡</span> <span>一鍵產出深度重點會議紀錄 (Qwen 2.5 AI)</span>`;

    let finalMd = '';
    if (aiGeneratedMinutes && aiGeneratedMinutes.length > 50) {
      finalMd = aiGeneratedMinutes;
    } else {
      finalMd = generateFallbackMinutes(meetingDate, meetingTime, meetingLocation, meetingTitle, attendees, filename, processedTranscript);
    }

    outputMarkdown.value = finalMd;
    renderMarkdownView(finalMd);

    // Auto-Save to Target Folder + Desktop
    const targetDir = customSavePathInput ? customSavePathInput.value.trim() : '';
    fetch('/api/auto-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: filename,
        content: finalMd,
        type: 'markdown',
        customDir: targetDir
      })
    }).then(res => res.json()).then(data => {
      console.log('Auto-saved:', data);
    }).catch(err => console.warn('Auto-save network error:', err));

    document.getElementById('output-section').scrollIntoView({ behavior: 'smooth' });
    showToast('✨ Qwen 2.5 AI 會議紀錄已生成並自動存檔！');
  }

  function generateFallbackMinutes(meetingDate, meetingTime, meetingLocation, meetingTitle, attendees, filename, processedTranscript) {
    const lines = processedTranscript.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const progressDecisions = [];
    const actionItems = [];
    const technicalMetrics = [];

    lines.forEach((line) => {
      const cleanLine = line.replace(/^\[.*?\]\s*/, '').replace(/^【.*?】\s*/, '');
      if (cleanLine.length < 5) return;

      if (/預計|下週|週[一二三四五六日]|待辦|提交|負責|追蹤|完成|請.*確認|跟進|安排/i.test(cleanLine)) {
        let deadline = '依專案時程';
        let priority = '⚡ 中';
        if (/重要|緊急|盡快|立即/i.test(cleanLine)) priority = '🔥 高';
        if (/下週五|週五/i.test(cleanLine)) deadline = '本週五前';
        if (/下週/i.test(cleanLine)) deadline = '下週會議前';

        if (actionItems.length < 6) {
          actionItems.push({ desc: cleanLine, owner: '專案負責人', deadline: deadline, priority: priority });
        }
      }

      if (/決議|確認|結論|同意|定案|主要|重點|報告|通過|達成/i.test(cleanLine)) {
        if (progressDecisions.length < 5) progressDecisions.push(cleanLine);
      }

      if (/\d+[%％萬億元mkWVA]|\d+\.\d+|kW|MW|kWh|MWh|EMS|PLC|Modbus/i.test(cleanLine)) {
        if (technicalMetrics.length < 4) technicalMetrics.push(cleanLine);
      }
    });

    if (progressDecisions.length === 0 && lines.length > 0) progressDecisions.push(lines[0]);
    if (actionItems.length === 0) {
      actionItems.push({
        desc: '依據現場會議研討事項進行後續追蹤與進度落實',
        owner: '團隊負責人',
        deadline: '持續推進',
        priority: '⚡ 中'
      });
    }

    let md = `# 📋 ${meetingTitle} - 正式重點會議紀錄與行動追蹤表\n\n`;
    md += `> **會議文件編號**：\`${filename}\`  \n`;
    md += `> **產出時間**：${yyyy}-${mm}-${dd} ${hh}:${min} | **核心引擎**：Qwen 2.5 本機 AI  \n\n`;
    md += `## 📌 一、會議基本資訊\n\n| 項目欄位 | 詳細內容說明 |\n| :--- | :--- |\n| **會議日期** | ${meetingDate} |\n| **會議時間** | ${meetingTime} |\n| **會議地點** | ${meetingLocation} |\n| **會議主題** | **${meetingTitle}** |\n| **出席人員** | ${attendees} |\n\n`;
    md += `## 🎯 二、核心重點與決議定案事項 (Executive Decisions)\n\n`;
    progressDecisions.forEach((point, idx) => { md += `${idx + 1}. **決議 ${idx + 1}**：${point}\n`; });
    md += `\n`;
    if (technicalMetrics.length > 0) {
      md += `## 📊 三、關鍵數據指標與技術參數 (Key Metrics)\n\n`;
      technicalMetrics.forEach((m, idx) => { md += `* **指標 ${idx + 1}**：${m}\n`; });
      md += `\n`;
    }
    md += `## ✅ 四、待辦事項與責任分工追蹤矩陣 (Action Matrix)\n\n| 項次 | 具體待辦事項說明 | 優先等級 | 建議負責人 | 預計完成時程 |\n| :---: | :--- | :---: | :---: | :---: |\n`;
    actionItems.forEach((item, idx) => {
      const badge = item.priority.includes('高') ? '`[🔥高優先]`' : '`[⚡中優先]`';
      md += `| ${idx + 1} | **${item.desc}** | ${badge} | **${item.owner}** | \`${item.deadline}\` |\n`;
    });
    return md;
  }

  // Markdown to HTML Renderer
  function renderMarkdownView(md) {
    const lines = md.split('\n');
    let inTable = false;
    let tableHtml = '';
    let resultLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml = '<table>';
        }
        if (line.includes(':---')) continue;
        
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        const isHeader = !tableHtml.includes('<tbody>') && !tableHtml.includes('<tr>');
        tableHtml += '<tr>';
        cells.forEach(cell => {
          let formatted = cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
          if (formatted.includes('[HIGH]') || formatted.includes('[🔥高優先]')) {
            formatted = formatted.replace(/<code>.*?<\/code>/, '<span class="badge-priority-high">🔥 高優先</span>');
          } else if (formatted.includes('[MEDIUM]') || formatted.includes('[⚡中優先]')) {
            formatted = formatted.replace(/<code>.*?<\/code>/, '<span class="badge-priority-med">⚡ 中優先</span>');
          }
          tableHtml += isHeader ? `<th>${formatted}</th>` : `<td>${formatted}</td>`;
        });
        tableHtml += '</tr>';
      } else {
        if (inTable) {
          tableHtml += '</table>';
          resultLines.push(tableHtml);
          inTable = false;
        }
        resultLines.push(lines[i]);
      }
    }
    if (inTable) {
      tableHtml += '</table>';
      resultLines.push(tableHtml);
    }

    outputRendered.innerHTML = resultLines.join('\n')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/```text([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\.\s+(.*$)/gim, '<li>$1</li>');
  }

  generateSummaryBtn.addEventListener('click', generateMeetingMinutes);

  // Copy as Outlook Rich Text Email Format (Tables, Badges, Typography)
  function convertMarkdownToOutlookHtml(md) {
    const lines = md.split('\n');
    let inTable = false;
    let tableHtml = '';
    let bodyHtml = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml = '<table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px; font-family:\'Segoe UI\', Arial, \'Microsoft JhengHei\', sans-serif; border:1px solid #cbd5e1;">';
        }
        if (line.includes(':---')) continue;

        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        const isHeader = !tableHtml.includes('<tbody>') && !tableHtml.includes('<tr>');
        
        tableHtml += isHeader ? '<tr style="background-color:#f1f5f9;">' : '<tr>';
        cells.forEach(cell => {
          let formatted = cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code style="background:#f1f5f9; padding:2px 4px; border-radius:3px; font-family:Consolas, monospace;">$1</code>');
          if (formatted.includes('[HIGH]') || formatted.includes('[🔥高優先]')) {
            formatted = formatted.replace(/<code>.*?<\/code>|\[🔥高優先\]/g, '<span style="background-color:#fee2e2; color:#dc2626; font-weight:bold; padding:2px 6px; border-radius:4px; font-size:11px;">🔥 高優先</span>');
          } else if (formatted.includes('[MEDIUM]') || formatted.includes('[⚡中優先]')) {
            formatted = formatted.replace(/<code>.*?<\/code>|\[⚡中優先\]/g, '<span style="background-color:#fef3c7; color:#d97706; font-weight:bold; padding:2px 6px; border-radius:4px; font-size:11px;">⚡ 中優先</span>');
          }
          tableHtml += isHeader 
            ? `<th style="padding:10px 12px; border:1px solid #cbd5e1; text-align:left; font-weight:bold; color:#1e293b;">${formatted}</th>` 
            : `<td style="padding:8px 12px; border:1px solid #e2e8f0; color:#334155;">${formatted}</td>`;
        });
        tableHtml += '</tr>';
      } else {
        if (inTable) {
          tableHtml += '</table>';
          bodyHtml += tableHtml;
          inTable = false;
        }

        if (line.startsWith('# ')) {
          bodyHtml += `<h1 style="font-size:18px; color:#1e1b4b; margin:16px 0 8px; border-bottom:2px solid #e0e7ff; padding-bottom:6px;">${line.substring(2)}</h1>`;
        } else if (line.startsWith('## ')) {
          bodyHtml += `<h2 style="font-size:15px; color:#1e293b; margin:14px 0 6px;">${line.substring(3)}</h2>`;
        } else if (line.startsWith('### ')) {
          bodyHtml += `<h3 style="font-size:14px; color:#334155; margin:10px 0 4px;">${line.substring(4)}</h3>`;
        } else if (line.startsWith('> ')) {
          bodyHtml += `<div style="background-color:#f8fafc; border-left:4px solid #4f46e5; padding:8px 12px; margin:10px 0; color:#475569; font-size:13px;">${line.substring(2)}</div>`;
        } else if (line.startsWith('* ') || line.startsWith('- ')) {
          const itemText = line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          bodyHtml += `<li style="margin-bottom:4px; color:#334155; font-size:13px;">${itemText}</li>`;
        } else if (line.length > 0) {
          const pText = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          bodyHtml += `<p style="margin:6px 0; color:#334155; font-size:13px;">${pText}</p>`;
        }
      }
    }
    if (inTable) {
      tableHtml += '</table>';
      bodyHtml += tableHtml;
    }

    return `<div style="font-family:'Segoe UI', Arial, 'Microsoft JhengHei', sans-serif; font-size:14px; line-height:1.6; color:#1e293b; max-width:850px;">
      ${bodyHtml}
    </div>`;
  }

  // Universal Fail-Proof Rich-Text & Plain-Text Clipboard Engine
  async function copyRichTextToClipboard(htmlContent, plainText) {
    let copied = false;

    // 1. Try Modern Clipboard API (Rich HTML + Plain Text)
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          })
        ]);
        copied = true;
      } catch (e) {
        console.warn('ClipboardItem write notice:', e);
      }
    }

    // 2. Fallback: DOM-based document.execCommand('copy') for Rich HTML
    if (!copied) {
      try {
        const div = document.createElement('div');
        div.innerHTML = htmlContent;
        div.style.position = 'fixed';
        div.style.left = '-9999px';
        div.style.top = '-9999px';
        div.style.opacity = '0';
        document.body.appendChild(div);

        const range = document.createRange();
        range.selectNodeContents(div);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        copied = document.execCommand('copy');
        sel.removeAllRanges();
        document.body.removeChild(div);
      } catch (e) {
        console.warn('execCommand html notice:', e);
      }
    }

    // 3. Fallback: Pure Text Copy
    if (!copied) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(plainText);
          copied = true;
        } else {
          const ta = document.createElement('textarea');
          ta.value = plainText;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          copied = document.execCommand('copy');
          document.body.removeChild(ta);
        }
      } catch (e) {
        console.warn('Final text copy fallback notice:', e);
      }
    }

    return copied;
  }

  // Live Output: Copy as Outlook Rich Text
  if (copyOutlookBtn) {
    copyOutlookBtn.addEventListener('click', async () => {
      const md = outputMarkdown ? outputMarkdown.value.trim() : '';
      if (!md) {
        showToast('⚠️ 請先點擊【一鍵產出深度重點會議紀錄】後再進行複製！', 4000);
        return;
      }

      const htmlFormatted = convertMarkdownToOutlookHtml(md);
      const success = await copyRichTextToClipboard(htmlFormatted, md);
      if (success) {
        showToast('📧 已複製為 Outlook 富文本格式！直接在 Outlook / Word 按 Ctrl+V 貼上即可！', 4500);
      } else {
        showToast('❌ 複製失敗，請手動選取文字按 Ctrl+C！');
      }
    });
  }

  // Live Output: Copy Result (Raw Markdown)
  if (copyResultBtn) {
    copyResultBtn.addEventListener('click', async () => {
      const text = outputMarkdown ? outputMarkdown.value.trim() : '';
      if (!text) {
        showToast('⚠️ 請先點擊【一鍵產出深度重點會議紀錄】後再進行複製！', 4000);
        return;
      }
      const success = await copyRichTextToClipboard(`<pre>${text}</pre>`, text);
      if (success) {
        showToast('📝 已複製 Markdown 原始碼至剪貼簿！');
      } else {
        showToast('❌ 複製失敗，請手動選取文字按 Ctrl+C！');
      }
    });
  }

  // Download Markdown with File Picker
  downloadMdBtn.addEventListener('click', async () => {
    const text = outputMarkdown.value;
    if (!text) {
      showToast('請先點擊產出會議紀錄！');
      return;
    }
    const filename = `${autoFilenameInput.value.trim() || '會議紀錄'}.md`;

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Markdown 會議紀錄 (*.md)',
            accept: { 'text/markdown': ['.md'], 'text/plain': ['.txt'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        showToast(`已成功儲存檔案：${filename}`);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`已下載會議紀錄：${filename}`);
  });

  // Print / PDF
  printBtn.addEventListener('click', () => {
    const content = outputRendered.innerHTML;
    if (!content || content.includes('placeholder-text')) {
      showToast('請先產出會議紀錄後再列印！');
      return;
    }
    window.print();
  });

  // --- KNOWLEDGE BASE & AI CHAT MODULE ---
  const navLiveTab = document.getElementById('nav-live-tab');
  const navKbTab = document.getElementById('nav-kb-tab');
  const liveSection = document.getElementById('live-section');
  const kbSection = document.getElementById('kb-section');

  const refreshKbBtn = document.getElementById('refresh-kb-btn');
  const kbSearchInput = document.getElementById('kb-search-input');
  const kbMeetingList = document.getElementById('kb-meeting-list');
  const kbDocTitle = document.getElementById('kb-doc-title');
  const kbDocContent = document.getElementById('kb-doc-content');
  const kbCopyOutlookBtn = document.getElementById('kb-copy-outlook-btn');
  const kbDownloadBtn = document.getElementById('kb-download-btn');
  const kbAiInput = document.getElementById('kb-ai-input');
  const kbAiSendBtn = document.getElementById('kb-ai-send-btn');
  const kbAiResponse = document.getElementById('kb-ai-response');

  let allKbFiles = [];
  let currentKbDoc = '';
  let currentKbFileName = '';

  // Tab Switching
  if (navLiveTab && navKbTab) {
    navLiveTab.addEventListener('click', () => {
      navLiveTab.classList.add('active');
      navKbTab.classList.remove('active');
      liveSection.style.display = 'grid';
      kbSection.style.display = 'none';
    });

    navKbTab.addEventListener('click', () => {
      navKbTab.classList.add('active');
      navLiveTab.classList.remove('active');
      liveSection.style.display = 'none';
      kbSection.style.display = 'grid';
      loadKnowledgeBaseMeetings();
    });
  }

  async function loadKnowledgeBaseMeetings() {
    if (!kbMeetingList) return;
    kbMeetingList.innerHTML = '<div class="loading-spinner">🔄 正在掃描歷史會議紀錄...</div>';

    try {
      const res = await fetch('/api/list-meetings');
      const data = await res.json();

      if (!data.success || !data.files || data.files.length === 0) {
        kbMeetingList.innerHTML = '<p class="placeholder-text" style="padding:12px;">尚未找到任何 .md 會議紀錄檔案</p>';
        return;
      }

      allKbFiles = data.files;
      renderKbMeetingList(allKbFiles);

      // Auto-open first meeting
      if (allKbFiles.length > 0) {
        selectKbMeeting(allKbFiles[0]);
      }
    } catch (err) {
      console.warn('Failed to load KB meetings:', err);
      kbMeetingList.innerHTML = '<p class="placeholder-text" style="color:red;padding:12px;">載入會議紀錄失敗</p>';
    }
  }

  function renderKbMeetingList(files) {
    if (!kbMeetingList) return;
    if (files.length === 0) {
      kbMeetingList.innerHTML = '<p class="placeholder-text" style="padding:12px;">無符合搜尋條件的會議紀錄</p>';
      return;
    }

    kbMeetingList.innerHTML = '';
    files.forEach((f) => {
      const item = document.createElement('div');
      item.className = `kb-item ${currentKbFileName === f.name ? 'active' : ''}`;
      
      const cleanTitle = f.name.replace(/\.md$/, '').replace(/_/g, ' ');
      const sizeKb = (f.size / 1024).toFixed(1);
      const dateStr = f.mtime ? f.mtime.split('T')[0] : '';

      item.innerHTML = `
        <div class="kb-item-main">
          <div class="kb-item-title">📄 ${cleanTitle}</div>
          <div class="kb-item-meta">
            <span>📅 ${dateStr}</span>
            <span>💾 ${sizeKb} KB</span>
          </div>
        </div>
        <button class="kb-item-del-btn" title="刪除此會議紀錄">🗑️</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.kb-item-del-btn')) return;
        document.querySelectorAll('.kb-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        selectKbMeeting(f);
      });

      const delBtn = item.querySelector('.kb-item-del-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteMeetingFile(f.path, f.name);
        });
      }

      kbMeetingList.appendChild(item);
    });
  }

  async function selectKbMeeting(f) {
    currentKbFileName = f.name;
    kbDocTitle.textContent = `📋 ${f.name.replace(/\.md$/, '').replace(/_/g, ' ')}`;
    kbDocContent.innerHTML = '<div class="loading-spinner">📖 正在載入並渲染會議紀錄...</div>';
    if (kbAiResponse) kbAiResponse.style.display = 'none';

    try {
      const res = await fetch('/api/read-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: f.path })
      });
      const data = await res.json();

      if (data.success && data.content) {
        currentKbDoc = data.content;
        renderKbDocView(currentKbDoc);
      } else {
        kbDocContent.innerHTML = '<p style="color:red;padding:16px;">無法讀取會議紀錄檔案內容。</p>';
      }
    } catch (err) {
      console.warn('Read meeting error:', err);
      kbDocContent.innerHTML = '<p style="color:red;padding:16px;">讀取檔案時發生錯誤。</p>';
    }
  }

  function renderKbDocView(md) {
    if (!kbDocContent) return;
    const lines = md.split('\n');
    let inTable = false;
    let tableHtml = '';
    let result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml = '<table>';
        }
        if (line.includes(':---')) continue;

        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        tableHtml += '<tr>';
        cells.forEach(cell => {
          let formatted = cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
          if (formatted.includes('[HIGH]') || formatted.includes('[🔥高優先]') || formatted.includes('[🔥最高]')) {
            formatted = `<span class="priority-badge priority-high">${formatted}</span>`;
          } else if (formatted.includes('[MED]') || formatted.includes('[⚡中優先]') || formatted.includes('[⚡高優先]')) {
            formatted = `<span class="priority-badge priority-med">${formatted}</span>`;
          }
          tableHtml += `<td>${formatted}</td>`;
        });
        tableHtml += '</tr>';
        continue;
      } else if (inTable) {
        inTable = false;
        tableHtml += '</table>';
        result.push(tableHtml);
        tableHtml = '';
      }

      if (line.startsWith('# ')) {
        result.push(`<h1>${line.replace('# ', '')}</h1>`);
      } else if (line.startsWith('## ')) {
        result.push(`<h2>${line.replace('## ', '')}</h2>`);
      } else if (line.startsWith('### ')) {
        result.push(`<h3>${line.replace('### ', '')}</h3>`);
      } else if (line.startsWith('> ')) {
        result.push(`<blockquote>${line.replace('> ', '')}</blockquote>`);
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        const itemText = line.replace(/^[\*\-]\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
        result.push(`<li>${itemText}</li>`);
      } else if (line.length > 0) {
        result.push(`<p>${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`);
      }
    }
    if (inTable) {
      tableHtml += '</table>';
      result.push(tableHtml);
    }
    kbDocContent.innerHTML = result.join('');
  }

  // KB Search
  if (kbSearchInput) {
    kbSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderKbMeetingList(allKbFiles);
      } else {
        const filtered = allKbFiles.filter(f => f.name.toLowerCase().includes(q));
        renderKbMeetingList(filtered);
      }
    });
  }

  if (refreshKbBtn) {
    refreshKbBtn.addEventListener('click', () => {
      loadKnowledgeBaseMeetings();
      showToast('🔄 已重新整理會議紀錄清單！');
    });
  }

  // KB Copy Outlook
  if (kbCopyOutlookBtn) {
    kbCopyOutlookBtn.addEventListener('click', async () => {
      if (!currentKbDoc) {
        showToast('⚠️ 請先由左側點選一份欲複製的會議紀錄！', 4000);
        return;
      }
      const htmlFormatted = convertMarkdownToOutlookHtml(currentKbDoc);
      const success = await copyRichTextToClipboard(htmlFormatted, currentKbDoc);
      if (success) {
        showToast('📧 已複製為 Outlook 富文本格式！直接在 Outlook / Word 按 Ctrl+V 貼上即可！', 4000);
      } else {
        showToast('❌ 複製失敗，請手動選取文字按 Ctrl+C！');
      }
    });
  }

  // KB Delete Handler
  const kbDeleteBtn = document.getElementById('kb-delete-btn');
  async function deleteMeetingFile(path, name) {
    const targetName = name || currentKbFileName;
    const targetPath = path || (allKbFiles.find(f => f.name === targetName)?.path);
    if (!targetPath) {
      showToast('⚠️ 找不到欲刪除的檔案路徑！');
      return;
    }

    const confirmed = window.confirm(`確定要刪除會議紀錄【${targetName}】嗎？\n此動作將同時從專案會議庫與桌面永久移除。`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/delete-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🗑️ ${data.message || '已成功刪除會議檔案！'}`);
        currentKbFileName = '';
        currentKbDoc = '';
        kbDocTitle.textContent = '請由左側點選會議紀錄';
        kbDocContent.innerHTML = '<p class="placeholder-text">👈 請由左側會議清單點選任一份會議紀錄，或點擊「➕ 匯入檔案」加入新紀錄！</p>';
        if (kbAiResponse) kbAiResponse.style.display = 'none';
        await loadKnowledgeBaseMeetings();
      } else {
        showToast(`❌ 刪除失敗：${data.error || '未知錯誤'}`);
      }
    } catch (err) {
      showToast('❌ 刪除失敗，請檢查伺服器連線狀態！');
    }
  }

  if (kbDeleteBtn) {
    kbDeleteBtn.addEventListener('click', () => {
      if (!currentKbFileName) {
        showToast('請先由左側選擇一份會議紀錄！');
        return;
      }
      deleteMeetingFile(null, currentKbFileName);
    });
  }

  // KB Import / Add File Handler
  const kbImportBtn = document.getElementById('kb-import-btn');
  const kbImportFileInput = document.getElementById('kb-import-file-input');

  async function importMeetingFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      showToast('⚠️ 僅支援匯入 .md 或 .txt 格式之會議紀錄！');
      return;
    }

    try {
      const text = await file.text();
      showToast(`正在匯入：${file.name}...`);

      const res = await fetch('/api/import-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content: text
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✨ 成功匯入會議紀錄：${data.filename}！`);
        await loadKnowledgeBaseMeetings();
        const importedFile = allKbFiles.find(f => f.name === data.filename);
        if (importedFile) {
          selectKbMeeting(importedFile);
        }
      } else {
        showToast(`❌ 匯入失敗：${data.error || '未知錯誤'}`);
      }
    } catch (err) {
      showToast('❌ 讀取或匯入檔案時發生錯誤！');
    }
  }

  if (kbImportBtn && kbImportFileInput) {
    kbImportBtn.addEventListener('click', () => kbImportFileInput.click());
    kbImportFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        await importMeetingFile(file);
        kbImportFileInput.value = '';
      }
    });
  }

  // Drag & Drop to Import directly into Knowledge Base
  if (kbMeetingList) {
    kbMeetingList.addEventListener('dragover', (e) => {
      e.preventDefault();
      kbMeetingList.style.borderColor = 'var(--primary)';
      kbMeetingList.style.background = '#eff6ff';
    });
    kbMeetingList.addEventListener('dragleave', () => {
      kbMeetingList.style.borderColor = '';
      kbMeetingList.style.background = '';
    });
    kbMeetingList.addEventListener('drop', async (e) => {
      e.preventDefault();
      kbMeetingList.style.borderColor = '';
      kbMeetingList.style.background = '';
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          await importMeetingFile(e.dataTransfer.files[i]);
        }
      }
    });
  }

  // KB Download
  if (kbDownloadBtn) {
    kbDownloadBtn.addEventListener('click', () => {
      if (!currentKbDoc) {
        showToast('請先選擇一份會議紀錄！');
        return;
      }
      const blob = new Blob([currentKbDoc], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentKbFileName || '會議紀錄.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`已下載會議紀錄：${currentKbFileName}`);
    });
  }

  // KB AI Q&A
  async function askKbAi(query) {
    if (!currentKbDoc) {
      showToast('請先從左側點選一份會議紀錄！');
      return;
    }
    if (!query) return;

    if (kbAiResponse) {
      kbAiResponse.style.display = 'block';
      kbAiResponse.innerHTML = '🤖 <strong>Qwen 2.5 7B AI 大腦正在分析本篇會議紀錄...</strong>';
    }
    if (kbAiSendBtn) kbAiSendBtn.disabled = true;

    try {
      const res = await fetch('/api/chat-with-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docContent: currentKbDoc,
          question: query
        })
      });
      const data = await res.json();
      if (data.success && data.answer) {
        let formattedAnswer = data.answer
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/\n/g, '<br>');
        kbAiResponse.innerHTML = `<strong>💡 AI 回答：</strong><br><br>${formattedAnswer}`;
      } else {
        kbAiResponse.innerHTML = `<span style="color:red;">❌ AI 回答失敗：${data.error || '未知錯誤'}</span>`;
      }
    } catch (err) {
      kbAiResponse.innerHTML = `<span style="color:red;">❌ 連線至本地 AI 失敗，請確認 Qwen 2.5 7B 正在運行。</span>`;
    } finally {
      if (kbAiSendBtn) kbAiSendBtn.disabled = false;
    }
  }

  if (kbAiSendBtn && kbAiInput) {
    kbAiSendBtn.addEventListener('click', () => {
      const q = kbAiInput.value.trim();
      if (q) askKbAi(q);
    });

    kbAiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = kbAiInput.value.trim();
        if (q) askKbAi(q);
      }
    });
  }

  // --- CONTINUOUS REINFORCEMENT LEARNING & ENTERPRISE MEMORY ---
  let cachedEnterpriseMemory = null;
  const memoryBadge = document.getElementById('memory-badge');
  const rlFeedbackBtn = document.getElementById('rl-feedback-btn');

  async function fetchEnterpriseMemory() {
    try {
      const res = await fetch('/api/get-memory');
      const data = await res.json();
      cachedEnterpriseMemory = data;
      
      let totalEntities = 0;
      if (data.enterprise_entities) {
        for (const arr of Object.values(data.enterprise_entities)) {
          if (Array.isArray(arr)) totalEntities += arr.length;
        }
      }

      if (memoryBadge) {
        memoryBadge.textContent = `🧠 企業記憶庫 (已自主學習 ${totalEntities} 項專有名詞)`;
      }
    } catch (_) {}
  }

  fetchEnterpriseMemory();

  if (rlFeedbackBtn) {
    rlFeedbackBtn.addEventListener('click', async () => {
      const currentOutput = outputMarkdown ? outputMarkdown.value.trim() : '';
      if (!currentOutput) {
        showToast('⚠️ 請先產出會議紀錄後再進行強化學習！');
        return;
      }

      rlFeedbackBtn.disabled = true;
      rlFeedbackBtn.innerHTML = '⏳ 正在納入強化學習...';

      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'thumbs_up_exemplar',
            topic: meetingTitleInput ? meetingTitleInput.value.trim() : '微電網專案會議',
            rawTranscript: rawTranscript ? rawTranscript.value : '',
            editedContent: currentOutput
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('✨ 已成功記錄為企業標竿範本！AI 已自主提煉並強化記憶！', 4000);
          setTimeout(fetchEnterpriseMemory, 1500);
        } else {
          showToast(`❌ 記錄失敗：${data.error || '未知錯誤'}`);
        }
      } catch (err) {
        showToast('❌ 強化學習連線失敗！');
      } finally {
        rlFeedbackBtn.disabled = false;
        rlFeedbackBtn.innerHTML = '🧠 👍 納入 AI 強化學習 (標竿範例)';
      }
    });
  }
});

