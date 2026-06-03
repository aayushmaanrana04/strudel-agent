#!/usr/bin/env npx tsx

/**
 * Generates strudel code from intent JSONs using embedded musical knowledge.
 * Zero API calls — all pattern generation is deterministic with seeded randomness.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const INPUT = join(DATA_DIR, 'dataset.jsonl');
const OUTPUT = join(DATA_DIR, 'strudel-dataset.jsonl');

// Seeded random for reproducibility
let seed = 42;
function rand(): number {
	seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
	return seed / 0x7fffffff;
}
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] {
	const s = [...arr].sort(() => rand() - 0.5);
	return s.slice(0, n);
}

// ============================================================
// DRUM PATTERNS by rhythm_style
// ============================================================
const KICK_PATTERNS: Record<string, string[]> = {
	four_on_the_floor: ['bd*4', 'bd*4', 'bd*4', 'bd*4'],
	straight: ['bd ~ bd ~', 'bd ~ ~ bd ~ ~ bd ~', 'bd sd bd sd', 'bd ~ bd ~'],
	swing: ['bd ~ bd ~', 'bd [~ bd] ~ bd', 'bd ~ [~ bd] ~'],
	shuffle: ['bd ~ bd ~', 'bd [~ bd] bd ~', 'bd ~ bd [~ bd]'],
	syncopated: ['bd ~ [~ bd] ~', 'bd [~ bd] ~ [bd ~]', '[bd ~] ~ bd [~ bd]', 'bd ~ ~ bd ~ bd ~ ~'],
	half_time: ['bd ~ ~ ~ ~ ~ ~ ~', 'bd ~ ~ ~ bd ~ ~ ~', 'bd ~ ~ ~ [~ bd] ~ ~ ~'],
	double_time: ['bd*8', 'bd sd bd sd bd sd bd sd', '[bd bd] sd [bd bd] sd'],
	broken_beat: ['bd ~ ~ bd ~ ~ bd ~', 'bd ~ bd ~ ~ bd ~ ~', 'bd [~ bd] ~ ~ bd ~ [bd ~] ~'],
	two_step: ['bd ~ ~ ~ bd ~ ~ ~', 'bd ~ ~ bd ~ ~ ~ ~', 'bd ~ ~ [~ bd] ~ ~ ~ ~'],
	waltz: ['bd ~ ~ bd ~ ~', 'bd ~ ~ ~ ~ ~'],
	bossa: ['bd ~ ~ bd ~ ~ bd ~', 'bd ~ ~ [~ bd] ~ ~ bd ~'],
	clave: ['bd ~ ~ bd ~ ~ [~ bd] ~', 'bd ~ ~ bd ~ [~ bd] ~ ~'],
	tresillo: ['bd ~ ~ bd ~ ~ bd ~', 'bd ~ ~ bd ~ ~ [bd ~] ~'],
	triplet: ['bd ~ ~ bd ~ ~ bd ~ ~', '[bd ~ ~]*4'],
	polyrhythmic: ['bd(3,8)', 'bd(5,8)', 'bd(3,8,2)', 'bd(5,16)'],
};

const SNARE_PATTERNS: Record<string, string[]> = {
	four_on_the_floor: ['~ cp ~ cp', '~ sd ~ sd', '~ [~ sd] ~ sd', '~ cp ~ [cp cp]'],
	straight: ['~ sd ~ sd', '~ sd ~ sd', '~ ~ sd ~', '~ sd ~ [~ sd]'],
	swing: ['~ sd ~ sd', '~ [~ sd] ~ sd', '~ sd ~ [sd ~]'],
	shuffle: ['~ sd ~ sd', '~ [~ sd] ~ sd'],
	syncopated: ['~ sd [~ sd] ~', '~ [sd ~] ~ sd', '~ sd ~ [~ sd]'],
	half_time: ['~ ~ ~ ~ sd ~ ~ ~', '~ ~ ~ ~ [~ sd] ~ ~ ~'],
	double_time: ['~ sd ~ sd ~ sd ~ sd', '[~ sd]*4'],
	broken_beat: ['~ ~ sd ~ ~ ~ sd ~', '~ ~ ~ ~ sd ~ ~ ~', '~ ~ sd ~ ~ sd ~ ~'],
	two_step: ['~ ~ sd ~ ~ ~ sd ~', '~ ~ [~ sd] ~ ~ ~ sd ~'],
	waltz: ['~ ~ sd ~ ~ sd', '~ ~ sd ~ ~ ~'],
	bossa: ['~ ~ sd ~ ~ ~ sd ~', '~ ~ [~ sd] ~ ~ sd ~ ~'],
	clave: ['~ ~ sd ~ ~ sd ~ ~', '~ sd ~ ~ ~ sd ~ ~'],
	tresillo: ['~ ~ sd ~ ~ sd ~ ~', '~ ~ ~ sd ~ ~ sd ~'],
	triplet: ['~ ~ sd ~ ~ sd ~ ~ sd', '~ ~ sd ~ ~ ~ ~ ~ sd'],
	polyrhythmic: ['sd(5,8,2)', 'sd(3,8,1)', 'cp(5,8)', 'sd(7,16,3)'],
};

const HIHAT_PATTERNS: string[] = [
	'hh*8', 'hh*16', 'hh*4', '[hh hh hh ~]*2', 'hh(5,8)',
	'[hh hh hh hh hh hh hh oh]', 'hh*8', '[~ hh]*4', 'hh(7,8)',
	'[hh oh]*4', 'hh*8', '[hh hh oh hh]*2',
];

// ============================================================
// BASS PATTERNS by bass_style + scale
// ============================================================
function bassPat(style: string, key: string, scale: string): string {
	const notePatterns: Record<string, string[]> = {
		sub: [`${key.toLowerCase()}2`, `${key.toLowerCase()}2 ~ ${key.toLowerCase()}2 ~`, `${key.toLowerCase()}1 ~ ~ ${key.toLowerCase()}1 ~ ~ ~ ~`],
		deep: [`${key.toLowerCase()}2 ~ ${key.toLowerCase()}2 ~`, `${key.toLowerCase()}2 [~ ${key.toLowerCase()}2] ~ ~`, `<${key.toLowerCase()}2 ${key.toLowerCase()}1>`],
		groove: ['0 ~ 3 0 ~ 3 5 ~', '0 3 5 3', '0 ~ 0 3 ~ 5 3 ~', '0 [0 3] 5 [3 0]'],
		walking: ['0 2 4 5', '0 4 5 7', '0 2 5 4 7 5 4 2', '0 3 5 7'],
		pluck: ['0 ~ 4 ~', '0 ~ ~ 4 ~ ~ 5 ~', '0 [~ 0] 4 [~ 5]'],
		acid: ['0 0 [0 3] 0 ~ 0 [5 3] 0', '0 ~ 3 ~ 5 ~ 3 ~', '0 [~ 0] [3 5] 0'],
		reese: ['0 ~ ~ 0 ~ ~ ~ ~', '0 ~ 0 ~ 0 ~ ~ ~', '<0 3 5 0>'],
		wobble: ['0 ~ 0 ~ 0 ~ 0 ~', '0 0 0 0', '0 [0 0] ~ 0'],
		fingerstyle: ['0 2 4 5 7 5 4 2', '0 4 7 4', '0 2 [4 5] 7'],
	};
	const pats = notePatterns[style] || notePatterns['groove'];
	const pat = pick(pats);

	if (style === 'sub' || style === 'deep' || style === 'reese') {
		return `note("${pat}").s("${pick(['sine', 'triangle', 'sawtooth'])}").lpf(${100 + Math.floor(rand() * 300)}).gain(${(0.4 + rand() * 0.3).toFixed(2)})`;
	}
	return `n("${pat}").scale("${key}:${scale.replace(/_/g, ':')}").s("${pick(['sawtooth', 'square', 'triangle', 'sine'])}").lpf(${200 + Math.floor(rand() * 600)}).gain(${(0.4 + rand() * 0.3).toFixed(2)})`;
}

// ============================================================
// MELODY PATTERNS
// ============================================================
function melodyPat(type: string, key: string, scale: string, sound: string): string {
	const patterns: Record<string, string[]> = {
		absent: [],
		simple: ['0 2 4 5', '0 4 5 7', '0 ~ 2 ~ 4 ~ 5 ~', '0 2 [4 5] 7', '<0 2 4 5>'],
		complex: ['0 2 4 [5 7] 9 [7 5] 4 2', '0 [2 4] 5 7 [9 7] 5 [4 2]', '0 2 4 6 7 6 4 2', '<0 [2 4]> <5 [7 9]>'],
		arpeggio: ['0 2 4 7', '0 4 7 4', '[0 2 4 7]*2', '0 2 [4 7] 2', '0 4 [7 9] 4'],
		chord: ['[0,2,4]', '<[0,2,4] [2,4,6] [4,6,8] [5,7,9]>', '[0,4,7]', '<[0,2,4] [0,3,5]>'],
		riff: ['0 3 5 [3 0]', '0 [0 3] 5 [3 5]', '0 ~ 3 5 ~ 3 0 ~', '[0 3] 5 [7 5] 3'],
		atmospheric: ['<0 2 4 7>', '<0 ~ 4 ~>', '0 ~ ~ 4 ~ ~ 7 ~', '<0 4> <2 7>'],
		call_response: ['0 2 4 ~ ~ 4 2 0', '0 [2 4] ~ ~ [4 2] 0 ~ ~', '0 4 ~ 7 ~ 4 ~ 0'],
	};

	if (type === 'absent') return '';

	const pats = patterns[type] || patterns['simple'];
	const pat = pick(pats);
	const octave = type === 'atmospheric' || type === 'chord' ? '4' : pick(['3', '4', '5']);

	let code = `n("${pat}").scale("${key}${octave}:${scale.replace(/_/g, ':')}")`;
	code += `.s("${sound}")`;
	return code;
}

// ============================================================
// INSTRUMENT → SOUND mapping
// ============================================================
function instrumentSound(inst: string): string {
	const map: Record<string, string[]> = {
		piano: ['gm_acoustic_grand_piano'],
		keys: ['gm_acoustic_grand_piano', 'gm_electric_piano_1'],
		rhodes: ['gm_electric_piano_1'],
		guitar: ['gm_acoustic_guitar_nylon', 'gm_acoustic_guitar_steel'],
		strings: ['gm_synth_strings_1', 'gm_violin'],
		brass: ['gm_trumpet'],
		flute: ['gm_flute'],
		sitar: ['gm_sitar'],
		tabla: ['gm_taiko_drum'],
		bells: ['gm_xylophone', 'gm_vibraphone'],
		marimba: ['gm_marimba'],
		choir: ['gm_choir_aahs'],
		organ: ['gm_percussive_organ'],
		pad: ['gm_pad_1_new_age', 'gm_synth_strings_1'],
		synth: ['sawtooth', 'square'],
		lead: ['sawtooth', 'square', 'sine'],
		arp: ['sawtooth', 'square', 'triangle'],
		pluck: ['triangle', 'square'],
		vocal_chop: ['gm_choir_aahs'],
		harmonium: ['gm_accordion'],
		bansuri: ['gm_flute'],
		santoor: ['gm_kalimba'],
		sarod: ['gm_sitar'],
		shehnai: ['gm_clarinet'],
		tanpura: ['sawtooth'],
		tumbi: ['gm_banjo'],
		dhol: ['gm_taiko_drum'],
		dholak: ['gm_taiko_drum'],
		mridangam: ['gm_taiko_drum'],
		conga: ['gm_taiko_drum'],
	};
	const options = map[inst] || ['sine'];
	return pick(options);
}

// ============================================================
// EFFECTS
// ============================================================
function effectChain(effects: any, mood: string[]): string {
	let chain = '';
	const rev = effects?.reverb || 'none';
	const filt = effects?.filter || 'none';
	const dist = effects?.distortion || 'none';

	if (rev === 'low') chain += `.room(${(0.1 + rand() * 0.15).toFixed(2)})`;
	else if (rev === 'medium') chain += `.room(${(0.3 + rand() * 0.2).toFixed(2)})`;
	else if (rev === 'high') chain += `.room(${(0.5 + rand() * 0.3).toFixed(2)}).roomsize(${Math.floor(2 + rand() * 4)})`;

	if (filt === 'lowpass') chain += `.lpf(${Math.floor(400 + rand() * 3000)})`;
	else if (filt === 'highpass') chain += `.hpf(${Math.floor(500 + rand() * 2000)})`;

	if (dist === 'low') chain += `.shape(${(0.1 + rand() * 0.2).toFixed(2)})`;
	else if (dist === 'medium') chain += `.shape(${(0.3 + rand() * 0.2).toFixed(2)})`;
	else if (dist === 'high') chain += `.distort(${(1 + rand() * 3).toFixed(1)})`;

	return chain;
}

// ============================================================
// BANK mapping
// ============================================================
function bankName(kit: string): string {
	const map: Record<string, string> = {
		TR808: 'RolandTR808', TR909: 'RolandTR909', TR707: 'RolandTR707',
		AkaiLinn: 'AkaiLinn', acoustic: 'RolandTR707', electronic: 'RolandTR909',
	};
	return map[kit] || 'RolandTR808';
}

// ============================================================
// MAIN GENERATOR
// ============================================================
function intentToStrudel(intent: any): string {
	const layers: string[] = [];
	const tempo = intent.tempo || 120;
	const cpm = (tempo / 4).toFixed(1).replace(/\.0$/, '');
	const key = intent.key || 'C';
	const scale = intent.scale || 'minor';
	const rhythmStyle = intent.rhythm_style || 'straight';
	const drumKit = intent.drum_kit || 'TR808';
	const instruments: string[] = intent.instruments || ['drums'];
	const melody = intent.melody || 'simple';
	const bassStyle = intent.bass_style || 'groove';
	const effects = intent.effects || {};
	const mood = intent.mood || [];
	const energy = intent.energy || 'medium';

	// Drums
	if (instruments.includes('drums') || instruments.includes('kick') || instruments.includes('snare')) {
		const kicks = KICK_PATTERNS[rhythmStyle] || KICK_PATTERNS['straight'];
		const snares = SNARE_PATTERNS[rhythmStyle] || SNARE_PATTERNS['straight'];
		const kick = pick(kicks);
		const snare = pick(snares);
		const hh = pick(HIHAT_PATTERNS);

		let hhGain = energy === 'very_low' ? 0.15 : energy === 'low' ? 0.25 : energy === 'medium_low' ? 0.3 : 0.4;
		if (rand() > 0.5) hhGain += rand() * 0.1;

		if (drumKit === 'none') {
			// Use n() with percussion sound for kitless genres
			const percSound = instruments.includes('tabla') ? 'gm_taiko_drum' :
				instruments.includes('dhol') ? 'gm_taiko_drum' :
				instruments.includes('mridangam') ? 'gm_taiko_drum' : 'gm_woodblock';
			const kickNums = pick(['0 ~ 0 ~', '0 ~ ~ 0 ~ ~ 0 ~', '0 [0 0] ~ 0', '0 ~ [~ 0] ~']);
			const snareNums = pick(['~ ~ 2 ~', '~ 1 ~ 1', '~ ~ [1 2] ~']);
			layers.push(`n("${kickNums}").s("${percSound}").gain(0.6)`);
			if (rand() > 0.3) layers.push(`n("${snareNums}").s("${percSound}").gain(0.5)`);
		} else {
			const bank = bankName(drumKit);
			let drumPat: string;
			if (rand() > 0.4) {
				drumPat = `s("${kick}, ${snare}, ${hh}").bank("${bank}")`;
			} else {
				drumPat = `s("${kick}").bank("${bank}").gain(0.9)`;
				layers.push(drumPat);
				layers.push(`s("${snare}").bank("${bank}").gain(0.7)`);
				layers.push(`s("${hh}").bank("${bank}").gain(${hhGain.toFixed(2)}).hpf(${4000 + Math.floor(rand() * 4000)})`);
				drumPat = '';
			}
			if (drumPat) layers.push(drumPat);
		}

		if (rhythmStyle === 'swing' || rhythmStyle === 'shuffle') {
			// Add swing to last drum layer
			const last = layers.length - 1;
			if (last >= 0 && !layers[last].includes('.swing')) {
				layers[last] += '.swing(4)';
			}
		}
	}

	// Specific percussion instruments (when no drums layer)
	for (const inst of instruments) {
		if (['tabla', 'dhol', 'dholak', 'mridangam', 'conga', 'percussion'].includes(inst) && !instruments.includes('drums')) {
			const sound = instrumentSound(inst);
			const pat = pick(['0 [0 1] ~ 0', '0 ~ 0 [~ 1]', '0 [~ 0] 1 ~', '0 1 [0 1] 0']);
			layers.push(`n("${pat}").s("${sound}").gain(0.6)`);
		}
	}

	// Bass
	if (instruments.includes('bass') || instruments.includes('sub_bass')) {
		if (bassStyle !== 'none') {
			layers.push(bassPat(bassStyle, key, scale));
		}
	}

	// Melody / Lead / Pad
	const melodicInstruments = instruments.filter(i =>
		!['drums', 'kick', 'snare', 'hihat', 'bass', 'sub_bass', 'clap',
			'percussion', 'tabla', 'dhol', 'dholak', 'mridangam', 'conga', 'tom'].includes(i)
	);

	for (const inst of melodicInstruments.slice(0, 3)) {
		const sound = instrumentSound(inst);
		const melType = inst === 'pad' ? 'atmospheric' :
			inst === 'arp' ? 'arpeggio' :
			inst === 'lead' ? pick(['simple', 'riff']) :
			inst === 'tanpura' ? 'atmospheric' :
			melody;

		const code = melodyPat(melType, key, scale, sound);
		if (!code) continue;

		let layer = code;
		const gain = inst === 'pad' || inst === 'tanpura' ? (0.2 + rand() * 0.15) :
			inst === 'lead' ? (0.4 + rand() * 0.2) : (0.3 + rand() * 0.25);
		layer += `.gain(${gain.toFixed(2)})`;

		if (inst === 'pad' || inst === 'tanpura' || melType === 'atmospheric') {
			layer += `.attack(${(0.3 + rand() * 1).toFixed(2)}).release(${(0.5 + rand() * 2).toFixed(1)})`;
			if (rand() > 0.3) layer += `.slow(${pick([2, 4, 8])})`;
		}

		if (inst === 'sitar' || inst === 'sarod' || inst === 'bansuri' || inst === 'flute') {
			if (rand() > 0.4) layer += `.delay(${(0.1 + rand() * 0.2).toFixed(2)})`;
		}

		if (rand() > 0.5) layer += `.room(${(0.2 + rand() * 0.4).toFixed(2)})`;

		layers.push(layer);
	}

	if (layers.length === 0) {
		layers.push(`note("${key.toLowerCase()}3").s("sine").gain(0.5)`);
	}

	// Assemble
	let code: string;
	if (layers.length === 1) {
		code = layers[0];
	} else {
		code = `stack(${layers.join(',')})`;
	}

	// Global effects
	code += effectChain(effects, mood);

	// Tempo
	code += `.cpm(${cpm})`;

	return code;
}

// ============================================================
// RUN
// ============================================================
const intents = readFileSync(INPUT, 'utf-8').trim().split('\n').map(l => JSON.parse(l));

const genIntents = intents.filter(d =>
	!d.intent.action || (d.intent.action !== 'stop' && d.intent.action !== 'modify')
);

console.log(`Processing ${genIntents.length} generation intents...`);

const results: string[] = [];
let success = 0;
let failed = 0;

for (const d of genIntents) {
	try {
		const code = intentToStrudel(d.intent);
		results.push(JSON.stringify({ intent: d.intent, prompt: d.prompt, code }));
		success++;
	} catch (err: any) {
		failed++;
	}
}

writeFileSync(OUTPUT, results.join('\n') + '\n');

console.log(`Done: ${success} success, ${failed} failed`);
console.log(`Written to ${OUTPUT}`);

// Quick stats
const codes = results.map(r => JSON.parse(r).code);
const avgLen = Math.round(codes.reduce((a, c) => a + c.length, 0) / codes.length);
const hasStack = codes.filter(c => c.includes('stack(')).length;
console.log(`Avg code length: ${avgLen} chars`);
console.log(`With stack(): ${hasStack} (${Math.round(hasStack * 100 / codes.length)}%)`);
