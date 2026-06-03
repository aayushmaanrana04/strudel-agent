#!/bin/bash
set -e

# ============================================================
# Strudel Intent Model — Fine-Tuning Pipeline
#
# Usage:
#   ./tools/finetune.sh setup        # Install dependencies
#   ./tools/finetune.sh prepare      # Convert dataset to chat format
#   ./tools/finetune.sh train        # Run QLoRA fine-tuning
#   ./tools/finetune.sh eval         # Test the fine-tuned model
#   ./tools/finetune.sh merge        # Merge LoRA into base model
#   ./tools/finetune.sh convert      # Convert to MLC/WebLLM format
#   ./tools/finetune.sh all          # Run full pipeline
# ============================================================

BASE_MODEL="Qwen/Qwen2.5-Coder-0.5B-Instruct"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FINETUNE_DIR="$PROJECT_DIR/finetune"
DATA_DIR="$PROJECT_DIR/data"
ADAPTER_DIR="$FINETUNE_DIR/adapters"
FUSED_DIR="$FINETUNE_DIR/fused-model"
MLC_DIR="$FINETUNE_DIR/mlc-model"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[finetune]${NC} $1"; }
warn() { echo -e "${YELLOW}[finetune]${NC} $1"; }
err() { echo -e "${RED}[finetune]${NC} $1"; exit 1; }

# ============================================================
# SETUP
# ============================================================
cmd_setup() {
    log "Setting up fine-tuning environment..."

    if [ ! -d "$FINETUNE_DIR/venv" ]; then
        log "Creating virtual environment..."
        python3 -m venv "$FINETUNE_DIR/venv"
    fi

    source "$FINETUNE_DIR/venv/bin/activate"

    log "Installing mlx-lm..."
    pip install -q "mlx-lm[train]"

    log "Installing mlc-llm (for conversion)..."
    pip install -q --pre -U -f https://mlc.ai/wheels mlc-llm-nightly-cpu mlc-ai-nightly-cpu 2>/dev/null || \
        warn "mlc-llm install failed — you can convert later. Fine-tuning will still work."

    log "Verifying..."
    python3 -c "import mlx_lm; print(f'mlx-lm {mlx_lm.__version__}')"

    log "Setup complete!"
}

# ============================================================
# PREPARE — Convert dataset to chat format for mlx-lm
# ============================================================
cmd_prepare() {
    log "Preparing training data in chat format..."

    mkdir -p "$FINETUNE_DIR/data"

    python3 << 'PYEOF'
import json
import os

project_dir = os.environ.get("PROJECT_DIR", ".")
data_dir = os.path.join(project_dir, "data")
out_dir = os.path.join(project_dir, "finetune", "data")

SYSTEM_PROMPT = "You extract music intent from user prompts. Output ONLY a JSON object with these fields: genre, tempo, key, scale, mood, energy, instruments, drum_kit, melody, bass_style, rhythm_style, variation, effects. For modifications output: {action: 'modify', delta: {...}}. For stop commands output: {action: 'stop'}."

def convert(input_file, output_file):
    examples = []
    with open(input_file) as f:
        for line in f:
            d = json.loads(line)
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": d["prompt"]},
                {"role": "assistant", "content": json.dumps(d["intent"], separators=(',', ':'))}
            ]
            examples.append({"messages": messages})

    with open(output_file, 'w') as f:
        for ex in examples:
            f.write(json.dumps(ex) + '\n')

    return len(examples)

train_count = convert(os.path.join(data_dir, "train.jsonl"), os.path.join(out_dir, "train.jsonl"))
val_count = convert(os.path.join(data_dir, "val.jsonl"), os.path.join(out_dir, "valid.jsonl"))
test_count = convert(os.path.join(data_dir, "test.jsonl"), os.path.join(out_dir, "test.jsonl"))

print(f"Prepared: train={train_count}, valid={val_count}, test={test_count}")
PYEOF

    log "Data prepared in $FINETUNE_DIR/data/"
}

# ============================================================
# TRAIN — Run QLoRA fine-tuning
# ============================================================
cmd_train() {
    log "Starting fine-tuning..."

    source "$FINETUNE_DIR/venv/bin/activate" 2>/dev/null || err "Run './tools/finetune.sh setup' first"

    # Ensure data exists
    [ -f "$FINETUNE_DIR/data/train.jsonl" ] || err "Run './tools/finetune.sh prepare' first"

    mkdir -p "$ADAPTER_DIR"

    # Write config
    cat > "$FINETUNE_DIR/lora_config.yaml" << 'YAML'
model: Qwen/Qwen2.5-Coder-0.5B-Instruct
train: true
fine_tune_type: lora
batch_size: 4
iters: 1500
learning_rate: 1e-5
steps_per_report: 10
steps_per_eval: 100
val_batches: 25
save_every: 500
max_seq_length: 512
grad_checkpoint: false

lora_parameters:
  rank: 16
  alpha: 32
  dropout: 0.05
  keys:
    - "self_attn.q_proj"
    - "self_attn.k_proj"
    - "self_attn.v_proj"
    - "self_attn.o_proj"
    - "mlp.gate_proj"
    - "mlp.up_proj"
    - "mlp.down_proj"
YAML

    log "Config: rank=16, alpha=32, lr=1e-5, iters=1500, batch=4"
    log "Training... (this takes ~15-30 min on M5 Pro)"

    mlx_lm.lora \
        --config "$FINETUNE_DIR/lora_config.yaml" \
        --data "$FINETUNE_DIR/data" \
        --adapter-path "$ADAPTER_DIR"

    log "Training complete! Adapters saved to $ADAPTER_DIR"
}

