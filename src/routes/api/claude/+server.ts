import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';
import { assembleCode } from '$lib/codegen';
import type { ApiRequest, ApiResponse, ToolCall } from '$lib/types';

const skillBase = join(process.cwd(), '.agents/skills/strudel');
const miniRef = readFileSync(join(skillBase, 'references/strudel-reference.md'), 'utf-8');
const genreRef = readFileSync(join(skillBase, 'references/genre-styles.md'), 'utf-8');

const SYSTEM = `You are a strudel.cc music assistant. You help users create live-coded music by calling structured tools.

## Available Tools

### create_drum_pattern
Create a drum pattern. All pattern fields use strudel mini-notation.
Params:
- kick (string, required): kick pattern, e.g. "bd(3,8)" or "bd [~ bd] bd ~"
- snare (string, required): snare pattern, e.g. "~ sd ~ sd" or "sd(5,8)"
- hihat (string, required): hihat pattern, e.g. "hh*8" or "hh(7,16)"
- openhat (string, optional): open hihat, e.g. "oh(3,16)"
- other (string[], optional): extra percussion, e.g. ["cp ~ ~ cp", "rim(2,8)"]
- bank (string, optional): sample bank — "RolandTR808", "RolandTR909", "RolandTR707"
- tempo (number, optional): BPM
- effects (object, optional): see Effects below

### create_melodic_line
Create a melodic line (bass, melody, pad, or lead).
Params:
- type (string, required): "bass" | "melody" | "pad" | "lead"
- notes (string, required): mini-notation of notes (e.g. "c3 eb3 g3") or scale degrees (e.g. "0 2 4 6")
- useScaleDegrees (boolean, optional): if true, notes are scale degree numbers
- scale (string, optional): e.g. "C:minor", "D:minor:pentatonic"
- sound (string, required): "sine" | "sawtooth" | "square" | "triangle" | "piano" | any gm_ instrument
- tempo (number, optional): BPM
- effects (object, optional): see Effects below

### set_tempo
Change the tempo of the current code.
Params:
- bpm (number, required)

### add_effects
Add effects to an existing layer. When using this, also use raw_code to rewrite the full composition with the effects applied.
Params:
- layerIndex (number, required): which layer (0-based)
- effects (object, required): see Effects below

### remove_layer
Remove a layer from the current composition. Use raw_code to rewrite without that layer.
Params:
- layerIndex (number, required)

### load_preset
Load a preset template.
Params:
- preset (string, required): "techno-drums" | "acid-bass" | "ambient-pad" | "generative-melody" | "breakbeat" | "polyrhythm"
- tempo (number, optional): override BPM

### stop_playback
Stop all sound.
Params: (none)

### raw_code
Escape hatch: provide raw strudel code directly. Use this for complex patterns that don't fit the other tools, or when modifying existing code (add_effects, remove_layer).
Params:
- code (string, required): valid strudel code

## Effects Object
Any tool with an "effects" param accepts these fields (all optional):
lpf (number 20-20000), hpf (number 20-20000), lpq (number 0-50),
room (number 0-1), roomsize (number 0-10),
delay (number 0-1), delaytime (number), delayfeedback (number 0-1),
gain (number 0-1), pan (number 0-1),
crush (number 1-16), shape (number 0-1),
attack (number), decay (number), sustain (number 0-1), release (number)

## Response Format
Respond with a single JSON object. No markdown, no backticks, no extra text.
{
  "toolCalls": [ { "tool": "tool_name", "params": { ... } } ],
  "message": "Brief explanation to the user"
}

You can call multiple tools in one response to build layered compositions.
For simple modifications to existing code (add reverb, change tempo), prefer set_tempo or raw_code with the full updated code.
When the user says "stop", use stop_playback.
When just chatting with no code changes needed, return empty toolCalls: [].

## Mini-Notation Quick Reference
Space=sequence, []=group, <>=alternate per cycle, *N=repeat, /N=slow, ~=rest, ,=stack/parallel, (b,s)=euclidean, :N=sample index, ?=random drop, !=replicate, @N=elongate

## Genre Reference (for style matching)
${genreRef}

## Strudel Reference (for valid syntax)
${miniRef}`;

const MAX_HISTORY = 10;

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as ApiRequest;
	const { prompt, currentCode, conversationHistory } = body;

	if (!prompt || typeof prompt !== 'string') {
		return new Response(JSON.stringify({ error: 'prompt is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const history = (conversationHistory || []).slice(-MAX_HISTORY);
	const historyBlock = history
		.map((m) => `${m.role}: ${m.text}${m.code ? '\n[code]:\n' + m.code : ''}`)
		.join('\n\n');

	const fullPrompt = `${SYSTEM}

<current-editor-code>
${currentCode || '// empty — no code loaded yet'}
</current-editor-code>

<conversation-history>
${historyBlock || '(none)'}
</conversation-history>

User: ${prompt}`;

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

				const toolCalls: ToolCall[] = data.toolCalls || [];
				const message: string = data.message || '';

				const hasStop = toolCalls.some((t) => t.tool === 'stop_playback');
				const hasCode = toolCalls.some(
					(t) =>
						t.tool !== 'stop_playback' &&
						t.tool !== 'add_effects' &&
						t.tool !== 'remove_layer'
				);

				let action: ApiResponse['action'] = 'none';
				let code = '';

				if (hasStop) {
					action = 'stop';
				} else if (toolCalls.length > 0) {
					code = assembleCode(toolCalls, currentCode);
					action = code ? 'update' : 'none';
				}

				const response: ApiResponse = { toolCalls, code, action, message };
				resolve(
					new Response(JSON.stringify(response), {
						headers: { 'Content-Type': 'application/json' }
					})
				);
			} catch {
				resolve(
					new Response(
						JSON.stringify({
							toolCalls: [],
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
				new Response(
					JSON.stringify({
						toolCalls: [],
						code: '',
						action: 'none',
						message: `Error: ${err.message}`
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } }
				)
			);
		});
	});
};
