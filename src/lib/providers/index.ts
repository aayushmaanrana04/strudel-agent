export { ClaudeProvider } from './claude';
export { AVAILABLE_MODELS, SYSTEM_PROMPT } from './types';
export type { LLMProvider, LLMResponse, GenerateOptions, ModelStatus } from './types';

// WebLLM exports are browser-only — import dynamically or from .svelte files
export async function getWebLLMModule() {
	const mod = await import('./webllm.svelte');
	return mod;
}
