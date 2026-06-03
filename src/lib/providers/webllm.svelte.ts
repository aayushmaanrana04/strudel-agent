import type { LLMProvider, LLMResponse, GenerateOptions } from './types';
import { formatStrudel } from '$lib/format-strudel';
import strudelGrammar from '$lib/strudel.gbnf?raw';

let engine: any = null;
let currentModelId: string | null = null;

const LOCAL_SYSTEM_PROMPT = `You generate strudel.cc music code. Output ONLY code, nothing else.

Sounds: bd=kick, sd=snare, hh=hihat, oh=open hat, cp=clap, rim=rimshot, cr=crash, cb=cowbell
Banks: RolandTR808 (hip-hop), RolandTR909 (techno), RolandTR707 (retro)
Synths: sine, sawtooth, square, triangle
GM: gm_acoustic_grand_piano, gm_acoustic_bass, gm_sitar, gm_flute, gm_xylophone, gm_vibraphone, gm_synth_strings_1, gm_violin, gm_trumpet, gm_kalimba, gm_taiko_drum

Rules: stack() layers patterns. .bank() sets drum kit. n()+.scale() for melodies. .cpm(bpm/4) for tempo.

EXAMPLES:

User: techno beat
stack(s("bd*4").bank("RolandTR909"),s("~ cp ~ cp").bank("RolandTR909").gain(0.7),s("hh*8").bank("RolandTR909").gain(0.4)).cpm(32)

User: chill lo-fi beat
stack(s("bd [~ bd] ~ bd, ~ sd ~ sd").bank("RolandTR808").gain(0.7),s("hh*8").bank("RolandTR808").gain(0.3),n("0 2 4 6").scale("C:minor").s("gm_acoustic_grand_piano").room(0.5).gain(0.4),note("c2 g1 a1 f1").s("sine").lpf(400).gain(0.5)).cpm(22)

User: ambient pad
note("c3 e3 g3 b3").s("triangle").attack(0.5).release(1).room(0.8).roomsize(4).lpf(2000).gain(0.3).slow(2)

User: drum and bass
stack(s("bd ~ ~ bd ~ ~ bd ~, ~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR909"),s("hh*16").gain(0.3).bank("RolandTR909"),n("0 ~ 0 ~ 0 ~ 3 0").scale("E:minor").s("sawtooth").lpf(400).gain(0.6)).cpm(43)

User: indian classical
stack(s("bd [bd bd] ~ bd, ~ ~ cp ~").bank("RolandTR808").gain(0.6),n("0 2 4 5 7 5 4 2").scale("D:phrygian").s("gm_sitar").gain(0.5).room(0.3).delay(0.2),note("d2").s("sawtooth").lpf(300).gain(0.15).slow(4)).cpm(20)

User: trap beat
stack(s("bd ~ ~ ~ bd ~ ~ ~, ~ ~ ~ ~ cp ~ ~ ~").bank("RolandTR808").gain(0.9),s("hh*16").gain(0.3).sometimes(x => x.speed(2)),n("0 ~ 0 ~ ~ 0 ~ 3").scale("C:minor").s("sine").lpf(200).gain(0.7)).cpm(35)

User: jazz
stack(n("0 2 4 6 7 6 4 2").scale("C:dorian").s("gm_acoustic_grand_piano").gain(0.5).room(0.4),note("c2 g2 a2 e2").s("gm_acoustic_bass").gain(0.6),s("~ sd ~ sd").bank("RolandTR707").gain(0.4),s("hh*8").bank("RolandTR707").gain(0.25)).cpm(30)

Now generate code for:`;

export async function loadModel(
	modelId: string,
	onProgress: (progress: number, text: string) => void
): Promise<void> {
	if (currentModelId === modelId && engine) return;

	const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

	engine = await CreateMLCEngine(modelId, {
		initProgressCallback: (report: any) => {
			onProgress(report.progress ?? 0, report.text ?? '');
		}
	});

	currentModelId = modelId;
}

export function unloadModel(): void {
	if (engine) {
		engine.unload?.();
		engine = null;
		currentModelId = null;
	}
}

export class WebLLMProvider implements LLMProvider {
	private useGrammar = true;

	setGrammar(enabled: boolean) {
		this.useGrammar = enabled;
	}

	async generate(prompt: string, options: GenerateOptions): Promise<LLMResponse> {
		if (!engine) throw new Error('Model not loaded. Load a model first.');

		const userMessage = options.currentCode
			? `Current code:\n${options.currentCode}\n\nUser: ${prompt}`
			: `User: ${prompt}`;

		const requestOptions: any = {
			messages: [
				{ role: 'system', content: LOCAL_SYSTEM_PROMPT },
				{ role: 'user', content: userMessage }
			],
			temperature: options.temperature ?? 0.7,
			max_tokens: 512
		};

		if (this.useGrammar) {
			requestOptions.response_format = {
				type: 'grammar' as const,
				grammar: strudelGrammar
			};
		}

		const response = await engine.chat.completions.create(requestOptions);
		const output = (response.choices[0]?.message?.content || '').trim();

		if (!output) {
			return { code: '', action: 'none', message: 'Model produced no output.' };
		}

		return {
			code: formatStrudel(output),
			action: 'update',
			message: 'Generated with local model.'
		};
	}
}
