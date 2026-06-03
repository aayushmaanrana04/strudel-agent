import type { LLMProvider, LLMResponse, GenerateOptions } from './types';
import { formatStrudel } from '$lib/format-strudel';

let wllama: any = null;

const SYSTEM = `You are a strudel.cc music generator. Output ONLY valid strudel code using stack(), s(), note(), n(). No JSON, no explanation.`;

export async function loadGGUF(
	modelUrl: string,
	onProgress: (progress: number, text: string) => void
): Promise<void> {
	const { Wllama } = await import('@wllama/wllama');

	const origin = typeof window !== 'undefined' ? window.location.origin : '';
	wllama = new Wllama({
		default: `${origin}/wasm/wllama.wasm`,
	});

	await wllama.loadModelFromUrl(modelUrl, {
		n_ctx: 1024,
		n_threads: 1,
		progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
			const pct = total > 0 ? loaded / total : 0;
			onProgress(pct, `Downloading model... ${Math.round(pct * 100)}%`);
		}
	});

	onProgress(1, 'Model loaded');
}

export function unloadGGUF(): void {
	if (wllama) {
		wllama.exit();
		wllama = null;
	}
}

export function isLoaded(): boolean {
	return wllama !== null;
}

export class WllamaProvider implements LLMProvider {
	async generate(prompt: string, options: GenerateOptions): Promise<LLMResponse> {
		if (!wllama) throw new Error('Model not loaded');

		const userMessage = options.currentCode
			? `Current code:\n${options.currentCode}\n\nUser: ${prompt}`
			: prompt;

		const fullPrompt = `<|im_start|>system\n${SYSTEM}<|im_end|>\n<|im_start|>user\n${userMessage}<|im_end|>\n<|im_start|>assistant\n`;

		const result = await wllama.createCompletion({
			prompt: fullPrompt,
			max_tokens: 400,
			temperature: 0.5,
			stop: ['<|im_end|>', '<|im_start|>'],
		});

		const code = (result?.choices?.[0]?.text || result?.text || '').trim();

		if (!code || code.length < 5) {
			return { code: '', action: 'none', message: 'Model produced no output.' };
		}

		if (code.startsWith('{')) {
			try {
				const parsed = JSON.parse(code);
				if (parsed.action === 'stop') return { code: '', action: 'stop', message: 'Stopped.' };
				if (parsed.action === 'modify') return { code: '', action: 'none', message: JSON.stringify(parsed.delta) };
			} catch {}
		}

		return {
			code: formatStrudel(code),
			action: 'update',
			message: 'Generated with local model.'
		};
	}
}
