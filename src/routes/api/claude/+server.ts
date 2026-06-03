import { spawn } from 'child_process';
import type { RequestHandler } from './$types';
import { formatStrudel } from '$lib/format-strudel';

const SYSTEM = `You write strudel.cc live-coding music. Output ONLY valid strudel code, no explanation, no markdown, no backticks.

SOUND PALETTE:
Drums: bd (kick), sd (snare), hh (closed hihat), oh (open hihat), cp (clap), rim (rimshot), cr (crash), rd (ride), ht/mt/lt (high/mid/low tom), cb (cowbell), sh (shaker), tb (tambourine)
Banks: RolandTR808 (hip-hop/trap), RolandTR909 (house/techno), RolandTR707 (retro), AkaiLinn (electronic)
Synths: sine (pure/clean), sawtooth (buzzy/rich), square (hollow/8bit), triangle (soft/warm)
GM instruments: gm_acoustic_grand_piano, gm_electric_piano_1, gm_acoustic_bass, gm_electric_bass_finger, gm_acoustic_guitar_nylon, gm_acoustic_guitar_steel, gm_violin, gm_cello, gm_flute, gm_clarinet, gm_trumpet, gm_alto_sax, gm_sitar, gm_banjo, gm_shamisen, gm_koto, gm_kalimba, gm_bagpipe, gm_fiddle, gm_tabla, gm_taiko_drum, gm_steel_drums, gm_xylophone, gm_vibraphone, gm_marimba, gm_synth_strings_1, gm_synth_bass_1, gm_pad_1_new_age, gm_lead_2_sawtooth, gm_choir_aahs
Noise: white, pink, brown

EFFECTS:
.lpf(hz) low-pass (warmth), .hpf(hz) high-pass (brightness), .lpq(n) resonance
.room(0-1) reverb, .roomsize(0-10) space size
.delay(0-1) echo, .delaytime(sec), .delayfeedback(0-1)
.gain(0-1) volume, .pan(0-1) stereo (0=left, 1=right)
.crush(1-16) lo-fi, .shape(0-1) distortion
.attack(sec) .decay(sec) .sustain(0-1) .release(sec) envelope
.speed(n) playback rate, .vib(hz) vibrato
.fm(depth) FM synthesis, .fmh(ratio) FM harmonicity

TEMPO: .cpm(bpm/4) — example: 120 BPM = .cpm(30)

STRUCTURE: Use stack() to layer patterns. Use .bank() for drum kits. Use .scale() with n() for melodic patterns.

RESPONSE FORMAT:
When asked to create or modify music, respond with ONLY a JSON object:
{"code":"<strudel code here>","action":"update","message":"<brief explanation>"}
When asked to stop: {"code":"","action":"stop","message":"Stopped."}
When just chatting: {"code":"","action":"none","message":"<your reply>"}
No other text outside the JSON.`;

const MAX_HISTORY = 10;

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, currentCode, conversationHistory } = await request.json();

	if (!prompt || typeof prompt !== 'string') {
		return new Response(JSON.stringify({ error: 'prompt is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const history = (conversationHistory || []).slice(-MAX_HISTORY);
	const historyBlock = history
		.map((m: any) => `${m.role}: ${m.text}${m.code ? '\n[code]:\n' + m.code : ''}`)
		.join('\n\n');

	const fullPrompt = `${SYSTEM}

<current-code>
${currentCode || '// empty'}
</current-code>

<history>
${historyBlock || '(none)'}
</history>

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

				resolve(
					new Response(
						JSON.stringify({
							code: data.code ? formatStrudel(data.code) : '',
							action: data.action || 'none',
							message: data.message || ''
						}),
						{ headers: { 'Content-Type': 'application/json' } }
					)
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
				new Response(
					JSON.stringify({ code: '', action: 'none', message: `Error: ${err.message}` }),
					{ status: 500, headers: { 'Content-Type': 'application/json' } }
				)
			);
		});
	});
};
