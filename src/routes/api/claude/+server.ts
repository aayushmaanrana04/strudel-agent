import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

const reference = readFileSync(join(process.cwd(), 'src/lib/strudel-reference.md'), 'utf-8');

const SYSTEM = `You are a strudel.cc music live coding assistant. You write strudel code based on user requests.

<strudel-reference>
${reference}
</strudel-reference>

RULES:
- Generate valid strudel.cc code based on the user's request.
- Respond ONLY with a single JSON object. No markdown, no backticks, no extra text.
- The JSON must have exactly these fields:
  "code"    — string, the strudel code to load into the editor (empty string if no code change)
  "action"  — one of: "update" (load code + evaluate), "play" (start playback), "stop" (stop playback), "none" (just reply, no editor action)
  "message" — string, brief explanation to the user

When the user asks to create or modify music, set action to "update" and provide the code.
When the user asks to stop, set action to "stop" with empty code.
When the user asks a question without needing code, set action to "none" with empty code.

Example:
{"code":"s(\\"bd sd [~ bd] sd, hh*8\\").bank(\\"RolandTR909\\")","action":"update","message":"Here's a drum pattern using the TR-909."}`;

export const POST: RequestHandler = async ({ request }) => {
	const { prompt } = await request.json();

	if (!prompt || typeof prompt !== 'string') {
		return new Response(JSON.stringify({ error: 'prompt is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const fullPrompt = `${SYSTEM}\n\nUser: ${prompt}`;

	return new Promise((resolve) => {
		const proc = spawn('claude', ['-p', fullPrompt], {
			cwd: process.cwd(),
			env: { ...process.env }
		});

		let output = '';

		proc.stdout.on('data', (chunk: Buffer) => {
			output += chunk.toString();
		});

		proc.stderr.on('data', (chunk: Buffer) => {
			console.error('[claude stderr]', chunk.toString());
		});

		proc.on('close', () => {
			try {
				const jsonMatch = output.match(/\{[\s\S]*\}/);
				if (!jsonMatch) throw new Error('No JSON found');
				const data = JSON.parse(jsonMatch[0]);
				resolve(
					new Response(JSON.stringify(data), {
						headers: { 'Content-Type': 'application/json' }
					})
				);
			} catch {
				resolve(
					new Response(
						JSON.stringify({
							code: '',
							action: 'none',
							message: output.trim() || 'No response from Claude.'
						}),
						{ headers: { 'Content-Type': 'application/json' } }
					)
				);
			}
		});

		proc.on('error', (err) => {
			resolve(
				new Response(JSON.stringify({ code: '', action: 'none', message: `Error: ${err.message}` }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		});
	});
};
