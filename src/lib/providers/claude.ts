import type { LLMProvider, LLMResponse, GenerateOptions } from './types';

export class ClaudeProvider implements LLMProvider {
	async generate(prompt: string, options: GenerateOptions): Promise<LLMResponse> {
		const res = await fetch('/api/claude', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				prompt,
				currentCode: options.currentCode,
				conversationHistory: options.conversationHistory
			})
		});

		if (!res.ok) throw new Error(res.statusText);
		return await res.json();
	}
}