# ============================================================
# EVAL — Test the fine-tuned model
# ============================================================
cmd_eval() {
    log "Evaluating fine-tuned model..."

    source "$FINETUNE_DIR/venv/bin/activate" 2>/dev/null || err "Run './tools/finetune.sh setup' first"

    [ -d "$ADAPTER_DIR" ] || err "No adapters found. Run './tools/finetune.sh train' first"

    # Test on held-out data
    log "Running test set evaluation..."
    mlx_lm.lora \
        --model "$BASE_MODEL" \
        --adapter-path "$ADAPTER_DIR" \
        --data "$FINETUNE_DIR/data" \
        --test

    # Generate samples
    log ""
    log "Sample generations:"
    log "==================="

    PROMPTS=(
        "dark techno beat at 130 bpm"
        "chill lofi with piano"
        "add reverb"
        "stop"
        "indian classical with sitar"
        "make it faster"
        "club banger"
    )

    for prompt in "${PROMPTS[@]}"; do
        log "Prompt: $prompt"
        mlx_lm.generate \
            --model "$BASE_MODEL" \
            --adapter-path "$ADAPTER_DIR" \
            --prompt "<|im_start|>system
You extract music intent from user prompts. Output ONLY a JSON object.<|im_end|>
<|im_start|>user
$prompt<|im_end|>
<|im_start|>assistant
" \
            --max-tokens 256 \
            --temp 0.3 2>/dev/null | tail -1
        echo ""
    done
}

# ============================================================
# MERGE — Fuse LoRA adapter into base model
# ============================================================
cmd_merge() {
    log "Merging LoRA adapter into base model..."

    source "$FINETUNE_DIR/venv/bin/activate" 2>/dev/null || err "Run './tools/finetune.sh setup' first"

    [ -d "$ADAPTER_DIR" ] || err "No adapters found. Run './tools/finetune.sh train' first"

    mlx_lm.fuse \
        --model "$BASE_MODEL" \
        --adapter-path "$ADAPTER_DIR" \
        --save-path "$FUSED_DIR"

    log "Merged model saved to $FUSED_DIR"
    log "Contents:"
    ls -lh "$FUSED_DIR"
}

# ============================================================
# CONVERT — Convert to MLC/WebLLM format
# ============================================================
cmd_convert() {
    log "Converting to MLC/WebLLM format..."

    source "$FINETUNE_DIR/venv/bin/activate" 2>/dev/null || err "Run './tools/finetune.sh setup' first"

    [ -d "$FUSED_DIR" ] || err "No fused model found. Run './tools/finetune.sh merge' first"

    mkdir -p "$MLC_DIR"

    # Convert weights
    log "Converting weights (q4f16_1)..."
    mlc_llm convert_weight "$FUSED_DIR" \
        --quantization q4f16_1 \
        -o "$MLC_DIR" || err "mlc_llm convert_weight failed. Is mlc-llm installed?"

    # Generate config
    log "Generating MLC config..."
    mlc_llm gen_config "$FUSED_DIR" \
        --quantization q4f16_1 \
        --model-type qwen2 \
        --conv-template chatml \
        --context-window-size 4096 \
        --prefill-chunk-size 1024 \
        -o "$MLC_DIR/"

    log "MLC model ready at $MLC_DIR"
    log ""
    log "To deploy:"
    log "  1. Upload $MLC_DIR to HuggingFace"
    log "  2. Update WebLLM ModelRecord in src/lib/providers/webllm.svelte.ts"
    log "  3. The WASM library is reused from prebuilt Qwen2-0.5B (same architecture)"
    log ""
    log "Contents:"
    ls -lh "$MLC_DIR"
    du -sh "$MLC_DIR"
}

# ============================================================
# ALL — Full pipeline
# ============================================================
cmd_all() {
    cmd_setup
    cmd_prepare
    cmd_train
    cmd_eval
    cmd_merge
    cmd_convert
}

# ============================================================
# MAIN
# ============================================================
case "${1:-}" in
    setup)   cmd_setup ;;
    prepare) cmd_prepare ;;
    train)   cmd_train ;;
    eval)    cmd_eval ;;
    merge)   cmd_merge ;;
    convert) cmd_convert ;;
    all)     cmd_all ;;
    *)
        echo "Strudel Intent Model — Fine-Tuning Pipeline"
        echo ""
        echo "Usage: ./tools/finetune.sh <command>"
        echo ""
        echo "Commands:"
        echo "  setup     Install mlx-lm and mlc-llm"
        echo "  prepare   Convert dataset to chat format"
        echo "  train     Run QLoRA fine-tuning (~15-30 min)"
        echo "  eval      Test model with sample prompts"
        echo "  merge     Fuse LoRA into base model"
        echo "  convert   Convert to MLC/WebLLM format"
        echo "  all       Run full pipeline"
        ;;
esac
