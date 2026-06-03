// ============================================================
// STRUDEL INTENT SCHEMA v1 — LOCKED
// The small model predicts this JSON from user prompts.
// The rules engine converts it to strudel code.
// ============================================================

// --- ENUMS ---

export const GENRES = [
	'acid_house', 'afrobeat', 'ambient', 'blues', 'boom_bap', 'bossa_nova',
	'breakbeat', 'chillwave', 'classical', 'country', 'darkwave', 'deep_house',
	'desi_hip_hop', 'disco', 'downtempo', 'drum_and_bass', 'dubstep', 'edm',
	'electro', 'flamenco', 'folk', 'folktronica', 'funk', 'future_bass',
	'garage', 'grime', 'hardstyle', 'hip_hop', 'house', 'idm',
	'indian_classical', 'indian_fusion', 'indian_indie', 'indian_disco',
	'industrial', 'jazz', 'jungle', 'latin', 'lofi', 'metal',
	'minimal_techno', 'neo_soul', 'pop', 'progressive_house', 'psytrance',
	'punk', 'rnb', 'reggae', 'reggaeton', 'rock', 'salsa',
	'shoegaze', 'soul', 'synthwave', 'techno', 'trance', 'trap',
	'uk_garage', 'vaporwave', 'world'
] as const;

export const MOODS = [
	'aggressive', 'anthemic', 'bright', 'chill', 'cinematic', 'cold',
	'dark', 'devotional', 'dreamy', 'energetic', 'epic', 'ethereal',
	'funky', 'gritty', 'groovy', 'happy', 'haunting', 'hypnotic',
	'intense', 'intimate', 'melancholic', 'mysterious', 'nocturnal',
	'nostalgic', 'peaceful', 'playful', 'psychedelic', 'raw', 'sad',
	'sensual', 'smooth', 'spacious', 'tense', 'uplifting', 'warm',
	'weird', 'wistful'
] as const;

export const INSTRUMENTS = [
	'arp', 'bansuri', 'bass', 'bells', 'brass', 'choir', 'clap', 'conga',
	'dhol', 'dholak', 'drums', 'flute', 'guitar', 'harmonium', 'hihat',
	'keys', 'kick', 'lead', 'marimba', 'mridangam', 'organ', 'pad',
	'percussion', 'piano', 'pluck', 'rhodes', 'santoor', 'sarod',
	'shehnai', 'sitar', 'snare', 'strings', 'sub_bass', 'synth',
	'tabla', 'tanpura', 'tom', 'tumbi', 'vocal_chop'
] as const;

export const DRUM_KITS = [
	'TR808', 'TR909', 'TR707', 'AkaiLinn', 'acoustic', 'electronic', 'none'
] as const;

export const SCALES = [
	'major', 'minor', 'dorian', 'mixolydian', 'phrygian', 'lydian', 'locrian',
	'minor_pentatonic', 'major_pentatonic', 'blues', 'harmonic_minor',
	'melodic_minor', 'chromatic', 'whole_tone', 'diminished',
	'double_harmonic'
] as const;

export const KEYS = [
	'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
	'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
] as const;

export const RHYTHM_STYLES = [
	'straight', 'swing', 'shuffle', 'syncopated', 'polyrhythmic',
	'half_time', 'double_time', 'broken_beat', 'four_on_the_floor',
	'two_step', 'waltz', 'bossa', 'clave', 'tresillo', 'triplet'
] as const;

export const ENERGY_LEVELS = [
	'very_low', 'low', 'medium_low', 'medium',
	'medium_high', 'high', 'very_high'
] as const;

export const BASS_STYLES = [
	'none', 'sub', 'deep', 'groove', 'walking', 'pluck',
	'acid', 'reese', 'wobble', 'fingerstyle'
] as const;

export const MELODY_TYPES = [
	'absent', 'simple', 'complex', 'arpeggio',
	'chord', 'riff', 'atmospheric', 'call_response'
] as const;

export const EFFECT_LEVELS = ['none', 'low', 'medium', 'high'] as const;

export const FILTER_TYPES = ['none', 'lowpass', 'highpass', 'bandpass'] as const;

// --- INTENT INTERFACE ---

