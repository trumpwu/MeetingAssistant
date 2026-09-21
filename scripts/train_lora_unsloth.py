# -*- coding: utf-8 -*-
"""
🧠 亨創 AI 會議助理 - 一鍵式 Unsloth / AutoTrain LoRA 模型微調腳本
適用於：Google Colab (免費 T4 GPU) 或本機具備 NVIDIA GPU (>= 8GB VRAM)

執行方式：
  pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
  pip install --no-deps trl peft accelerate bitsandbytes
  python train_lora_unsloth.py
"""

import os
import torch
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments
from unsloth import FastLanguageModel

# 1. 設定模型與超參數
max_seq_length = 4096
dtype = None # 自動偵測 (Float16 或 Bfloat16)
load_in_4bit = True # 啟用 4-bit QLoRA，僅需 ~6GB VRAM

print("🚀 [1/5] 正在載入 Qwen 2.5 7B Instruct 基礎模型...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "Qwen/Qwen2.5-7B-Instruct",
    max_seq_length = max_seq_length,
    dtype = dtype,
    load_in_4bit = load_in_4bit,
)

# 2. 設定 LoRA 轉接器
print("⚙️ [2/5] 正在配置 LoRA 參數矩陣...")
model = FastLanguageModel.get_peft_model(
    model,
    r = 16, # LoRA Rank
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 16,
    lora_dropout = 0, # 最佳化速度
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)

# 3. 載入 SFT 數據集
dataset_path = os.path.join(os.path.dirname(__file__), "..", "TrainingData", "training_sft.jsonl")
if not os.path.exists(dataset_path):
    dataset_path = "training_sft.jsonl"

print(f"📊 [3/5] 正在載入會議訓練數據集：{dataset_path}")
dataset = load_dataset("json", data_files=dataset_path, split="train")

def formatting_prompts_func(examples):
    instructions = examples["instruction"]
    inputs       = examples["input"]
    outputs      = examples["output"]
    texts = []
    for instruction, input_text, output in zip(instructions, inputs, outputs):
        prompt = f"<|im_start|>system\n{instruction}<|im_end|>\n<|im_start|>user\n{input_text}<|im_end|>\n<|im_start|>assistant\n{output}<|im_end|>"
        texts.append(prompt)
    return { "text" : texts }

dataset = dataset.map(formatting_prompts_func, batched = True)

# 4. 啟動訓練
print("🔥 [4/5] 開始執行高效監督微調 (SFT Training)...")
trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    dataset_num_proc = 2,
    packing = False,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = 60, # 快速收斂，避免過擬合
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 5,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
    ),
)

trainer_stats = trainer.train()
print(f"🎉 訓練完成！花費時間：{trainer_stats.metrics.get('train_runtime', 0):.2f} 秒")

# 5. 導出 GGUF 格式 (直接供本機 llama-server.exe 使用)
print("💾 [5/5] 正在將微調權重導出為 GGUF (Q4_K_M)...")
export_dir = "hengchuang_qwen2.5_7b_gguf"
model.save_pretrained_gguf(export_dir, tokenizer, quantization_method = "q4_k_m")

print("\n" + "="*60)
print(f"✨ 全部大功告成！GGUF 模型已儲存於：{export_dir}")
print("請將生成的 .gguf 檔案複製回本機 D:\\project\\models\\ 即可享用專屬會議大腦！")
print("="*60)
