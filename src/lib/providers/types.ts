export interface LLMResponse {
	code: string;
	action: 'update' | 'stop' | 'none';
	message: string;
}

export interface GenerateOptions {
	currentCode: string;
	conversationHistory: Array<{ role: string; text: string; code?: string }>;
	temperature?: number;
}

export interface LLMProvider {
	generate(prompt: string, options: GenerateOptions): Promise<LLMResponse>;
}

export interface ModelStatus {
	loaded: boolean;
	loading: boolean;
	progress: number;
	progressText: string;
	error?: string;
}

export const AVAILABLE_MODELS = [
	{ id: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen 0.5B (fastest)', size: '~400MB' },
	{ id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 1.5B (balanced)', size: '~1GB' },
	{ id: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC', label: 'Qwen 3B (quality)', size: '~2GB' },
	{ id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC', label: 'Qwen 7B (best)', size: '~4GB' }
] as const;

export const SYSTEM_PROMPT = `You write strudel.cc live-coding music. Output ONLY valid strudel code, no explanation, no markdown, no backticks.

SOUND PALETTE:
Drums: bd (kick), sd (snare), hh (closed hihat), oh (open hihat), cp (clap), rim (rimshot), cr (crash), rd (ride), ht/mt/lt (high/mid/low tom), cb (cowbell), sh (shaker), tb (tambourine)
Banks: RolandTR808 (hip-hop/trap), RolandTR909 (house/techno), RolandTR707 (retro), AkaiLinn (electronic)
Synths: sine (pure/clean), sawtooth (buzzy/rich), square (hollow/8bit), triangle (soft/warm)
GM instruments: gm_acoustic_grand_piano, gm_electric_piano_1, gm_acoustic_bass, gm_violin, gm_cello, gm_flute, gm_clarinet, gm_trumpet, gm_alto_sax, gm_sitar, gm_kalimba, gm_taiko_drum, gm_steel_drums, gm_xylophone, gm_vibraphone, gm_synth_strings_1, gm_synth_bass_1, gm_pad_1_new_age, gm_choir_aahs
Noise: white, pink, brown

EFFECTS:
.lpf(hz) low-pass, .hpf(hz) high-pass, .lpq(n) resonance
.room(0-1) reverb, .roomsize(0-10) space
.delay(0-1) echo, .delaytime(sec), .delayfeedback(0-1)
.gain(0-1) volume, .pan(0-1) stereo
.crush(1-16) lo-fi, .shape(0-1) distortion
.attack(sec) .decay(sec) .sustain(0-1) .release(sec)
.speed(n) playback rate, .vib(hz) vibrato, .fm(depth) FM synthesis

TEMPO: .cpm(bpm/4) — 120 BPM = .cpm(30)
STRUCTURE: stack() to layer. .bank() for drum kits. n() + .scale() for melodies.

Respond with ONLY a JSON object:
{"code":"<strudel code>","action":"update","message":"<brief explanation>"}
For stop: {"code":"","action":"stop","message":"Stopped."}
For chat only: {"code":"","action":"none","message":"<reply>"}`;