export interface MusicIntent {
	genre: (typeof GENRES)[number];
	tempo: number; // 40-200 BPM
	key: (typeof KEYS)[number];
	scale: (typeof SCALES)[number];
	mood: Array<(typeof MOODS)[number]>; // 1-3 moods
	energy: (typeof ENERGY_LEVELS)[number];
	instruments: Array<(typeof INSTRUMENTS)[number]>; // 1-6 instruments
	drum_kit: (typeof DRUM_KITS)[number];
	melody: (typeof MELODY_TYPES)[number];
	bass_style: (typeof BASS_STYLES)[number];
	rhythm_style: (typeof RHYTHM_STYLES)[number];
	variation: 'low' | 'medium' | 'high';
	effects: {
		reverb: (typeof EFFECT_LEVELS)[number];
		filter: (typeof FILTER_TYPES)[number];
		distortion: (typeof EFFECT_LEVELS)[number];
	};
}

// --- GENRE DEFAULTS ---
// When a genre is detected, these defaults fill unspecified fields.

export const GENRE_DEFAULTS: Record<string, Partial<MusicIntent>> = {
	techno: {
		tempo: 130, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909',
		energy: 'high', instruments: ['drums', 'bass', 'synth'],
		bass_style: 'sub', melody: 'absent', scale: 'minor',
		effects: { reverb: 'low', filter: 'lowpass', distortion: 'low' }
	},
	minimal_techno: {
		tempo: 125, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909',
		energy: 'medium', instruments: ['drums', 'percussion'],
		bass_style: 'sub', melody: 'absent', scale: 'minor',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' }
	},
	house: {
		tempo: 124, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909',
		energy: 'medium_high', instruments: ['drums', 'bass', 'keys'],
		bass_style: 'groove', melody: 'simple', scale: 'minor',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	desi_hip_hop: {
		tempo: 95, rhythm_style: 'straight', drum_kit: 'TR808',
		energy: 'high', instruments: ['drums', 'bass', 'tabla', 'dhol', 'synth'],
		bass_style: 'sub', melody: 'simple', scale: 'phrygian',
		effects: { reverb: 'low', filter: 'none', distortion: 'low' }
	},
	deep_house: {
		tempo: 122, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909',
		energy: 'medium', instruments: ['drums', 'bass', 'pad', 'keys'],
		bass_style: 'deep', melody: 'chord', scale: 'minor',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' }
	},
	progressive_house: {
		tempo: 126, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909',
		energy: 'medium_high', instruments: ['drums', 'bass', 'pad', 'lead'],
		bass_style: 'groove', melody: 'arpeggio', scale: 'minor',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' }
	},
	acid_house: {
		tempo: 126, rhythm_style: 'four_on_the_floor', drum_kit: 'TR808',
		energy: 'high', instruments: ['drums', 'bass', 'synth'],
		bass_style: 'acid', melody: 'riff', scale: 'minor',
		effects: { reverb: 'low', filter: 'lowpass', distortion: 'medium' }
	},
	trance: {
		tempo: 138, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909',
		energy: 'high', instruments: ['drums', 'bass', 'pad', 'lead'],
		bass_style: 'sub', melody: 'arpeggio', scale: 'minor',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' }
	},
	psytrance: {
		tempo: 145, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909',
		energy: 'very_high', instruments: ['drums', 'bass', 'lead', 'synth'],
		bass_style: 'acid', melody: 'arpeggio', scale: 'phrygian',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'medium' }
	},
	dubstep: {
		tempo: 140, rhythm_style: 'half_time', drum_kit: 'electronic',
		energy: 'very_high', instruments: ['drums', 'bass', 'synth'],
		bass_style: 'wobble', melody: 'simple', scale: 'minor',
		effects: { reverb: 'low', filter: 'lowpass', distortion: 'high' }
	},
	drum_and_bass: {
		tempo: 174, rhythm_style: 'broken_beat', drum_kit: 'electronic',
		energy: 'high', instruments: ['drums', 'bass', 'pad'],
		bass_style: 'reese', melody: 'atmospheric', scale: 'minor',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'low' }
	},
	jungle: {
		tempo: 170, rhythm_style: 'broken_beat', drum_kit: 'electronic',
		energy: 'high', instruments: ['drums', 'bass'],
		bass_style: 'sub', melody: 'absent', scale: 'minor',
		effects: { reverb: 'low', filter: 'lowpass', distortion: 'none' }
	},
	trap: {
		tempo: 140, rhythm_style: 'half_time', drum_kit: 'TR808',
		energy: 'high', instruments: ['drums', 'bass', 'hihat', 'lead'],
		bass_style: 'sub', melody: 'simple', scale: 'minor_pentatonic',
		effects: { reverb: 'medium', filter: 'none', distortion: 'low' }
	},
	hip_hop: {
		tempo: 90, rhythm_style: 'straight', drum_kit: 'TR808',
		energy: 'medium', instruments: ['drums', 'bass', 'keys'],
		bass_style: 'groove', melody: 'simple', scale: 'minor',
		effects: { reverb: 'low', filter: 'none', distortion: 'none' }
	},
	boom_bap: {
		tempo: 90, rhythm_style: 'swing', drum_kit: 'TR808',
		energy: 'medium', instruments: ['drums', 'bass', 'keys'],
		bass_style: 'groove', melody: 'simple', scale: 'minor',
		effects: { reverb: 'low', filter: 'lowpass', distortion: 'none' }
	},
	lofi: {
		tempo: 75, rhythm_style: 'swing', drum_kit: 'TR808',
		energy: 'low', instruments: ['drums', 'bass', 'piano', 'pad'],
		bass_style: 'deep', melody: 'chord', scale: 'dorian',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'low' }
	},
	ambient: {
		tempo: 60, rhythm_style: 'straight', drum_kit: 'none',
		energy: 'very_low', instruments: ['pad', 'bells', 'strings'],
		bass_style: 'none', melody: 'atmospheric', scale: 'major',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' }
	},
	downtempo: {
		tempo: 80, rhythm_style: 'straight', drum_kit: 'electronic',
		energy: 'low', instruments: ['drums', 'bass', 'pad', 'keys'],
		bass_style: 'deep', melody: 'atmospheric', scale: 'minor',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' }
	},
	jazz: {
		tempo: 120, rhythm_style: 'swing', drum_kit: 'acoustic',
		energy: 'medium', instruments: ['drums', 'bass', 'piano', 'brass'],
		bass_style: 'walking', melody: 'complex', scale: 'dorian',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	neo_soul: {
		tempo: 95, rhythm_style: 'swing', drum_kit: 'electronic',
		energy: 'medium_low', instruments: ['drums', 'bass', 'rhodes', 'pad'],
		bass_style: 'groove', melody: 'chord', scale: 'dorian',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' }
	},
	funk: {
		tempo: 110, rhythm_style: 'syncopated', drum_kit: 'acoustic',
		energy: 'medium_high', instruments: ['drums', 'bass', 'guitar', 'keys'],
		bass_style: 'groove', melody: 'riff', scale: 'mixolydian',
		effects: { reverb: 'low', filter: 'none', distortion: 'none' }
	},
	disco: {
		tempo: 120, rhythm_style: 'four_on_the_floor', drum_kit: 'acoustic',
		energy: 'medium_high', instruments: ['drums', 'bass', 'strings', 'keys'],
		bass_style: 'groove', melody: 'simple', scale: 'major',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	rnb: {
		tempo: 85, rhythm_style: 'straight', drum_kit: 'electronic',
		energy: 'medium_low', instruments: ['drums', 'bass', 'keys', 'pad'],
		bass_style: 'groove', melody: 'simple', scale: 'minor',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' }
	},
	soul: {
		tempo: 100, rhythm_style: 'straight', drum_kit: 'acoustic',
		energy: 'medium', instruments: ['drums', 'bass', 'organ', 'brass'],
		bass_style: 'groove', melody: 'simple', scale: 'major',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	pop: {
		tempo: 120, rhythm_style: 'straight', drum_kit: 'TR808',
		energy: 'medium_high', instruments: ['drums', 'bass', 'synth', 'lead'],
		bass_style: 'groove', melody: 'simple', scale: 'major',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	rock: {
		tempo: 120, rhythm_style: 'straight', drum_kit: 'acoustic',
		energy: 'high', instruments: ['drums', 'bass', 'guitar'],
		bass_style: 'groove', melody: 'riff', scale: 'minor_pentatonic',
		effects: { reverb: 'low', filter: 'none', distortion: 'medium' }
	},
	metal: {
		tempo: 140, rhythm_style: 'double_time', drum_kit: 'acoustic',
		energy: 'very_high', instruments: ['drums', 'bass', 'guitar'],
		bass_style: 'groove', melody: 'riff', scale: 'phrygian',
		effects: { reverb: 'low', filter: 'none', distortion: 'high' }
	},
	punk: {
		tempo: 160, rhythm_style: 'straight', drum_kit: 'acoustic',
		energy: 'very_high', instruments: ['drums', 'bass', 'guitar'],
		bass_style: 'groove', melody: 'riff', scale: 'minor',
		effects: { reverb: 'none', filter: 'none', distortion: 'medium' }
	},
	blues: {
		tempo: 80, rhythm_style: 'shuffle', drum_kit: 'acoustic',
		energy: 'medium_low', instruments: ['drums', 'bass', 'guitar'],
		bass_style: 'walking', melody: 'riff', scale: 'blues',
		effects: { reverb: 'medium', filter: 'none', distortion: 'low' }
	},
	folk: {
		tempo: 100, rhythm_style: 'straight', drum_kit: 'acoustic',
		energy: 'low', instruments: ['guitar', 'drums'],
		bass_style: 'none', melody: 'simple', scale: 'major',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	folktronica: {
		tempo: 110, rhythm_style: 'four_on_the_floor', drum_kit: 'electronic',
		energy: 'medium_low', instruments: ['harmonium', 'synth', 'drums', 'pad', 'bells'],
		bass_style: 'deep', melody: 'simple', scale: 'phrygian',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'low' }
	},
	country: {
		tempo: 110, rhythm_style: 'straight', drum_kit: 'acoustic',
		energy: 'medium', instruments: ['drums', 'bass', 'guitar'],
		bass_style: 'groove', melody: 'simple', scale: 'major',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	classical: {
		tempo: 80, rhythm_style: 'straight', drum_kit: 'none',
		energy: 'medium', instruments: ['strings', 'piano'],
		bass_style: 'none', melody: 'complex', scale: 'major',
		effects: { reverb: 'high', filter: 'none', distortion: 'none' }
	},
	indian_classical: {
		tempo: 100, rhythm_style: 'straight', drum_kit: 'none',
		energy: 'medium', instruments: ['sitar', 'tabla', 'tanpura', 'bansuri'],
		bass_style: 'sub', melody: 'complex', scale: 'phrygian',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	indian_fusion: {
		tempo: 100, rhythm_style: 'polyrhythmic', drum_kit: 'electronic',
		energy: 'medium', instruments: ['tabla', 'sitar', 'synth', 'bass', 'pad', 'drums'],
		bass_style: 'groove', melody: 'complex', scale: 'dorian',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' }
	},
	indian_indie: {
		tempo: 110, rhythm_style: 'straight', drum_kit: 'acoustic',
		energy: 'medium', instruments: ['guitar', 'drums', 'bass', 'keys'],
		bass_style: 'groove', melody: 'simple', scale: 'major',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	indian_disco: {
		tempo: 115, rhythm_style: 'four_on_the_floor', drum_kit: 'electronic',
		energy: 'medium_low', instruments: ['synth', 'drums', 'bass', 'pad', 'keys'],
		bass_style: 'groove', melody: 'chord', scale: 'minor',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' }
	},
	flamenco: {
		tempo: 120, rhythm_style: 'syncopated', drum_kit: 'none',
		energy: 'medium_high', instruments: ['guitar', 'percussion', 'clap'],
		bass_style: 'pluck', melody: 'complex', scale: 'phrygian',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	reggae: {
		tempo: 80, rhythm_style: 'syncopated', drum_kit: 'acoustic',
		energy: 'medium_low', instruments: ['drums', 'bass', 'guitar', 'organ'],
		bass_style: 'deep', melody: 'simple', scale: 'minor',
		effects: { reverb: 'high', filter: 'none', distortion: 'none' }
	},
	reggaeton: {
		tempo: 95, rhythm_style: 'tresillo', drum_kit: 'TR808',
		energy: 'medium_high', instruments: ['drums', 'bass', 'synth'],
		bass_style: 'sub', melody: 'simple', scale: 'minor',
		effects: { reverb: 'low', filter: 'none', distortion: 'none' }
	},
	afrobeat: {
		tempo: 110, rhythm_style: 'polyrhythmic', drum_kit: 'acoustic',
		energy: 'medium_high', instruments: ['drums', 'bass', 'guitar', 'brass', 'percussion'],
		bass_style: 'groove', melody: 'riff', scale: 'dorian',
		effects: { reverb: 'low', filter: 'none', distortion: 'none' }
	},
	latin: {
		tempo: 105, rhythm_style: 'clave', drum_kit: 'acoustic',
		energy: 'medium_high', instruments: ['drums', 'bass', 'piano', 'percussion', 'conga'],
		bass_style: 'groove', melody: 'simple', scale: 'minor',
		effects: { reverb: 'low', filter: 'none', distortion: 'none' }
	},
	salsa: {
		tempo: 95, rhythm_style: 'clave', drum_kit: 'acoustic',
		energy: 'medium_high', instruments: ['drums', 'bass', 'piano', 'brass', 'conga'],
		bass_style: 'groove', melody: 'riff', scale: 'minor',
		effects: { reverb: 'low', filter: 'none', distortion: 'none' }
	},
	bossa_nova: {
		tempo: 80, rhythm_style: 'bossa', drum_kit: 'acoustic',
		energy: 'low', instruments: ['drums', 'bass', 'guitar', 'piano'],
		bass_style: 'walking', melody: 'chord', scale: 'major',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	},
	synthwave: {
		tempo: 105, rhythm_style: 'straight', drum_kit: 'electronic',
		energy: 'medium_high', instruments: ['drums', 'bass', 'synth', 'pad', 'lead'],
		bass_style: 'groove', melody: 'arpeggio', scale: 'minor',
		effects: { reverb: 'high', filter: 'none', distortion: 'low' }
	},
	vaporwave: {
		tempo: 80, rhythm_style: 'straight', drum_kit: 'electronic',
		energy: 'low', instruments: ['drums', 'bass', 'pad', 'keys'],
		bass_style: 'deep', melody: 'chord', scale: 'major',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' }
	},
	edm: {
		tempo: 128, rhythm_style: 'four_on_the_floor', drum_kit: 'electronic',
		energy: 'high', instruments: ['drums', 'bass', 'lead', 'synth'],
		bass_style: 'sub', melody: 'simple', scale: 'minor',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'low' }
	},
	future_bass: {
		tempo: 150, rhythm_style: 'half_time', drum_kit: 'electronic',
		energy: 'high', instruments: ['drums', 'bass', 'synth', 'pad', 'vocal_chop'],
		bass_style: 'wobble', melody: 'chord', scale: 'major',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' }
	},
	hardstyle: {
		tempo: 150, rhythm_style: 'four_on_the_floor', drum_kit: 'electronic',
		energy: 'very_high', instruments: ['drums', 'bass', 'lead'],
		bass_style: 'sub', melody: 'simple', scale: 'minor',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'high' }
	},
	grime: {
		tempo: 140, rhythm_style: 'syncopated', drum_kit: 'electronic',
		energy: 'high', instruments: ['drums', 'bass', 'synth'],
		bass_style: 'sub', melody: 'riff', scale: 'minor',
		effects: { reverb: 'low', filter: 'none', distortion: 'medium' }
	},
	garage: {
		tempo: 130, rhythm_style: 'two_step', drum_kit: 'electronic',
		energy: 'medium_high', instruments: ['drums', 'bass', 'pad', 'vocal_chop'],
		bass_style: 'deep', melody: 'simple', scale: 'minor',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' }
	},
	uk_garage: {
		tempo: 132, rhythm_style: 'two_step', drum_kit: 'electronic',
		energy: 'medium_high', instruments: ['drums', 'bass', 'pad'],
		bass_style: 'deep', melody: 'simple', scale: 'minor',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' }
	},
	idm: {
		tempo: 120, rhythm_style: 'broken_beat', drum_kit: 'electronic',
		energy: 'medium', instruments: ['drums', 'bass', 'synth', 'bells'],
		bass_style: 'groove', melody: 'complex', scale: 'minor',
		effects: { reverb: 'medium', filter: 'lowpass', distortion: 'low' }
	},
	industrial: {
		tempo: 130, rhythm_style: 'straight', drum_kit: 'electronic',
		energy: 'very_high', instruments: ['drums', 'bass', 'synth'],
		bass_style: 'sub', melody: 'absent', scale: 'minor',
		effects: { reverb: 'low', filter: 'none', distortion: 'high' }
	},
	darkwave: {
		tempo: 110, rhythm_style: 'straight', drum_kit: 'electronic',
		energy: 'medium', instruments: ['drums', 'bass', 'synth', 'pad'],
		bass_style: 'deep', melody: 'atmospheric', scale: 'minor',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'low' }
	},
	shoegaze: {
		tempo: 95, rhythm_style: 'straight', drum_kit: 'acoustic',
		energy: 'medium', instruments: ['drums', 'bass', 'guitar', 'pad'],
		bass_style: 'deep', melody: 'atmospheric', scale: 'major',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'medium' }
	},
	chillwave: {
		tempo: 90, rhythm_style: 'straight', drum_kit: 'electronic',
		energy: 'low', instruments: ['drums', 'bass', 'synth', 'pad'],
		bass_style: 'deep', melody: 'atmospheric', scale: 'major',
		effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' }
	},
	breakbeat: {
		tempo: 130, rhythm_style: 'broken_beat', drum_kit: 'electronic',
		energy: 'high', instruments: ['drums', 'bass', 'synth'],
		bass_style: 'groove', melody: 'riff', scale: 'minor',
		effects: { reverb: 'low', filter: 'lowpass', distortion: 'low' }
	},
	electro: {
		tempo: 128, rhythm_style: 'straight', drum_kit: 'TR808',
		energy: 'high', instruments: ['drums', 'bass', 'synth', 'lead'],
		bass_style: 'groove', melody: 'riff', scale: 'minor',
		effects: { reverb: 'low', filter: 'lowpass', distortion: 'medium' }
	},
	world: {
		tempo: 100, rhythm_style: 'polyrhythmic', drum_kit: 'acoustic',
		energy: 'medium', instruments: ['drums', 'percussion', 'bass', 'flute'],
		bass_style: 'groove', melody: 'simple', scale: 'dorian',
		effects: { reverb: 'medium', filter: 'none', distortion: 'none' }
	}
};

// --- BPM RANGES PER GENRE ---

export const GENRE_BPM_RANGE: Record<string, [number, number]> = {
	acid_house: [120, 130], afrobeat: [100, 120], ambient: [50, 80],
	blues: [60, 100], boom_bap: [80, 100], bossa_nova: [70, 90],
	breakbeat: [120, 140], chillwave: [80, 100], classical: [60, 120],
	country: [100, 130], darkwave: [100, 120], deep_house: [118, 126],
	desi_hip_hop: [85, 140], disco: [115, 125], downtempo: [70, 100], drum_and_bass: [160, 180],
	dubstep: [135, 145], edm: [124, 132], electro: [120, 135],
	flamenco: [80, 140], folk: [80, 120], folktronica: [95, 125], funk: [95, 120],
	future_bass: [140, 160], garage: [125, 135], grime: [135, 145],
	hardstyle: [145, 155], hip_hop: [80, 100], house: [118, 130],
	idm: [90, 140], indian_classical: [60, 120], indian_fusion: [70, 130],
	indian_indie: [80, 140], indian_disco: [100, 125], industrial: [120, 140],
	jazz: [80, 160], jungle: [160, 180], latin: [90, 120],
	lofi: [65, 85], metal: [120, 180], minimal_techno: [118, 128],
	neo_soul: [85, 105], pop: [100, 130], progressive_house: [122, 130],
	psytrance: [138, 155], punk: [140, 180], rnb: [70, 100],
	reggae: [70, 90], reggaeton: [85, 100], rock: [100, 140],
	salsa: [85, 100], shoegaze: [80, 110], soul: [85, 110],
	synthwave: [95, 115], techno: [124, 138], trance: [130, 145],
	trap: [130, 160], uk_garage: [128, 136], vaporwave: [70, 90],
	world: [80, 120]
};
