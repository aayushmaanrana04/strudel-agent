import { readFileSync } from 'fs';
import { join } from 'path';

const skillBase = join(process.cwd(), '.agents/skills/strudel');
const fullReference = readFileSync(join(skillBase, 'references/strudel-reference.md'), 'utf-8');
const genreReference = readFileSync(join(skillBase, 'references/genre-styles.md'), 'utf-8');

// Split reference into chunks by ## headings
interface Chunk {
	heading: string;
	content: string;
}

function splitByH2(text: string): Chunk[] {
	const chunks: Chunk[] = [];
	const lines = text.split('\n');
	let current: Chunk | null = null;

	for (const line of lines) {
		if (line.startsWith('## ')) {
			if (current) chunks.push(current);
			current = { heading: line.replace('## ', ''), content: line + '\n' };
		} else if (current) {
			current.content += line + '\n';
		}
	}
	if (current) chunks.push(current);
	return chunks;
}

const refChunks = splitByH2(fullReference);
const genreChunks = splitByH2(genreReference);

// Map chunk headings to route names
const CHUNK_ROUTES: Record<string, string[]> = {
	drums: [
		'Mini-Notation DSL',
		'Euclidean Operations',
		'Swing and Groove',
		'Tempo Control'
	],
	melody: [
		'Mini-Notation DSL',
		'Pattern Construction',
		'Synthesis'
	],
	effects: [
		'Audio Effects and Sound Design'
	],
	timing: [
		'Time and Rhythm Operations',
		'Tempo Control'
	],
	transform: [
		'Pattern Transformations and Combinators',
		'Signals and Continuous Patterns'
	],
	composition: [
		'Practical Composition Examples',
		'Key Functional Programming Patterns',
		'Lambda Functions and Combinators'
	]
};

// Keywords that trigger each route
const KEYWORD_MAP: Record<string, string[]> = {
	drums: [
		'drum', 'beat', 'kick', 'snare', 'hihat', 'hi-hat', 'hat',
		'percussion', 'rhythm', 'bd', 'sd', 'hh', 'clap', 'cp',
		'tom', 'cymbal', 'ride', 'crash', '808', '909', 'euclidean',
		'breakbeat', 'amen'
	],
	melody: [
		'melody', 'bass', 'bassline', 'lead', 'pad', 'note', 'chord',
		'scale', 'arpeggio', 'synth', 'piano', 'key', 'minor', 'major',
		'pentatonic', 'harmonic', 'progression', 'voicing', 'transpose'
	],
	effects: [
		'reverb', 'delay', 'filter', 'distortion', 'crush', 'bitcrush',
		'pan', 'phaser', 'tremolo', 'lpf', 'hpf', 'room', 'effect',
		'wet', 'dry', 'resonance', 'cutoff', 'envelope', 'adsr',
		'attack', 'decay', 'sustain', 'release', 'gain', 'volume',
		'shape', 'compress', 'sidechain', 'duck'
	],
	timing: [
		'tempo', 'bpm', 'speed', 'slow', 'fast', 'swing', 'cpm',
		'time', 'hurry', 'groove'
	],
	transform: [
		'reverse', 'random', 'generative', 'evolve', 'vary', 'variation',
		'degrade', 'sometimes', 'often', 'rarely', 'every', 'conditional',
		'probability', 'iterate', 'palindrome', 'superimpose', 'jux',
		'layer', 'off', 'echo', 'signal', 'sine', 'perlin', 'saw',
		'modulate', 'lfo'
	],
	composition: [
		'composition', 'arrange', 'song', 'structure', 'section',
		'stack', 'layer', 'combine', 'full', 'complete', 'track'
	]
};

// Genre keywords — match against genre section headings
const GENRE_KEYWORDS: Record<string, string[]> = {
	'Dark Ambient Hip-Hop': ['lorn', 'clams casino', 'dark ambient', 'dark hip-hop'],
	'General Techno': ['techno'],
	'Dub Techno': ['dub techno', 'dub'],
	'Jungle': ['jungle', 'amen', 'breakcore'],
	'Liquid DnB': ['liquid', 'dnb', 'drum and bass', 'drum & bass'],
	'Trap': ['trap', '808 bass'],
	'Boom Bap': ['boom bap', 'hip-hop', 'hip hop', 'boom'],
	'Dark Ambient': ['dark ambient', 'drone', 'dark'],
	'IDM / Glitch': ['idm', 'glitch', 'aphex', 'autechre', 'experimental'],
	'Deep House': ['deep house', 'house'],
	'Acid House': ['acid', 'acid house', '303', 'tb-303']
};

function matchKeywords(prompt: string, keywords: string[]): boolean {
	const lower = prompt.toLowerCase();
	return keywords.some((kw) => lower.includes(kw));
}

function findChunk(chunks: Chunk[], headingSubstring: string): Chunk | undefined {
	return chunks.find((c) => c.heading.includes(headingSubstring));
}

export interface RouterResult {
	chunks: string[];
	routes: string[];
}

export function routeContext(prompt: string): RouterResult {
	const matchedRoutes = new Set<string>();
	const matchedChunks: string[] = [];
	const seen = new Set<string>();

	// Match keyword routes
	for (const [route, keywords] of Object.entries(KEYWORD_MAP)) {
		if (matchKeywords(prompt, keywords)) {
			matchedRoutes.add(route);
		}
	}

	// If nothing matched, include drums + melody + effects as default
	if (matchedRoutes.size === 0) {
		matchedRoutes.add('drums');
		matchedRoutes.add('melody');
		matchedRoutes.add('effects');
	}

	// Collect reference chunks for matched routes
	for (const route of matchedRoutes) {
		const headings = CHUNK_ROUTES[route] || [];
		for (const heading of headings) {
			if (seen.has(heading)) continue;
			seen.add(heading);
			const chunk = findChunk(refChunks, heading);
			if (chunk) matchedChunks.push(chunk.content);
		}
	}

	// Match genre sections
	for (const [sectionName, keywords] of Object.entries(GENRE_KEYWORDS)) {
		if (matchKeywords(prompt, keywords)) {
			const chunk = findChunk(genreChunks, sectionName);
			if (chunk) matchedChunks.push(chunk.content);
		}
	}

	return {
		chunks: matchedChunks,
		routes: [...matchedRoutes]
	};
}

// Tier 1: always-included compact reference
export const CORE_REFERENCE = `## Mini-Notation Quick Reference
Space=sequence, []=group, <>=alternate per cycle, *N=repeat, /N=slow, ~=rest
,=stack/parallel, (b,s)=euclidean, :N=sample index, ?=random drop
!=replicate, @N=elongate, |=random choice, _=extend/hold

## Function Equivalents
"x y" = seq(x,y)  |  "<x y>" = cat(x,y)  |  "x,y" = stack(x,y)
"x*n" = fast(n)  |  "x/n" = slow(n)  |  "~" = silence

## Common Sounds
Drums: bd sd hh oh cp cb rim cr rd ht mt lt
Banks: RolandTR808, RolandTR909, RolandTR707
Synths: sine, sawtooth, square, triangle
GM: gm_acoustic_grand_piano, gm_acoustic_bass, gm_xylophone, etc.

## Common Effects
.lpf(hz) .hpf(hz) .lpq(n) .room(0-1) .roomsize(0-10)
.delay(0-1) .delaytime(s) .delayfeedback(0-1)
.gain(0-1) .pan(0-1) .crush(1-16) .shape(0-1)
.attack(s) .decay(s) .sustain(0-1) .release(s)

## Presets Available
techno-drums, acid-bass, ambient-pad, generative-melody, breakbeat, polyrhythm`;
