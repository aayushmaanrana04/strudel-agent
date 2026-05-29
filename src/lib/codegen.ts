import type { ToolCall, EffectParams, DrumPatternParams, MelodicLineParams } from './types';

const PRESETS: Record<string, string> = {
	'techno-drums': `stack(
  s("bd(3,8)"),
  s("sd:[~ <sd!3 sd(3,4,2)>]"),
  s("hh*8")
    .speed(perlin.range(.9, 1.1))
    .gain(perlin.range(.3, .5)),
  s("oh").euclid(3, 16)
    .gain(.4)
).cpm(128)`,

	'acid-bass': `note("[<g1 f1>/8](<3 5>,8)")
  .clip(perlin.range(.15, 1.5))
  .release(.1)
  .s("sawtooth")
  .lpf(sine.range(400, 800).slow(16))
  .lpq(cosine.range(6, 14).slow(3))
  .lpenv(sine.mul(4).slow(4))
  .lpd(.2).lpa(.02)
  .ftype('24db')
  .rarely(add(note(12)))
  .room(.2).shape(.3)`,

	'ambient-pad': `note("<[c,e,g]!3 [d,f,a] [e,g,b]!2 [f,a,c]>")
  .slow(8)
  .superimpose(x => x.add(.04))
  .add(perlin.range(0, .2))
  .s("triangle")
  .attack(2)
  .release(3)
  .lpf(sine.range(800, 2000).slow(32))
  .room(.8)
  .gain(.3)`,

	'generative-melody': `note("<0 2 4 6>*8")
  .scale("C:minor")
  .euclid(5, 8)
  .fast("<1 2 4>")
  .every(4, rev)
  .sometimes(add(12))
  .off(1/8, x => x.add(7).degradeBy(.3))
  .s("sawtooth")
  .lpf(sine.range(300, 2000).slow(8))
  .room(.3)
  .gain(.5)`,

	'breakbeat': `samples('github:tidalcycles/dirt-samples')

s("breaks165")
  .slice(8, "0 1 <2 2*2> 3 [4 0] 5 6 7".every(3, rev))
  .slow(0.75)
  .sometimes(x => x.speed("<1 0.5 2>"))
  .room(.2)
  .hpf(100)
  .gain(.7)`,

	'polyrhythm': `stack(
  s("bd(3,8)"),
  s("sd(5,8,2)"),
  s("hh*8").speed(perlin.range(.9, 1.1)),
  s("metal(7,16)").gain(.5)
).cpm(130)`
};

function buildEffectChain(effects: EffectParams): string {
	const mapping: [keyof EffectParams, string][] = [
		['gain', 'gain'],
		['lpf', 'lpf'],
		['hpf', 'hpf'],
		['lpq', 'lpq'],
		['room', 'room'],
		['roomsize', 'roomsize'],
		['delay', 'delay'],
		['delaytime', 'delaytime'],
		['delayfeedback', 'delayfeedback'],
		['pan', 'pan'],
		['speed', 'speed'],
		['crush', 'crush'],
		['shape', 'shape'],
		['attack', 'attack'],
		['decay', 'decay'],
		['sustain', 'sustain'],
		['release', 'release']
	];

	let chain = '';
	for (const [key, fn] of mapping) {
		if (effects[key] !== undefined && effects[key] !== null) {
			chain += `.${fn}(${effects[key]})`;
		}
	}
	return chain;
}

function generateDrumPattern(params: DrumPatternParams): string {
	const layers: string[] = [];

	if (params.kick) layers.push(`  s("${params.kick}")`);
	if (params.snare) layers.push(`  s("${params.snare}")`);
	if (params.hihat) layers.push(`  s("${params.hihat}")`);
	if (params.openhat) layers.push(`  s("${params.openhat}")`);
	if (params.other) {
		for (const p of params.other) {
			layers.push(`  s("${p}")`);
		}
	}

	if (layers.length === 0) return '';

	let code: string;
	if (layers.length === 1) {
		code = layers[0].trim();
	} else {
		code = `stack(\n${layers.join(',\n')}\n)`;
	}

	if (params.bank) code += `\n  .bank("${params.bank}")`;
	if (params.tempo) code += `\n  .cpm(${params.tempo / 4})`;
	if (params.effects) code += `\n  ${buildEffectChain(params.effects)}`;

	return code;
}

function generateMelodicLine(params: MelodicLineParams): string {
	let code: string;

	if (params.useScaleDegrees) {
		code = `n("${params.notes}")`;
		if (params.scale) code += `.scale("${params.scale}")`;
	} else {
		code = `note("${params.notes}")`;
	}

	code += `.s("${params.sound}")`;
	if (params.tempo) code += `.cpm(${params.tempo / 4})`;
	if (params.effects) code += buildEffectChain(params.effects);

	return code;
}

export function assembleCode(toolCalls: ToolCall[], currentCode?: string): string {
	const layers: string[] = [];
	let tempo: number | null = null;
	let useCurrentCode = false;

	for (const call of toolCalls) {
		switch (call.tool) {
			case 'create_drum_pattern': {
				layers.push(generateDrumPattern(call.params));
				break;
			}
			case 'create_melodic_line': {
				layers.push(generateMelodicLine(call.params));
				break;
			}
			case 'set_tempo': {
				tempo = call.params.bpm;
				useCurrentCode = true;
				break;
			}
			case 'add_effects': {
				useCurrentCode = true;
				break;
			}
			case 'remove_layer': {
				useCurrentCode = true;
				break;
			}
			case 'load_preset': {
				const preset = PRESETS[call.params.preset];
				if (preset) {
					let code = preset;
					if (call.params.tempo) {
						code = code.replace(/\.cpm\(\d+\)/, `.cpm(${call.params.tempo / 4})`);
						if (!code.includes('.cpm(')) {
							code += `.cpm(${call.params.tempo / 4})`;
						}
					}
					layers.push(code);
				}
				break;
			}
			case 'raw_code': {
				layers.push(call.params.code);
				break;
			}
			case 'stop_playback':
				return '';
		}
	}

	if (useCurrentCode && currentCode) {
		let code = currentCode;

		for (const call of toolCalls) {
			if (call.tool === 'set_tempo') {
				const cpmVal = call.params.bpm / 4;
				if (code.match(/\.cpm\([^)]+\)/)) {
					code = code.replace(/\.cpm\([^)]+\)/, `.cpm(${cpmVal})`);
				} else if (code.match(/setcpm\([^)]+\)/)) {
					code = code.replace(/setcpm\([^)]+\)/, `setcpm(${cpmVal})`);
				} else {
					code = `setcpm(${cpmVal})\n${code}`;
				}
			}
		}

		if (layers.length > 0) {
			code = code + '\n' + layers.join('\n');
		}
		return code;
	}

	if (layers.length === 0) return currentCode || '';
	if (layers.length === 1) return (tempo ? `setcpm(${tempo / 4})\n` : '') + layers[0];

	const combined = layers.map((l) => `// layer\n${l}`).join('\n');
	return (tempo ? `setcpm(${tempo / 4})\n` : '') + combined;
}

export function getPresetNames(): string[] {
	return Object.keys(PRESETS);
}
