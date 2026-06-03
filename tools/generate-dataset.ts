#!/usr/bin/env npx tsx

/**
 * Dataset generator for strudel intent model fine-tuning.
 *
 * Usage:
 *   npx tsx tools/generate-dataset.ts              # generate programmatic examples
 *   npx tsx tools/generate-dataset.ts --paraphrase  # + paraphrase via Haiku (needs ANTHROPIC_API_KEY)
 *   npx tsx tools/generate-dataset.ts --validate    # validate existing dataset
 *   npx tsx tools/generate-dataset.ts --split       # create train/val/test splits
 *   npx tsx tools/generate-dataset.ts --stats       # print dataset stats
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================
// SCHEMA (inline to keep tool self-contained)
// ============================================================

const GENRES = [
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
];

const MOODS = [
	'aggressive', 'anthemic', 'bright', 'chill', 'cinematic', 'cold',
	'dark', 'devotional', 'dreamy', 'energetic', 'epic', 'ethereal',
	'funky', 'gritty', 'groovy', 'happy', 'haunting', 'hypnotic',
	'intense', 'intimate', 'melancholic', 'mysterious', 'nocturnal',
	'nostalgic', 'peaceful', 'playful', 'psychedelic', 'raw', 'sad',
	'sensual', 'smooth', 'spacious', 'tense', 'uplifting', 'warm',
	'weird', 'wistful'
];

const INSTRUMENTS = [
	'arp', 'bansuri', 'bass', 'bells', 'brass', 'choir', 'clap', 'conga',
	'dhol', 'dholak', 'drums', 'flute', 'guitar', 'harmonium', 'hihat',
	'keys', 'kick', 'lead', 'marimba', 'mridangam', 'organ', 'pad',
	'percussion', 'piano', 'pluck', 'rhodes', 'santoor', 'sarod',
	'shehnai', 'sitar', 'snare', 'strings', 'sub_bass', 'synth',
	'tabla', 'tanpura', 'tom', 'tumbi', 'vocal_chop'
];

const SCALES = [
	'major', 'minor', 'dorian', 'mixolydian', 'phrygian', 'lydian', 'locrian',
	'minor_pentatonic', 'major_pentatonic', 'blues', 'harmonic_minor',
	'melodic_minor', 'chromatic', 'whole_tone', 'diminished', 'double_harmonic'
];

const KEYS = [
	'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
	'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
];

const ENERGY_LEVELS = ['very_low', 'low', 'medium_low', 'medium', 'medium_high', 'high', 'very_high'];
const BASS_STYLES = ['none', 'sub', 'deep', 'groove', 'walking', 'pluck', 'acid', 'reese', 'wobble', 'fingerstyle'];
const MELODY_TYPES = ['absent', 'simple', 'complex', 'arpeggio', 'chord', 'riff', 'atmospheric', 'call_response'];
const RHYTHM_STYLES = [
	'straight', 'swing', 'shuffle', 'syncopated', 'polyrhythmic',
	'half_time', 'double_time', 'broken_beat', 'four_on_the_floor',
	'two_step', 'waltz', 'bossa', 'clave', 'tresillo', 'triplet'
];
const EFFECT_LEVELS = ['none', 'low', 'medium', 'high'];
const FILTER_TYPES = ['none', 'lowpass', 'highpass', 'bandpass'];
const DRUM_KITS = ['TR808', 'TR909', 'TR707', 'AkaiLinn', 'acoustic', 'electronic', 'none'];
const VARIATION_LEVELS = ['low', 'medium', 'high'];

// Mood-genre affinity: which moods naturally pair with each genre
const MOOD_AFFINITY: Record<string, string[]> = {
	techno: ['dark', 'hypnotic', 'intense', 'cold', 'raw', 'energetic'],
	minimal_techno: ['hypnotic', 'spacious', 'cold', 'mysterious'],
	house: ['groovy', 'happy', 'uplifting', 'warm', 'funky'],
	deep_house: ['smooth', 'warm', 'groovy', 'nocturnal', 'sensual'],
	progressive_house: ['epic', 'uplifting', 'dreamy', 'energetic'],
	acid_house: ['hypnotic', 'psychedelic', 'raw', 'energetic'],
	trance: ['epic', 'uplifting', 'dreamy', 'ethereal', 'energetic'],
	psytrance: ['psychedelic', 'intense', 'hypnotic', 'weird'],
	dubstep: ['aggressive', 'dark', 'intense', 'gritty', 'raw'],
	drum_and_bass: ['dark', 'energetic', 'intense', 'smooth'],
	jungle: ['raw', 'energetic', 'dark', 'gritty'],
	trap: ['dark', 'aggressive', 'gritty', 'intense', 'raw'],
	hip_hop: ['groovy', 'chill', 'dark', 'raw', 'smooth'],
	boom_bap: ['nostalgic', 'raw', 'groovy', 'gritty'],
	lofi: ['chill', 'nostalgic', 'warm', 'melancholic', 'dreamy', 'peaceful'],
	desi_hip_hop: ['gritty', 'raw', 'intense', 'dark', 'aggressive'],
	ambient: ['ethereal', 'peaceful', 'spacious', 'dreamy', 'mysterious'],
	downtempo: ['chill', 'dreamy', 'warm', 'smooth', 'nocturnal'],
	jazz: ['smooth', 'groovy', 'warm', 'playful', 'intimate'],
	neo_soul: ['warm', 'smooth', 'groovy', 'intimate', 'sensual'],
	funk: ['funky', 'groovy', 'playful', 'energetic', 'happy'],
	disco: ['happy', 'groovy', 'funky', 'uplifting', 'energetic'],
	rnb: ['smooth', 'sensual', 'warm', 'intimate', 'melancholic'],
	soul: ['warm', 'smooth', 'uplifting', 'intimate'],
	pop: ['happy', 'uplifting', 'bright', 'energetic', 'playful'],
	rock: ['energetic', 'raw', 'anthemic', 'aggressive', 'intense'],
	metal: ['aggressive', 'dark', 'intense', 'raw', 'epic'],
	punk: ['raw', 'aggressive', 'energetic', 'gritty'],
	blues: ['melancholic', 'warm', 'sad', 'smooth', 'nostalgic'],
	folk: ['warm', 'peaceful', 'nostalgic', 'intimate', 'wistful'],
	country: ['warm', 'happy', 'nostalgic', 'bright'],
	classical: ['epic', 'peaceful', 'melancholic', 'bright', 'warm'],
	indian_classical: ['devotional', 'peaceful', 'hypnotic', 'mysterious', 'ethereal'],
	indian_fusion: ['dreamy', 'hypnotic', 'warm', 'cinematic', 'spacious'],
	indian_indie: ['warm', 'anthemic', 'nostalgic', 'intimate', 'wistful'],
	indian_disco: ['dreamy', 'nocturnal', 'sensual', 'nostalgic', 'warm'],
	folktronica: ['nocturnal', 'dreamy', 'warm', 'hypnotic', 'nostalgic', 'devotional'],
	flamenco: ['intense', 'raw', 'passionate', 'dark'],
	reggae: ['chill', 'warm', 'groovy', 'peaceful', 'happy'],
	reggaeton: ['energetic', 'groovy', 'playful', 'sensual'],
	afrobeat: ['groovy', 'energetic', 'warm', 'happy', 'funky'],
	latin: ['groovy', 'warm', 'energetic', 'playful'],
	salsa: ['energetic', 'groovy', 'happy', 'warm'],
	bossa_nova: ['smooth', 'warm', 'peaceful', 'intimate', 'dreamy'],
	synthwave: ['nostalgic', 'cinematic', 'dreamy', 'dark', 'epic'],
	vaporwave: ['dreamy', 'nostalgic', 'weird', 'spacious', 'chill'],
	edm: ['energetic', 'uplifting', 'happy', 'intense'],
	future_bass: ['uplifting', 'dreamy', 'happy', 'bright', 'energetic'],
	hardstyle: ['aggressive', 'intense', 'energetic', 'dark', 'raw'],
	grime: ['dark', 'gritty', 'raw', 'aggressive', 'intense'],
	garage: ['groovy', 'smooth', 'nocturnal', 'warm'],
	uk_garage: ['groovy', 'smooth', 'nocturnal', 'warm'],
	idm: ['weird', 'mysterious', 'cold', 'spacious', 'psychedelic'],
	industrial: ['dark', 'aggressive', 'cold', 'intense', 'raw'],
	darkwave: ['dark', 'melancholic', 'cold', 'mysterious', 'haunting'],
	shoegaze: ['dreamy', 'ethereal', 'warm', 'spacious', 'melancholic'],
	chillwave: ['dreamy', 'nostalgic', 'warm', 'chill', 'peaceful'],
	breakbeat: ['energetic', 'funky', 'gritty', 'groovy'],
	electro: ['energetic', 'dark', 'gritty', 'raw'],
	world: ['warm', 'peaceful', 'groovy', 'mysterious'],
};

// Genre defaults (condensed)
const GENRE_DEFAULTS: Record<string, any> = {
	techno: { tempo: 130, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909', energy: 'high', instruments: ['drums', 'bass', 'synth'], bass_style: 'sub', melody: 'absent', scale: 'minor', effects: { reverb: 'low', filter: 'lowpass', distortion: 'low' } },
	minimal_techno: { tempo: 125, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909', energy: 'medium', instruments: ['drums', 'percussion'], bass_style: 'sub', melody: 'absent', scale: 'minor', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' } },
	house: { tempo: 124, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909', energy: 'medium_high', instruments: ['drums', 'bass', 'keys'], bass_style: 'groove', melody: 'simple', scale: 'minor', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	deep_house: { tempo: 122, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909', energy: 'medium', instruments: ['drums', 'bass', 'pad', 'keys'], bass_style: 'deep', melody: 'chord', scale: 'minor', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' } },
	progressive_house: { tempo: 126, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909', energy: 'medium_high', instruments: ['drums', 'bass', 'pad', 'lead'], bass_style: 'groove', melody: 'arpeggio', scale: 'minor', effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' } },
	acid_house: { tempo: 126, rhythm_style: 'four_on_the_floor', drum_kit: 'TR808', energy: 'high', instruments: ['drums', 'bass', 'synth'], bass_style: 'acid', melody: 'riff', scale: 'minor', effects: { reverb: 'low', filter: 'lowpass', distortion: 'medium' } },
	trance: { tempo: 138, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909', energy: 'high', instruments: ['drums', 'bass', 'pad', 'lead'], bass_style: 'sub', melody: 'arpeggio', scale: 'minor', effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' } },
	psytrance: { tempo: 145, rhythm_style: 'four_on_the_floor', drum_kit: 'TR909', energy: 'very_high', instruments: ['drums', 'bass', 'lead', 'synth'], bass_style: 'acid', melody: 'arpeggio', scale: 'phrygian', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'medium' } },
	dubstep: { tempo: 140, rhythm_style: 'half_time', drum_kit: 'electronic', energy: 'very_high', instruments: ['drums', 'bass', 'synth'], bass_style: 'wobble', melody: 'simple', scale: 'minor', effects: { reverb: 'low', filter: 'lowpass', distortion: 'high' } },
	drum_and_bass: { tempo: 174, rhythm_style: 'broken_beat', drum_kit: 'electronic', energy: 'high', instruments: ['drums', 'bass', 'pad'], bass_style: 'reese', melody: 'atmospheric', scale: 'minor', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'low' } },
	jungle: { tempo: 170, rhythm_style: 'broken_beat', drum_kit: 'electronic', energy: 'high', instruments: ['drums', 'bass'], bass_style: 'sub', melody: 'absent', scale: 'minor', effects: { reverb: 'low', filter: 'lowpass', distortion: 'none' } },
	trap: { tempo: 140, rhythm_style: 'half_time', drum_kit: 'TR808', energy: 'high', instruments: ['drums', 'bass', 'hihat', 'lead'], bass_style: 'sub', melody: 'simple', scale: 'minor_pentatonic', effects: { reverb: 'medium', filter: 'none', distortion: 'low' } },
	hip_hop: { tempo: 90, rhythm_style: 'straight', drum_kit: 'TR808', energy: 'medium', instruments: ['drums', 'bass', 'keys'], bass_style: 'groove', melody: 'simple', scale: 'minor', effects: { reverb: 'low', filter: 'none', distortion: 'none' } },
	boom_bap: { tempo: 90, rhythm_style: 'swing', drum_kit: 'TR808', energy: 'medium', instruments: ['drums', 'bass', 'keys'], bass_style: 'groove', melody: 'simple', scale: 'minor', effects: { reverb: 'low', filter: 'lowpass', distortion: 'none' } },
	lofi: { tempo: 75, rhythm_style: 'swing', drum_kit: 'TR808', energy: 'low', instruments: ['drums', 'bass', 'piano', 'pad'], bass_style: 'deep', melody: 'chord', scale: 'dorian', effects: { reverb: 'high', filter: 'lowpass', distortion: 'low' } },
	desi_hip_hop: { tempo: 95, rhythm_style: 'straight', drum_kit: 'TR808', energy: 'high', instruments: ['drums', 'bass', 'tabla', 'dhol', 'synth'], bass_style: 'sub', melody: 'simple', scale: 'phrygian', effects: { reverb: 'low', filter: 'none', distortion: 'low' } },
	ambient: { tempo: 60, rhythm_style: 'straight', drum_kit: 'none', energy: 'very_low', instruments: ['pad', 'bells', 'strings'], bass_style: 'none', melody: 'atmospheric', scale: 'major', effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' } },
	downtempo: { tempo: 80, rhythm_style: 'straight', drum_kit: 'electronic', energy: 'low', instruments: ['drums', 'bass', 'pad', 'keys'], bass_style: 'deep', melody: 'atmospheric', scale: 'minor', effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' } },
	jazz: { tempo: 120, rhythm_style: 'swing', drum_kit: 'acoustic', energy: 'medium', instruments: ['drums', 'bass', 'piano', 'brass'], bass_style: 'walking', melody: 'complex', scale: 'dorian', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	neo_soul: { tempo: 95, rhythm_style: 'swing', drum_kit: 'electronic', energy: 'medium_low', instruments: ['drums', 'bass', 'rhodes', 'pad'], bass_style: 'groove', melody: 'chord', scale: 'dorian', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' } },
	funk: { tempo: 110, rhythm_style: 'syncopated', drum_kit: 'acoustic', energy: 'medium_high', instruments: ['drums', 'bass', 'guitar', 'keys'], bass_style: 'groove', melody: 'riff', scale: 'mixolydian', effects: { reverb: 'low', filter: 'none', distortion: 'none' } },
	disco: { tempo: 120, rhythm_style: 'four_on_the_floor', drum_kit: 'acoustic', energy: 'medium_high', instruments: ['drums', 'bass', 'strings', 'keys'], bass_style: 'groove', melody: 'simple', scale: 'major', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	rnb: { tempo: 85, rhythm_style: 'straight', drum_kit: 'electronic', energy: 'medium_low', instruments: ['drums', 'bass', 'keys', 'pad'], bass_style: 'groove', melody: 'simple', scale: 'minor', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' } },
	soul: { tempo: 100, rhythm_style: 'straight', drum_kit: 'acoustic', energy: 'medium', instruments: ['drums', 'bass', 'organ', 'brass'], bass_style: 'groove', melody: 'simple', scale: 'major', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	pop: { tempo: 120, rhythm_style: 'straight', drum_kit: 'TR808', energy: 'medium_high', instruments: ['drums', 'bass', 'synth', 'lead'], bass_style: 'groove', melody: 'simple', scale: 'major', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	rock: { tempo: 120, rhythm_style: 'straight', drum_kit: 'acoustic', energy: 'high', instruments: ['drums', 'bass', 'guitar'], bass_style: 'groove', melody: 'riff', scale: 'minor_pentatonic', effects: { reverb: 'low', filter: 'none', distortion: 'medium' } },
	metal: { tempo: 140, rhythm_style: 'double_time', drum_kit: 'acoustic', energy: 'very_high', instruments: ['drums', 'bass', 'guitar'], bass_style: 'groove', melody: 'riff', scale: 'phrygian', effects: { reverb: 'low', filter: 'none', distortion: 'high' } },
	punk: { tempo: 160, rhythm_style: 'straight', drum_kit: 'acoustic', energy: 'very_high', instruments: ['drums', 'bass', 'guitar'], bass_style: 'groove', melody: 'riff', scale: 'minor', effects: { reverb: 'none', filter: 'none', distortion: 'medium' } },
	blues: { tempo: 80, rhythm_style: 'shuffle', drum_kit: 'acoustic', energy: 'medium_low', instruments: ['drums', 'bass', 'guitar'], bass_style: 'walking', melody: 'riff', scale: 'blues', effects: { reverb: 'medium', filter: 'none', distortion: 'low' } },
	folk: { tempo: 100, rhythm_style: 'straight', drum_kit: 'acoustic', energy: 'low', instruments: ['guitar', 'drums'], bass_style: 'none', melody: 'simple', scale: 'major', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	folktronica: { tempo: 110, rhythm_style: 'four_on_the_floor', drum_kit: 'electronic', energy: 'medium_low', instruments: ['harmonium', 'synth', 'drums', 'pad', 'bells'], bass_style: 'deep', melody: 'simple', scale: 'phrygian', effects: { reverb: 'high', filter: 'lowpass', distortion: 'low' } },
	country: { tempo: 110, rhythm_style: 'straight', drum_kit: 'acoustic', energy: 'medium', instruments: ['drums', 'bass', 'guitar'], bass_style: 'groove', melody: 'simple', scale: 'major', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	classical: { tempo: 80, rhythm_style: 'straight', drum_kit: 'none', energy: 'medium', instruments: ['strings', 'piano'], bass_style: 'none', melody: 'complex', scale: 'major', effects: { reverb: 'high', filter: 'none', distortion: 'none' } },
	indian_classical: { tempo: 100, rhythm_style: 'straight', drum_kit: 'none', energy: 'medium', instruments: ['sitar', 'tabla', 'tanpura', 'bansuri'], bass_style: 'sub', melody: 'complex', scale: 'phrygian', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	indian_fusion: { tempo: 100, rhythm_style: 'polyrhythmic', drum_kit: 'electronic', energy: 'medium', instruments: ['tabla', 'sitar', 'synth', 'bass', 'pad', 'drums'], bass_style: 'groove', melody: 'complex', scale: 'dorian', effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' } },
	indian_indie: { tempo: 110, rhythm_style: 'straight', drum_kit: 'acoustic', energy: 'medium', instruments: ['guitar', 'drums', 'bass', 'keys'], bass_style: 'groove', melody: 'simple', scale: 'major', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	indian_disco: { tempo: 115, rhythm_style: 'four_on_the_floor', drum_kit: 'electronic', energy: 'medium_low', instruments: ['synth', 'drums', 'bass', 'pad', 'keys'], bass_style: 'groove', melody: 'chord', scale: 'minor', effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' } },
	flamenco: { tempo: 120, rhythm_style: 'syncopated', drum_kit: 'none', energy: 'medium_high', instruments: ['guitar', 'percussion', 'clap'], bass_style: 'pluck', melody: 'complex', scale: 'phrygian', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	reggae: { tempo: 80, rhythm_style: 'syncopated', drum_kit: 'acoustic', energy: 'medium_low', instruments: ['drums', 'bass', 'guitar', 'organ'], bass_style: 'deep', melody: 'simple', scale: 'minor', effects: { reverb: 'high', filter: 'none', distortion: 'none' } },
	reggaeton: { tempo: 95, rhythm_style: 'tresillo', drum_kit: 'TR808', energy: 'medium_high', instruments: ['drums', 'bass', 'synth'], bass_style: 'sub', melody: 'simple', scale: 'minor', effects: { reverb: 'low', filter: 'none', distortion: 'none' } },
	afrobeat: { tempo: 110, rhythm_style: 'polyrhythmic', drum_kit: 'acoustic', energy: 'medium_high', instruments: ['drums', 'bass', 'guitar', 'brass', 'percussion'], bass_style: 'groove', melody: 'riff', scale: 'dorian', effects: { reverb: 'low', filter: 'none', distortion: 'none' } },
	latin: { tempo: 105, rhythm_style: 'clave', drum_kit: 'acoustic', energy: 'medium_high', instruments: ['drums', 'bass', 'piano', 'percussion', 'conga'], bass_style: 'groove', melody: 'simple', scale: 'minor', effects: { reverb: 'low', filter: 'none', distortion: 'none' } },
	salsa: { tempo: 95, rhythm_style: 'clave', drum_kit: 'acoustic', energy: 'medium_high', instruments: ['drums', 'bass', 'piano', 'brass', 'conga'], bass_style: 'groove', melody: 'riff', scale: 'minor', effects: { reverb: 'low', filter: 'none', distortion: 'none' } },
	bossa_nova: { tempo: 80, rhythm_style: 'bossa', drum_kit: 'acoustic', energy: 'low', instruments: ['drums', 'bass', 'guitar', 'piano'], bass_style: 'walking', melody: 'chord', scale: 'major', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
	synthwave: { tempo: 105, rhythm_style: 'straight', drum_kit: 'electronic', energy: 'medium_high', instruments: ['drums', 'bass', 'synth', 'pad', 'lead'], bass_style: 'groove', melody: 'arpeggio', scale: 'minor', effects: { reverb: 'high', filter: 'none', distortion: 'low' } },
	vaporwave: { tempo: 80, rhythm_style: 'straight', drum_kit: 'electronic', energy: 'low', instruments: ['drums', 'bass', 'pad', 'keys'], bass_style: 'deep', melody: 'chord', scale: 'major', effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' } },
	edm: { tempo: 128, rhythm_style: 'four_on_the_floor', drum_kit: 'electronic', energy: 'high', instruments: ['drums', 'bass', 'lead', 'synth'], bass_style: 'sub', melody: 'simple', scale: 'minor', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'low' } },
	future_bass: { tempo: 150, rhythm_style: 'half_time', drum_kit: 'electronic', energy: 'high', instruments: ['drums', 'bass', 'synth', 'pad', 'vocal_chop'], bass_style: 'wobble', melody: 'chord', scale: 'major', effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' } },
	hardstyle: { tempo: 150, rhythm_style: 'four_on_the_floor', drum_kit: 'electronic', energy: 'very_high', instruments: ['drums', 'bass', 'lead'], bass_style: 'sub', melody: 'simple', scale: 'minor', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'high' } },
	grime: { tempo: 140, rhythm_style: 'syncopated', drum_kit: 'electronic', energy: 'high', instruments: ['drums', 'bass', 'synth'], bass_style: 'sub', melody: 'riff', scale: 'minor', effects: { reverb: 'low', filter: 'none', distortion: 'medium' } },
	garage: { tempo: 130, rhythm_style: 'two_step', drum_kit: 'electronic', energy: 'medium_high', instruments: ['drums', 'bass', 'pad', 'vocal_chop'], bass_style: 'deep', melody: 'simple', scale: 'minor', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' } },
	uk_garage: { tempo: 132, rhythm_style: 'two_step', drum_kit: 'electronic', energy: 'medium_high', instruments: ['drums', 'bass', 'pad'], bass_style: 'deep', melody: 'simple', scale: 'minor', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' } },
	idm: { tempo: 120, rhythm_style: 'broken_beat', drum_kit: 'electronic', energy: 'medium', instruments: ['drums', 'bass', 'synth', 'bells'], bass_style: 'groove', melody: 'complex', scale: 'minor', effects: { reverb: 'medium', filter: 'lowpass', distortion: 'low' } },
	industrial: { tempo: 130, rhythm_style: 'straight', drum_kit: 'electronic', energy: 'very_high', instruments: ['drums', 'bass', 'synth'], bass_style: 'sub', melody: 'absent', scale: 'minor', effects: { reverb: 'low', filter: 'none', distortion: 'high' } },
	darkwave: { tempo: 110, rhythm_style: 'straight', drum_kit: 'electronic', energy: 'medium', instruments: ['drums', 'bass', 'synth', 'pad'], bass_style: 'deep', melody: 'atmospheric', scale: 'minor', effects: { reverb: 'high', filter: 'lowpass', distortion: 'low' } },
	shoegaze: { tempo: 95, rhythm_style: 'straight', drum_kit: 'acoustic', energy: 'medium', instruments: ['drums', 'bass', 'guitar', 'pad'], bass_style: 'deep', melody: 'atmospheric', scale: 'major', effects: { reverb: 'high', filter: 'lowpass', distortion: 'medium' } },
	chillwave: { tempo: 90, rhythm_style: 'straight', drum_kit: 'electronic', energy: 'low', instruments: ['drums', 'bass', 'synth', 'pad'], bass_style: 'deep', melody: 'atmospheric', scale: 'major', effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' } },
	breakbeat: { tempo: 130, rhythm_style: 'broken_beat', drum_kit: 'electronic', energy: 'high', instruments: ['drums', 'bass', 'synth'], bass_style: 'groove', melody: 'riff', scale: 'minor', effects: { reverb: 'low', filter: 'lowpass', distortion: 'low' } },
	electro: { tempo: 128, rhythm_style: 'straight', drum_kit: 'TR808', energy: 'high', instruments: ['drums', 'bass', 'synth', 'lead'], bass_style: 'groove', melody: 'riff', scale: 'minor', effects: { reverb: 'low', filter: 'lowpass', distortion: 'medium' } },
	world: { tempo: 100, rhythm_style: 'polyrhythmic', drum_kit: 'acoustic', energy: 'medium', instruments: ['drums', 'percussion', 'bass', 'flute'], bass_style: 'groove', melody: 'simple', scale: 'dorian', effects: { reverb: 'medium', filter: 'none', distortion: 'none' } },
};

const BPM_RANGES: Record<string, [number, number]> = {
	acid_house: [120, 130], afrobeat: [100, 120], ambient: [50, 80],
	blues: [60, 100], boom_bap: [80, 100], bossa_nova: [70, 90],
	breakbeat: [120, 140], chillwave: [80, 100], classical: [60, 120],
	country: [100, 130], darkwave: [100, 120], deep_house: [118, 126],
	desi_hip_hop: [85, 140], disco: [115, 125], downtempo: [70, 100],
	drum_and_bass: [160, 180], dubstep: [135, 145], edm: [124, 132],
	electro: [120, 135], flamenco: [80, 140], folk: [80, 120],
	folktronica: [95, 125], funk: [95, 120], future_bass: [140, 160],
	garage: [125, 135], grime: [135, 145], hardstyle: [145, 155],
	hip_hop: [80, 100], house: [118, 130], idm: [90, 140],
	indian_classical: [60, 120], indian_fusion: [70, 130],
	indian_indie: [80, 140], indian_disco: [100, 125], industrial: [120, 140],
	jazz: [80, 160], jungle: [160, 180], latin: [90, 120],
	lofi: [65, 85], metal: [120, 180], minimal_techno: [118, 128],
	neo_soul: [85, 105], pop: [100, 130], progressive_house: [122, 130],
	psytrance: [138, 155], punk: [140, 180], rnb: [70, 100],
	reggae: [70, 90], reggaeton: [85, 100], rock: [100, 140],
	salsa: [85, 100], shoegaze: [80, 110], soul: [85, 110],
	synthwave: [95, 115], techno: [124, 138], trance: [130, 145],
	trap: [130, 160], uk_garage: [128, 136], vaporwave: [70, 90],
	world: [80, 120],
};

// Genre → common keys (musically appropriate)
const GENRE_KEYS: Record<string, string[]> = {
	blues: ['E', 'A', 'G', 'D', 'C'],
	jazz: ['Bb', 'Eb', 'F', 'C', 'Ab', 'Db'],
	neo_soul: ['Bb', 'Eb', 'Ab', 'F', 'C'],
	indian_classical: ['C', 'D', 'G', 'A'],
	indian_fusion: ['C', 'D', 'G', 'A', 'E'],
	indian_indie: ['C', 'G', 'D', 'A', 'E'],
	indian_disco: ['C', 'D', 'A', 'G'],
	desi_hip_hop: ['C', 'D', 'E', 'A', 'G'],
	folktronica: ['C', 'D', 'A', 'G'],
	flamenco: ['E', 'A', 'D'],
	classical: ['C', 'G', 'D', 'F', 'Bb', 'A'],
	folk: ['C', 'G', 'D', 'A', 'E'],
	country: ['G', 'C', 'D', 'A', 'E'],
	rock: ['E', 'A', 'G', 'D', 'C'],
	metal: ['E', 'D', 'C', 'A', 'B'],
	punk: ['E', 'A', 'D', 'G', 'C'],
	pop: ['C', 'G', 'D', 'A', 'F'],
	reggae: ['G', 'C', 'D', 'A', 'E'],
	bossa_nova: ['C', 'F', 'G', 'D'],
	latin: ['C', 'D', 'A', 'G', 'F'],
	salsa: ['C', 'D', 'G', 'F', 'A'],
	afrobeat: ['D', 'E', 'G', 'A'],
};
const DEFAULT_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'];

// Genre → default mood when none specified
const GENRE_DEFAULT_MOOD: Record<string, string[]> = {
	acid_house: ['hypnotic'], afrobeat: ['groovy'], ambient: ['peaceful'],
	blues: ['melancholic'], boom_bap: ['nostalgic'], bossa_nova: ['smooth'],
	breakbeat: ['energetic'], chillwave: ['dreamy'], classical: ['epic'],
	country: ['warm'], darkwave: ['dark'], deep_house: ['smooth'],
	desi_hip_hop: ['gritty'], disco: ['happy'], downtempo: ['chill'],
	drum_and_bass: ['intense'], dubstep: ['aggressive'], edm: ['energetic'],
	electro: ['gritty'], flamenco: ['intense'], folk: ['warm'],
	folktronica: ['nocturnal'], funk: ['funky'], future_bass: ['uplifting'],
	garage: ['groovy'], grime: ['dark'], hardstyle: ['aggressive'],
	hip_hop: ['groovy'], house: ['groovy'], idm: ['weird'],
	indian_classical: ['peaceful'], indian_fusion: ['dreamy'], indian_indie: ['warm'],
	indian_disco: ['nocturnal'], industrial: ['dark'], jazz: ['smooth'],
	jungle: ['raw'], latin: ['groovy'], lofi: ['chill'],
	metal: ['aggressive'], minimal_techno: ['hypnotic'], neo_soul: ['warm'],
	pop: ['happy'], progressive_house: ['uplifting'], psytrance: ['psychedelic'],
	punk: ['raw'], rnb: ['smooth'], reggae: ['chill'],
	reggaeton: ['energetic'], rock: ['energetic'], salsa: ['energetic'],
	shoegaze: ['dreamy'], soul: ['warm'], synthwave: ['nostalgic'],
	techno: ['dark'], trance: ['uplifting'], trap: ['dark'],
	uk_garage: ['groovy'], vaporwave: ['dreamy'], world: ['warm'],
};

// Diverse prompt templates per genre type
const PROMPT_TEMPLATES_BEAT = [
	(g: string) => `${g} beat`,
	(g: string) => `make a ${g} beat`,
	(g: string) => `create a ${g} pattern`,
	(g: string) => `give me a ${g} groove`,
	(g: string) => `I want a ${g} track`,
	(g: string) => `play some ${g}`,
	(g: string) => `${g} loop`,
	(g: string) => `something ${g}`,
];

const PROMPT_TEMPLATES_NO_BEAT = [
	(g: string) => `${g} soundscape`,
	(g: string) => `create a ${g} texture`,
	(g: string) => `${g} atmosphere`,
	(g: string) => `make some ${g} music`,
	(g: string) => `play some ${g}`,
	(g: string) => `I want ${g}`,
];

const NO_BEAT_GENRES = new Set(['ambient', 'classical', 'downtempo', 'shoegaze', 'chillwave', 'darkwave', 'vaporwave']);

// ============================================================
// HELPERS
// ============================================================

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
	const shuffled = [...arr].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, n);
}

function randInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function bpmInRange(genre: string): number {
	const [lo, hi] = BPM_RANGES[genre] || [90, 130];
	return randInt(lo, hi);
}

function bpmLow(genre: string): number {
	const [lo, hi] = BPM_RANGES[genre] || [90, 130];
	return randInt(lo, lo + Math.floor((hi - lo) * 0.3));
}

function bpmHigh(genre: string): number {
	const [lo, hi] = BPM_RANGES[genre] || [90, 130];
	return randInt(lo + Math.floor((hi - lo) * 0.7), hi);
}

function genrePretty(g: string): string {
	return g.replace(/_/g, ' ');
}

function genreKey(genre: string): string {
	const keys = GENRE_KEYS[genre] || DEFAULT_KEYS;
	return pick(keys);
}

function genrePromptTemplate(genre: string): (g: string) => string {
	const templates = NO_BEAT_GENRES.has(genre) ? PROMPT_TEMPLATES_NO_BEAT : PROMPT_TEMPLATES_BEAT;
	return pick(templates);
}

function makeIntent(genre: string, overrides: Record<string, any> = {}): any {
	const base = GENRE_DEFAULTS[genre];
	if (!base) return null;
	const defaultMood = GENRE_DEFAULT_MOOD[genre] || [];
	return {
		genre,
		tempo: base.tempo,
		key: genreKey(genre),
		scale: base.scale,
		mood: defaultMood,
		energy: base.energy,
		instruments: [...base.instruments],
		drum_kit: base.drum_kit,
		melody: base.melody,
		bass_style: base.bass_style,
		rhythm_style: base.rhythm_style,
		variation: 'low',
		effects: { ...base.effects },
		...overrides
	};
}

interface Example {
	prompt: string;
	intent: any;
}

// ============================================================
// GENERATORS
// ============================================================

function genBaseGenre(): Example[] {
	const examples: Example[] = [];
	for (const genre of GENRES) {
		if (!GENRE_DEFAULTS[genre]) continue;
		const pretty = genrePretty(genre);
		const templates = NO_BEAT_GENRES.has(genre) ? PROMPT_TEMPLATES_NO_BEAT : PROMPT_TEMPLATES_BEAT;
		for (const tmpl of templates.slice(0, 3)) {
			examples.push({
				prompt: tmpl(pretty),
				intent: makeIntent(genre)
			});
		}
	}
	return examples;
}

function genMoodVariations(): Example[] {
	const examples: Example[] = [];
	for (const genre of GENRES) {
		const moods = MOOD_AFFINITY[genre];
		if (!moods || !GENRE_DEFAULTS[genre]) continue;
		for (let i = 0; i < Math.min(moods.length, 5); i++) {
			const mood = moods[i];
			examples.push({
				prompt: `${mood} ${genrePretty(genre)}`,
				intent: makeIntent(genre, { mood: [mood] })
			});
		}
		// Dual mood combos
		if (moods.length >= 2) {
			for (let i = 0; i < 2; i++) {
				const pair = pickN(moods, 2);
				examples.push({
					prompt: `${pair[0]} and ${pair[1]} ${genrePretty(genre)} beat`,
					intent: makeIntent(genre, { mood: pair })
				});
			}
		}
	}
	return examples;
}

function genTempoVariations(): Example[] {
	const examples: Example[] = [];
	for (const genre of GENRES) {
		if (!GENRE_DEFAULTS[genre]) continue;
		const slow = bpmLow(genre);
		const fast = bpmHigh(genre);
		examples.push({
			prompt: `slow ${genrePretty(genre)} at ${slow} bpm`,
			intent: makeIntent(genre, { tempo: slow })
		});
		examples.push({
			prompt: `fast ${genrePretty(genre)} at ${fast} bpm`,
			intent: makeIntent(genre, { tempo: fast })
		});
		const specific = bpmInRange(genre);
		examples.push({
			prompt: `${genrePretty(genre)} beat at ${specific} bpm`,
			intent: makeIntent(genre, { tempo: specific })
		});
	}
	return examples;
}

function genInstrumentOverrides(): Example[] {
	const examples: Example[] = [];
	const addInstruments = ['sitar', 'piano', 'guitar', 'flute', 'brass', 'strings', 'tabla', 'harmonium', 'bells', 'choir'];
	for (const genre of GENRES) {
		if (!GENRE_DEFAULTS[genre]) continue;
		for (let i = 0; i < 3; i++) {
			const inst = pick(addInstruments);
			const base = GENRE_DEFAULTS[genre];
			const instruments = [...new Set([...base.instruments, inst])];
			examples.push({
				prompt: `${genrePretty(genre)} with ${inst.replace(/_/g, ' ')}`,
				intent: makeIntent(genre, { instruments })
			});
		}
	}
	return examples;
}

function genEnergyVariations(): Example[] {
	const examples: Example[] = [];
	const energyConfig: Record<string, { words: string[]; moods: string[] }> = {
		very_low: { words: ['ambient', 'meditative', 'barely there'], moods: ['peaceful', 'ethereal'] },
		low: { words: ['chill', 'relaxed', 'calm', 'laid-back'], moods: ['chill', 'peaceful'] },
		medium_low: { words: ['mellow', 'easygoing', 'smooth'], moods: ['smooth', 'warm'] },
		medium: { words: ['steady', 'moderate', 'groovy'], moods: ['groovy'] },
		medium_high: { words: ['upbeat', 'driving', 'lively'], moods: ['energetic', 'uplifting'] },
		high: { words: ['intense', 'hard', 'heavy', 'powerful'], moods: ['intense', 'dark'] },
		very_high: { words: ['frantic', 'brutal', 'relentless'], moods: ['aggressive', 'intense'] }
	};
	for (const genre of GENRES) {
		if (!GENRE_DEFAULTS[genre]) continue;
		for (const [energy, config] of Object.entries(energyConfig)) {
			const word = pick(config.words);
			examples.push({
				prompt: `${word} ${genrePretty(genre)}`,
				intent: makeIntent(genre, { energy, mood: [pick(config.moods)] })
			});
		}
	}
	return examples;
}

function genScaleVariations(): Example[] {
	const examples: Example[] = [];
	const scaleWords: Record<string, string> = {
		major: 'happy', minor: 'dark', dorian: 'jazzy', phrygian: 'eastern',
		mixolydian: 'bluesy', lydian: 'dreamy', blues: 'bluesy',
		minor_pentatonic: 'pentatonic', harmonic_minor: 'arabic sounding'
	};
	for (const genre of GENRES) {
		if (!GENRE_DEFAULTS[genre]) continue;
		for (const [scale, word] of Object.entries(scaleWords)) {
			const key = pick(KEYS.filter(k => !k.includes('#') && !k.includes('b')));
			examples.push({
				prompt: `${genrePretty(genre)} in ${key} ${scale.replace(/_/g, ' ')}`,
				intent: makeIntent(genre, { key, scale })
			});
		}
	}
	return examples;
}

function genFusion(): Example[] {
	const examples: Example[] = [];
	const fusions: [string, string][] = [
		['jazz', 'hip_hop'], ['rock', 'indian_classical'], ['techno', 'indian_fusion'],
		['lofi', 'jazz'], ['house', 'funk'], ['ambient', 'indian_classical'],
		['trap', 'desi_hip_hop'], ['folk', 'electro'], ['blues', 'rock'],
		['afrobeat', 'house'], ['classical', 'ambient'],
		['indian_classical', 'drum_and_bass'], ['folktronica', 'ambient'],
		['soul', 'hip_hop'], ['bossa_nova', 'jazz'], ['synthwave', 'pop'],
		['metal', 'industrial'], ['latin', 'house'], ['desi_hip_hop', 'trap'],
		['indian_disco', 'deep_house'], ['indian_indie', 'folk'],
		['rock', 'punk'], ['jazz', 'funk'], ['dubstep', 'trap'],
		['indian_fusion', 'ambient'], ['folktronica', 'house'],
		['desi_hip_hop', 'boom_bap'], ['indian_classical', 'ambient'],
		['rock', 'blues'], ['jazz', 'lofi'], ['techno', 'ambient'],
		['house', 'disco'], ['trap', 'edm'], ['folk', 'indian_indie'],
		['funk', 'disco'], ['rnb', 'jazz'], ['pop', 'edm'],
		['reggae', 'hip_hop'], ['afrobeat', 'funk'], ['classical', 'indian_classical'],
		['synthwave', 'darkwave'], ['psytrance', 'techno'], ['jungle', 'drum_and_bass'],
		['grime', 'trap'], ['garage', 'house'], ['downtempo', 'jazz'],
		['neo_soul', 'lofi'], ['blues', 'jazz'], ['rock', 'metal'],
		['country', 'folk'], ['latin', 'jazz'], ['flamenco', 'indian_classical'],
		['reggaeton', 'trap'], ['soul', 'funk'], ['chillwave', 'ambient'],
	];
	const fusionTemplates = [
		(g1: string, g2: string) => `${g1} meets ${g2}`,
		(g1: string, g2: string) => `mix of ${g1} and ${g2}`,
		(g1: string, g2: string) => `${g1} with ${g2} influences`,
		(g1: string, g2: string) => `${g1} ${g2} fusion`,
		(g1: string, g2: string) => `blend ${g1} and ${g2}`,
	];
	for (const [g1, g2] of fusions) {
		const base1 = GENRE_DEFAULTS[g1];
		const base2 = GENRE_DEFAULTS[g2];
		if (!base1 || !base2) continue;
		const instruments = [...new Set([...base1.instruments, ...base2.instruments])].slice(0, 6);
		const tempo = Math.round((base1.tempo + base2.tempo) / 2);
		const [lo, hi] = BPM_RANGES[g1] || [60, 180];
		const clampedTempo = Math.max(lo, Math.min(hi, tempo));
		let drum_kit = base1.drum_kit;
		if (drum_kit === 'none' && instruments.includes('drums')) {
			drum_kit = base2.drum_kit !== 'none' ? base2.drum_kit : 'electronic';
		}
		const tmpl = pick(fusionTemplates);
		examples.push({
			prompt: tmpl(genrePretty(g1), genrePretty(g2)),
			intent: makeIntent(g1, { instruments, tempo: clampedTempo, drum_kit, mood: pickN(MOOD_AFFINITY[g1] || MOODS, 2) })
		});
	}
	return examples;
}

function genEffectsVariations(): Example[] {
	const examples: Example[] = [];
	const effectPrompts: [string, any][] = [
		['with lots of reverb', { effects: { reverb: 'high', filter: 'none', distortion: 'none' } }],
		['with heavy distortion', { effects: { reverb: 'none', filter: 'none', distortion: 'high' } }],
		['warm and filtered', { effects: { reverb: 'medium', filter: 'lowpass', distortion: 'none' } }],
		['bright and clean', { effects: { reverb: 'low', filter: 'highpass', distortion: 'none' } }],
		['lo-fi and crushed', { effects: { reverb: 'medium', filter: 'lowpass', distortion: 'medium' } }],
		['spacious and wet', { effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' } }],
		['dry and punchy', { effects: { reverb: 'none', filter: 'none', distortion: 'low' } }],
	];
	for (const genre of GENRES) {
		if (!GENRE_DEFAULTS[genre]) continue;
		for (const [desc, override] of effectPrompts) {
			examples.push({
				prompt: `${genrePretty(genre)} ${desc}`,
				intent: makeIntent(genre, override)
			});
		}
	}
	return examples;
}

function genModifications(): Example[] {
	const examples: Example[] = [];
	const m = (prompt: string, delta: any) => ({ prompt, intent: { action: 'modify' as const, delta } });

	// Effects
	examples.push(m('add reverb', { effects: { reverb: 'high' } }));
	examples.push(m('more reverb', { effects: { reverb: 'high' } }));
	examples.push(m('add lots of reverb', { effects: { reverb: 'high' } }));
	examples.push(m('less reverb', { effects: { reverb: 'low' } }));
	examples.push(m('remove reverb', { effects: { reverb: 'none' } }));
	examples.push(m('no reverb', { effects: { reverb: 'none' } }));
	examples.push(m('make it dry', { effects: { reverb: 'none' } }));
	examples.push(m('add delay', { effects: { delay: 'high' } }));
	examples.push(m('more delay', { effects: { delay: 'high' } }));
	examples.push(m('add echo', { effects: { delay: 'medium' } }));
	examples.push(m('remove delay', { effects: { delay: 'none' } }));
	examples.push(m('add distortion', { effects: { distortion: 'high' } }));
	examples.push(m('make it gritty', { effects: { distortion: 'medium' } }));
	examples.push(m('add crunch', { effects: { distortion: 'medium' } }));
	examples.push(m('remove distortion', { effects: { distortion: 'none' } }));
	examples.push(m('clean it up', { effects: { distortion: 'none' } }));
	examples.push(m('add filter', { effects: { filter: 'lowpass' } }));
	examples.push(m('add lowpass filter', { effects: { filter: 'lowpass' } }));
	examples.push(m('make it warmer', { effects: { filter: 'lowpass' } }));
	examples.push(m('muffle it', { effects: { filter: 'lowpass' } }));
	examples.push(m('make it brighter', { effects: { filter: 'highpass' } }));
	examples.push(m('add highpass', { effects: { filter: 'highpass' } }));
	examples.push(m('remove filter', { effects: { filter: 'none' } }));

	// Tempo
	examples.push(m('make it faster', { tempo: '+20' }));
	examples.push(m('speed it up', { tempo: '+20' }));
	examples.push(m('faster', { tempo: '+15' }));
	examples.push(m('way faster', { tempo: '+40' }));
	examples.push(m('double the speed', { tempo: '*2' }));
	examples.push(m('slow it down', { tempo: '-20' }));
	examples.push(m('make it slower', { tempo: '-20' }));
	examples.push(m('slower', { tempo: '-15' }));
	examples.push(m('half speed', { tempo: '*0.5' }));
	examples.push(m('set tempo to 120', { tempo: 120 }));
	examples.push(m('change bpm to 90', { tempo: 90 }));
	examples.push(m('140 bpm', { tempo: 140 }));
	examples.push(m('80 bpm please', { tempo: 80 }));

	// Mood/scale
	examples.push(m('make it darker', { mood: ['dark'], scale: 'minor' }));
	examples.push(m('darker', { mood: ['dark'], scale: 'minor' }));
	examples.push(m('make it happier', { mood: ['happy'], scale: 'major' }));
	examples.push(m('more uplifting', { mood: ['uplifting'], scale: 'major' }));
	examples.push(m('make it sadder', { mood: ['sad', 'melancholic'], scale: 'minor' }));
	examples.push(m('more aggressive', { mood: ['aggressive'], energy: 'high' }));
	examples.push(m('chill it out', { mood: ['chill'], energy: 'low' }));
	examples.push(m('make it dreamy', { mood: ['dreamy'], effects: { reverb: 'high' } }));
	examples.push(m('more hypnotic', { mood: ['hypnotic'], variation: 'low' }));
	examples.push(m('make it epic', { mood: ['epic'], energy: 'high' }));
	examples.push(m('more mysterious', { mood: ['mysterious'], scale: 'phrygian' }));
	examples.push(m('make it funky', { mood: ['funky'], rhythm_style: 'syncopated' }));

	// Instruments
	examples.push(m('add piano', { add_instrument: 'piano' }));
	examples.push(m('throw in some piano', { add_instrument: 'piano' }));
	examples.push(m('add sitar', { add_instrument: 'sitar' }));
	examples.push(m('add guitar', { add_instrument: 'guitar' }));
	examples.push(m('add strings', { add_instrument: 'strings' }));
	examples.push(m('add flute', { add_instrument: 'flute' }));
	examples.push(m('add tabla', { add_instrument: 'tabla' }));
	examples.push(m('add brass', { add_instrument: 'brass' }));
	examples.push(m('add bells', { add_instrument: 'bells' }));
	examples.push(m('add choir', { add_instrument: 'choir' }));
	examples.push(m('add pad', { add_instrument: 'pad' }));
	examples.push(m('add bass', { add_instrument: 'bass' }));
	examples.push(m('remove drums', { remove_instrument: 'drums', drum_kit: 'none' }));
	examples.push(m('take out the drums', { remove_instrument: 'drums', drum_kit: 'none' }));
	examples.push(m('remove bass', { remove_instrument: 'bass' }));
	examples.push(m('remove piano', { remove_instrument: 'piano' }));

	// Drum kit
	examples.push(m('switch to 808', { drum_kit: 'TR808' }));
	examples.push(m('use 808 drums', { drum_kit: 'TR808' }));
	examples.push(m('switch to 909', { drum_kit: 'TR909' }));
	examples.push(m('use 909', { drum_kit: 'TR909' }));
	examples.push(m('acoustic drums', { drum_kit: 'acoustic' }));
	examples.push(m('electronic drums', { drum_kit: 'electronic' }));

	// Rhythm
	examples.push(m('add swing', { rhythm_style: 'swing' }));
	examples.push(m('make it swing', { rhythm_style: 'swing' }));
	examples.push(m('add shuffle', { rhythm_style: 'shuffle' }));
	examples.push(m('straight rhythm', { rhythm_style: 'straight' }));
	examples.push(m('make it syncopated', { rhythm_style: 'syncopated' }));
	examples.push(m('half time feel', { rhythm_style: 'half_time' }));
	examples.push(m('double time', { rhythm_style: 'double_time' }));

	// Complexity
	examples.push(m('make it more complex', { melody: 'complex', variation: 'high' }));
	examples.push(m('add more variation', { variation: 'high' }));
	examples.push(m('make it evolve more', { variation: 'high' }));
	examples.push(m('simplify it', { melody: 'simple', variation: 'low' }));
	examples.push(m('keep it simple', { melody: 'simple', variation: 'low' }));
	examples.push(m('strip it back', { melody: 'simple', variation: 'low' }));

	// Key changes
	examples.push(m('change key to D minor', { key: 'D', scale: 'minor' }));
	examples.push(m('transpose to E', { key: 'E' }));
	examples.push(m('switch to major', { scale: 'major' }));
	examples.push(m('switch to minor', { scale: 'minor' }));
	examples.push(m('change to dorian', { scale: 'dorian' }));
	examples.push(m('phrygian scale', { scale: 'phrygian' }));
	examples.push(m('use pentatonic', { scale: 'minor_pentatonic' }));
	examples.push(m('blues scale', { scale: 'blues' }));

	// Volume/energy
	examples.push(m('louder', { energy: 'high' }));
	examples.push(m('quieter', { energy: 'low' }));
	examples.push(m('more energy', { energy: 'high' }));
	examples.push(m('less energy', { energy: 'low' }));
	examples.push(m('turn it up', { energy: 'high' }));
	examples.push(m('bring it down', { energy: 'low' }));

	return examples;
}

function genEdgeCases(): Example[] {
	return [
		// Stop variations
		{ prompt: 'stop', intent: { action: 'stop' } },
		{ prompt: 'stop the music', intent: { action: 'stop' } },
		{ prompt: 'stop it', intent: { action: 'stop' } },
		{ prompt: 'silence', intent: { action: 'stop' } },
		{ prompt: 'pause', intent: { action: 'stop' } },
		{ prompt: 'shut up', intent: { action: 'stop' } },
		{ prompt: 'quiet', intent: { action: 'stop' } },
		{ prompt: 'mute', intent: { action: 'stop' } },
		{ prompt: 'enough', intent: { action: 'stop' } },
		{ prompt: 'kill it', intent: { action: 'stop' } },
		{ prompt: 'turn it off', intent: { action: 'stop' } },
		{ prompt: 'hush', intent: { action: 'stop' } },
		{ prompt: 'shh', intent: { action: 'stop' } },
		{ prompt: 'end', intent: { action: 'stop' } },
		{ prompt: 'done', intent: { action: 'stop' } },

		// Vague / creative prompts
		{ prompt: 'something cool', intent: makeIntent('techno', { mood: ['hypnotic'] }) },
		{ prompt: 'surprise me', intent: makeIntent('house', { mood: ['groovy'] }) },
		{ prompt: 'anything', intent: makeIntent('pop', { mood: ['happy'] }) },
		{ prompt: 'make music', intent: makeIntent('house', { mood: ['groovy'] }) },
		{ prompt: 'play something', intent: makeIntent('hip_hop', { mood: ['groovy'] }) },
		{ prompt: 'just vibe', intent: makeIntent('lofi', { mood: ['chill'] }) },
		{ prompt: 'go crazy', intent: makeIntent('dubstep', { energy: 'very_high', mood: ['aggressive'] }) },
		{ prompt: 'something weird', intent: makeIntent('idm', { mood: ['weird'] }) },
		{ prompt: 'experiment', intent: makeIntent('idm', { mood: ['weird', 'mysterious'] }) },
		{ prompt: 'whatever you want', intent: makeIntent('house', { mood: ['groovy'] }) },

		// Single word instruments
		{ prompt: 'beat', intent: makeIntent('hip_hop') },
		{ prompt: 'drums', intent: makeIntent('techno', { instruments: ['drums'], melody: 'absent' }) },
		{ prompt: 'bass', intent: makeIntent('hip_hop', { instruments: ['bass'], melody: 'absent' }) },
		{ prompt: 'piano', intent: makeIntent('classical', { instruments: ['piano'], mood: ['peaceful'] }) },
		{ prompt: 'guitar', intent: makeIntent('rock', { instruments: ['guitar', 'drums'], mood: ['energetic'] }) },
		{ prompt: 'sitar', intent: makeIntent('indian_classical', { instruments: ['sitar', 'tabla'] }) },
		{ prompt: 'synth', intent: makeIntent('synthwave', { instruments: ['synth', 'drums'] }) },
		{ prompt: 'strings', intent: makeIntent('classical', { instruments: ['strings'] }) },

		// Indian specific
		{ prompt: 'something indian', intent: makeIntent('indian_classical') },
		{ prompt: 'bollywood vibes', intent: makeIntent('indian_disco') },
		{ prompt: 'like lifafa', intent: makeIntent('folktronica') },
		{ prompt: 'desi beat', intent: makeIntent('desi_hip_hop') },
		{ prompt: 'raga feel', intent: makeIntent('indian_classical', { mood: ['devotional'] }) },
		{ prompt: 'dhol pattern', intent: makeIntent('desi_hip_hop', { instruments: ['dhol', 'drums'] }) },
		{ prompt: 'tabla solo', intent: makeIntent('indian_classical', { instruments: ['tabla'], melody: 'absent' }) },
		{ prompt: 'indian vibes', intent: makeIntent('indian_fusion', { mood: ['dreamy'] }) },
		{ prompt: 'sufi feel', intent: makeIntent('indian_classical', { mood: ['devotional', 'hypnotic'] }) },
		{ prompt: 'punjabi beat', intent: makeIntent('desi_hip_hop', { instruments: ['dhol', 'tumbi', 'drums', 'bass'] }) },

		// Activity-based
		{ prompt: 'party music', intent: makeIntent('edm', { energy: 'high', mood: ['energetic'] }) },
		{ prompt: 'study music', intent: makeIntent('lofi', { energy: 'low', mood: ['chill'] }) },
		{ prompt: 'meditation', intent: makeIntent('ambient', { energy: 'very_low', mood: ['peaceful'] }) },
		{ prompt: 'workout music', intent: makeIntent('edm', { energy: 'very_high', mood: ['energetic'] }) },
		{ prompt: 'focus music', intent: makeIntent('ambient', { energy: 'very_low', mood: ['peaceful'] }) },
		{ prompt: 'sleep music', intent: makeIntent('ambient', { energy: 'very_low', mood: ['peaceful', 'dreamy'] }) },
		{ prompt: 'cooking music', intent: makeIntent('jazz', { energy: 'medium_low', mood: ['smooth', 'warm'] }) },
		{ prompt: 'driving music', intent: makeIntent('rock', { energy: 'medium_high', mood: ['energetic'] }) },
		{ prompt: 'coding music', intent: makeIntent('lofi', { energy: 'low', mood: ['chill'] }) },
		{ prompt: 'gym playlist', intent: makeIntent('trap', { energy: 'very_high', mood: ['aggressive'] }) },
		{ prompt: 'yoga music', intent: makeIntent('ambient', { energy: 'very_low', mood: ['peaceful'] }) },

		// Vibe-based
		{ prompt: 'romantic', intent: makeIntent('bossa_nova', { mood: ['intimate', 'warm'] }) },
		{ prompt: 'sad piano', intent: makeIntent('classical', { mood: ['sad', 'melancholic'], instruments: ['piano'] }) },
		{ prompt: 'angry metal', intent: makeIntent('metal', { mood: ['aggressive'], energy: 'very_high' }) },
		{ prompt: 'space vibes', intent: makeIntent('ambient', { mood: ['spacious', 'ethereal'] }) },
		{ prompt: 'club banger', intent: makeIntent('techno', { energy: 'very_high', mood: ['intense'] }) },
		{ prompt: 'coffeeshop jazz', intent: makeIntent('jazz', { energy: 'low', mood: ['smooth', 'warm'] }) },
		{ prompt: 'rainy day', intent: makeIntent('lofi', { mood: ['melancholic', 'peaceful'] }) },
		{ prompt: 'driving at night', intent: makeIntent('synthwave', { mood: ['nocturnal', 'dreamy'] }) },
		{ prompt: 'festival energy', intent: makeIntent('edm', { energy: 'very_high', mood: ['energetic'] }) },
		{ prompt: 'underwater', intent: makeIntent('ambient', { effects: { reverb: 'high', filter: 'lowpass', distortion: 'none' }, mood: ['dreamy'] }) },
		{ prompt: 'sunset vibes', intent: makeIntent('deep_house', { mood: ['warm', 'smooth'] }) },
		{ prompt: 'midnight groove', intent: makeIntent('deep_house', { mood: ['nocturnal', 'groovy'] }) },
		{ prompt: 'morning raga', intent: makeIntent('indian_classical', { mood: ['peaceful'] }) },
		{ prompt: 'late night chill', intent: makeIntent('lofi', { mood: ['nocturnal', 'chill'] }) },
		{ prompt: 'desert vibes', intent: makeIntent('world', { mood: ['mysterious', 'warm'], scale: 'phrygian' }) },
		{ prompt: 'forest ambience', intent: makeIntent('ambient', { mood: ['peaceful', 'mysterious'] }) },
		{ prompt: 'city at night', intent: makeIntent('techno', { mood: ['nocturnal', 'dark'] }) },
		{ prompt: 'beach party', intent: makeIntent('reggaeton', { mood: ['energetic', 'happy'] }) },
		{ prompt: 'campfire', intent: makeIntent('folk', { mood: ['warm', 'intimate'], instruments: ['guitar'] }) },
		{ prompt: 'retro arcade', intent: makeIntent('synthwave', { mood: ['nostalgic', 'playful'] }) },
	];
}

// ============================================================
// MAIN
// ============================================================

const OUT_DIR = join(process.cwd(), 'data');
const OUT_FILE = join(OUT_DIR, 'dataset.jsonl');

function generate(): Example[] {
	console.log('Generating programmatic examples...\n');

	const base = genBaseGenre();
	console.log(`  Base genre:        ${base.length}`);

	const moods = genMoodVariations();
	console.log(`  Mood variations:   ${moods.length}`);

	const tempos = genTempoVariations();
	console.log(`  Tempo variations:  ${tempos.length}`);

	const instruments = genInstrumentOverrides();
	console.log(`  Instrument swaps:  ${instruments.length}`);

	const energy = genEnergyVariations();
	console.log(`  Energy variations: ${energy.length}`);

	const scales = genScaleVariations();
	console.log(`  Scale variations:  ${scales.length}`);

	const fusions = genFusion();
	console.log(`  Fusions:           ${fusions.length}`);

	const effects = genEffectsVariations();
	console.log(`  Effects:           ${effects.length}`);

	const mods = genModifications();
	console.log(`  Modifications:     ${mods.length}`);

	const edge = genEdgeCases();
	console.log(`  Edge cases:        ${edge.length}`);

	const all = [...base, ...moods, ...tempos, ...instruments, ...energy, ...scales, ...fusions, ...effects, ...mods, ...edge];
	console.log(`\n  TOTAL:             ${all.length}`);

	return all;
}

function validate(examples: Example[]): { valid: number; invalid: number; errors: string[] } {
	const errors: string[] = [];
	let valid = 0;

	for (let i = 0; i < examples.length; i++) {
		const ex = examples[i];
		if (!ex.prompt || typeof ex.prompt !== 'string') {
			errors.push(`[${i}] Missing or invalid prompt`);
			continue;
		}
		if (!ex.intent) {
			errors.push(`[${i}] Missing intent`);
			continue;
		}
		if (ex.intent.action === 'stop') {
			valid++;
			continue;
		}
		if (ex.intent.genre && !GENRES.includes(ex.intent.genre)) {
			errors.push(`[${i}] Invalid genre: ${ex.intent.genre}`);
			continue;
		}
		if (ex.intent.scale && !SCALES.includes(ex.intent.scale)) {
			errors.push(`[${i}] Invalid scale: ${ex.intent.scale}`);
			continue;
		}
		if (ex.intent.energy && !ENERGY_LEVELS.includes(ex.intent.energy)) {
			errors.push(`[${i}] Invalid energy: ${ex.intent.energy}`);
			continue;
		}
		valid++;
	}

	return { valid, invalid: errors.length, errors };
}

function dedupe(examples: Example[]): Example[] {
	const seen = new Set<string>();
	return examples.filter((ex) => {
		const key = ex.prompt.toLowerCase().trim();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function split(examples: Example[]): { train: Example[]; val: Example[]; test: Example[] } {
	const shuffled = [...examples].sort(() => Math.random() - 0.5);
	const testSize = Math.floor(shuffled.length * 0.08);
	const valSize = Math.floor(shuffled.length * 0.12);
	return {
		test: shuffled.slice(0, testSize),
		val: shuffled.slice(testSize, testSize + valSize),
		train: shuffled.slice(testSize + valSize)
	};
}

function writeJsonl(path: string, examples: Example[]) {
	const lines = examples.map((ex) => JSON.stringify(ex));
	writeFileSync(path, lines.join('\n') + '\n');
}

function stats(examples: Example[]) {
	const genres: Record<string, number> = {};
	const moods: Record<string, number> = {};
	let stops = 0;

	for (const ex of examples) {
		if (ex.intent.action === 'stop') { stops++; continue; }
		const g = ex.intent.genre || 'unknown';
		genres[g] = (genres[g] || 0) + 1;
		for (const m of ex.intent.mood || []) {
			moods[m] = (moods[m] || 0) + 1;
		}
	}

	console.log(`\nDataset stats:`);
	console.log(`  Total examples: ${examples.length}`);
	console.log(`  Stop commands:  ${stops}`);
	console.log(`  Genres covered: ${Object.keys(genres).length}`);
	console.log(`  Min per genre:  ${Math.min(...Object.values(genres))}`);
	console.log(`  Max per genre:  ${Math.max(...Object.values(genres))}`);
	console.log(`  Avg per genre:  ${Math.round(Object.values(genres).reduce((a, b) => a + b, 0) / Object.keys(genres).length)}`);
	console.log(`  Moods used:     ${Object.keys(moods).length}`);
}

// --- CLI ---

const args = process.argv.slice(2);

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

if (args.includes('--validate')) {
	if (!existsSync(OUT_FILE)) { console.log('No dataset found. Run without flags first.'); process.exit(1); }
	const data = readFileSync(OUT_FILE, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
	const result = validate(data);
	console.log(`Valid: ${result.valid}, Invalid: ${result.invalid}`);
	if (result.errors.length > 0) console.log('Errors:', result.errors.slice(0, 10));
} else if (args.includes('--split')) {
	if (!existsSync(OUT_FILE)) { console.log('No dataset found. Run without flags first.'); process.exit(1); }
	const data = readFileSync(OUT_FILE, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
	const { train, val, test } = split(data);
	writeJsonl(join(OUT_DIR, 'train.jsonl'), train);
	writeJsonl(join(OUT_DIR, 'val.jsonl'), val);
	writeJsonl(join(OUT_DIR, 'test.jsonl'), test);
	console.log(`Split: train=${train.length}, val=${val.length}, test=${test.length}`);
} else if (args.includes('--stats')) {
	if (!existsSync(OUT_FILE)) { console.log('No dataset found. Run without flags first.'); process.exit(1); }
	const data = readFileSync(OUT_FILE, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
	stats(data);
} else {
	const raw = generate();
	const deduped = dedupe(raw);
	console.log(`\n  After dedupe:      ${deduped.length}`);
	const result = validate(deduped);
	console.log(`  Valid:             ${result.valid}`);
	console.log(`  Invalid:           ${result.invalid}`);
	if (result.errors.length > 0) console.log('  Sample errors:', result.errors.slice(0, 5));

	writeJsonl(OUT_FILE, deduped);
	console.log(`\nWritten to ${OUT_FILE}`);
	stats(deduped);
}
