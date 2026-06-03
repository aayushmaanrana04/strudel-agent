import type { LLMProvider, LLMResponse, GenerateOptions } from './types';
import { formatStrudel } from '$lib/format-strudel';

const SYSTEM = `You are a strudel.cc music generator. Output ONLY valid strudel code using stack(), s(), note(), n(). No JSON, no explanation.`;

export class LocalServerProvider implements LLMProvider {
	private baseUrl: string;

	constructor(baseUrl = 'http://localhost:8899') {
		this.baseUrl = baseUrl;
	}

	async generate(prompt: string, options: GenerateOptions): Promise<LLMResponse> {
		const userMessage = options.currentCode
			? `Current code:\n${options.currentCode}\n\nUser: ${prompt}`
			: prompt;

		const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				messages: [
					{ role: 'system', content: SYSTEM },
					{ role: 'user', content: userMessage }
				],
				max_tokens: 400,
				temperature: 0.5
			})
		});

		if (!res.ok) throw new Error(`Local server error: ${res.statusText}`);

		const data = await res.json();
		const code = (data.choices?.[0]?.message?.content || '').trim();

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
