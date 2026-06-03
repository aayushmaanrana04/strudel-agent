# Dataset Plan v2

## Goal
Train a single 0.5B model: **natural language prompt → strudel code**
Target: ~10,000 diverse, high-quality examples

---

## Current State (v1 — what we have)

| Dataset | Examples | Quality | Problem |
|---|---|---|---|
| `data/dataset.jsonl` (prompt → intent) | 2502 | Templated prompts | "dark techno", "chill lofi" — not natural |
| `data/strudel-dataset.jsonl` (intent → code) | 2390 | Rules-engine code | Same 5-6 patterns per genre, repetitive |
| Combined training data | 7282 | Mixed | Model memorizes, doesn't generalize |

---

## Data Sources for v2

### Source 1: Scraped Real Strudel Patterns (~900 patterns, FREE)

Real code written by humans who could hear the output.

| Source | Patterns | Access | Genre-tagged? |
|---|---|---|---|
| Tidal Drum Patterns (urswilke/strudel swatch) | 491 | GitHub, trivial | Yes — Afro, Funk, Techno, DnB, etc. |
| Community Bakery (strudel.cc/bakery) | 289+ | Supabase API (anon key in source) | No — Claude tags them |
| Official Examples (tunes.mjs) | 31 | Codeberg repo | No |
| Workshop/Tutorial Code | 50-80 | MDX files in repo | No |
| Strudel Market (strudelmarket.com) | ~100 | Headless browser scrape | Yes — categorized |

**Mapping:** For untagged patterns, Claude reads the code and writes a natural prompt.
- Cost: ~900 × 250 tokens = ~225K tokens = **~$3**
- Example: `stack(s("bd*4").bank("RolandTR909")...)` → "minimal techno four-on-floor beat"

### Source 2: HuggingFace Music Prompts Dataset (~5000 prompts, ~$10-15)

**Dataset:** `Reubencf/music-style-prompts` (9950 rows)
- Natural language descriptions of real music tracks
- Rich metadata: genre (250 types), BPM, key, mood, instruments, energy
- Labeled by Gemini from Free Music Archive tracks

**Usage:**
1. Take ~5000 diverse descriptions as prompts
2. Map their metadata to our intent schema (programmatic, free)
3. Have Claude generate strudel code for each intent (batched)
4. Force structural variation in Claude's code:
   - Version A: euclidean rhythms
   - Version B: polyrhythmic stack
   - Version C: single chain, no stack
   - Version D: signal modulation
   - Version E: minimal (2 layers)

**Cost:** 5000 examples, batched 50/call = 100 calls × ~10K tokens = ~1M tokens = **~$10-15**

### Source 3: Our Existing Datasets (~2500, FREE)

Keep and improve:
- `data/dataset.jsonl` — 2502 prompt → intent pairs (teaches musical knowledge)
- Modifications (97) and stops (15)
- Add more natural prompt variations from HF dataset for same intents

---

## Final Dataset Composition

| Type | Source | Count | Format |
|---|---|---|---|
| Natural prompt → strudel code | HF prompts + Claude code | ~5000 | `{"prompt": "...", "code": "..."}` |
| Real code + reverse prompt | Scraped patterns + Claude prompts | ~900 | `{"prompt": "...", "code": "..."}` |
| Prompt → intent JSON | Our existing dataset | ~2500 | `{"prompt": "...", "intent": {...}}` |
| Modifications | Existing + expanded | ~500 | `{"prompt": "add reverb", "intent": {"action":"modify",...}}` |
| Stop commands | Existing + expanded | ~100 | `{"prompt": "stop", "intent": {"action":"stop"}}` |
| **Total** | | **~9000** | |

### Training Split
- Train: 7200 (80%)
- Validation: 1080 (12%)
- Test: 720 (8%)

---

## Task Distribution in Training Data

| Task | Count | % | What model learns |
|---|---|---|---|
| Prompt → strudel code | ~5900 | 66% | Direct code generation (main task) |
| Prompt → intent JSON | ~2500 | 28% | Musical knowledge (genre, mood, instruments) |
| Modifications + stops | ~600 | 6% | Edit commands |

At inference, the system prompt controls which task the model performs:
- "Output ONLY valid strudel code" → generates code
- "Output ONLY a JSON object" → generates intent

---

## Quality Assurance

### For scraped patterns:
- Validate strudel syntax (parens matched, has sound source)
- Filter out broken/incomplete patterns
- Verify each has a meaningful reverse prompt

### For Claude-generated code:
- Force structural variation (5 different structures per genre)
- Validate every output syntactically
- Check intent-code alignment (tempo, key, instruments match)
- Remove duplicates and near-duplicates

### For HF dataset mapping:
- Map their 250 genres to our 60 genre enums (many-to-one)
- Clamp BPM to genre ranges
- Validate instruments exist in strudel

---

## Token Cost Summary

| Step | Tokens | Cost (Opus) |
|---|---|---|
| Claude tags scraped patterns | ~225K | ~$3 |
| Claude generates strudel for HF prompts | ~1M | ~$10-15 |
| **Total** | **~1.2M** | **~$13-18** |

Alternative: Use Haiku for tagging ($0.30) and Opus only for code generation ($10-15).

---

## Execution Order

### Phase 1: Scrape (free, do first)
1. Scrape tidal drum patterns (491, GitHub)
2. Query community bakery (289+, Supabase)
3. Extract official examples + workshop code (80+, Codeberg)
4. Scrape strudel market (~100, headless browser)
5. Validate and deduplicate

### Phase 2: Map & Generate ($13-18)
1. Download HF dataset, select 5000 diverse prompts
2. Map HF metadata → our intent schema
3. Claude generates strudel code (batched, with structural variation)
4. Claude writes reverse prompts for scraped patterns
5. Validate all generated code

### Phase 3: Merge & Train (free, ~30 min)
1. Combine all sources into unified JSONL
2. Convert to mlx-lm chat format
3. Validate full dataset (syntax, alignment, diversity)
4. Split train/val/test
5. QLoRA fine-tune on M5 Pro
6. Evaluate on held-out test set

### Phase 4: Deploy
1. Fuse LoRA into base model
2. Serve via mlx-lm server (local testing)
3. Convert to GGUF/browser format (when tooling is fixed)
4. Update app providers

---

## Success Metrics

| Metric | v1 (current) | v2 (target) |
|---|---|---|
| Syntactically valid output | ~95% | >99% |
| Genre-appropriate patterns | ~60% | >85% |
| Musically diverse (unique patterns) | ~20% | >70% |
| Handles natural prompts | Poor | Good |
| Handles modifications | Poor | Decent |
| Inference speed (mlx-lm) | ~1700 tok/s | Same |
