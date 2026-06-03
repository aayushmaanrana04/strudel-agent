#!/usr/bin/env npx tsx

/**
 * Generate intent → strudel code pairs using Claude CLI (batched).
 *
 * Usage:
 *   npx tsx tools/generate-strudel-dataset.ts                    # generate all
 *   npx tsx tools/generate-strudel-dataset.ts --limit 500        # generate first 500
 *   npx tsx tools/generate-strudel-dataset.ts --validate         # validate existing
 *   npx tsx tools/generate-strudel-dataset.ts --split            # train/val/test split
 *   npx tsx tools/generate-strudel-dataset.ts --stats            # show stats
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const PROJECT_DIR = process.cwd();
const DATA_DIR = join(PROJECT_DIR, 'data');
const INPUT_FILE = join(DATA_DIR, 'dataset.jsonl');
const OUT_FILE = join(DATA_DIR, 'strudel-dataset.jsonl');
const PROGRESS_FILE = join(DATA_DIR, '.strudel-progress');
const BATCH_SIZE = 50;

const SYSTEM_PROMPT = `You are a strudel.cc code generator. Given a numbered list of music intent JSONs, write valid strudel code for EACH one.

RULES:
- For each intent, output the number followed by the code on ONE line: "1: stack(...)"
- Output ONLY numbered code lines. No explanation, no markdown.
- Use stack() to layer multiple instruments.
- Use s() for drums, note() or n()+.scale() for melodies.
- Use .bank("RolandTR808") / .bank("RolandTR909") for drum kits.
- .cpm(bpm/4) for tempo. Example: 120 BPM = .cpm(30).
- Be creative — vary patterns across similar intents.
- Match mood via scale, effects, pattern density.

SOUNDS: bd sd hh oh cp rim cr rd ht mt lt cb sh tb | sine sawtooth square triangle | gm_acoustic_grand_piano gm_acoustic_bass gm_sitar gm_flute gm_xylophone gm_vibraphone gm_violin gm_trumpet gm_synth_strings_1 gm_synth_bass_1 gm_pad_1_new_age gm_choir_aahs gm_acoustic_guitar_nylon gm_kalimba gm_taiko_drum gm_steel_drums gm_marimba

EXAMPLE:

1: {"genre":"techno","tempo":130,"key":"C","scale":"minor","mood":["dark"],"energy":"high","instruments":["drums","bass","synth"],"drum_kit":"TR909","rhythm_style":"four_on_the_floor"}
2: {"genre":"lofi","tempo":75,"key":"D","scale":"dorian","mood":["chill"],"instruments":["drums","bass","piano","pad"],"drum_kit":"TR808","rhythm_style":"swing"}

OUTPUT:
1: stack(s("bd*4").bank("RolandTR909").gain(0.9),s("~ cp ~ cp").bank("RolandTR909").gain(0.7),s("hh*8").bank("RolandTR909").gain(0.4),note("c2 ~ c2 ~").s("sine").lpf(200).gain(0.6)).cpm(32.5)
2: stack(s("bd [~ bd] ~ bd, ~ sd ~ sd").bank("RolandTR808").gain(0.6).swing(4),s("hh*8").bank("RolandTR808").gain(0.25),n("0 2 4 6").scale("D:dorian").s("gm_acoustic_grand_piano").gain(0.4).room(0.5),note("d2 a1 g1 f1").s("triangle").lpf(400).gain(0.3)).cpm(18.75)`;

interface IntentExample {
	prompt: string;
	intent: any;
}

function generateBatch(items: IntentExample[]): Map<number, string> {
	const numberedIntents = items
		.map((item, i) => `${i + 1}: ${JSON.stringify(item.intent)}`)
		.join('\n');

	const prompt = `${SYSTEM_PROMPT}\n\nNow generate code for these ${items.length} intents:\n\n${numberedIntents}`;

	try {
		const result = execSync(`claude -p ${JSON.stringify(prompt)}`, {
			encoding: 'utf-8',
			timeout: 300000,
			cwd: PROJECT_DIR
		}).trim();

		const results = new Map<number, string>();
		const lines = result.split('\n');

		for (const line of lines) {
			const match = line.match(/^(\d+):\s*(.+)/);
			if (match) {
				const num = parseInt(match[1]);
				let code = match[2].trim();
				// Strip backticks if present
				code = code.replace(/^```\w*\s*/, '').replace(/\s*```$/, '');
				if (code.length >= 10 && (code.includes('s(') || code.includes('note(') || code.includes('n('))) {
					results.set(num, code);
				}
			}
		}

		return results;
	} catch (err: any) {
		console.error(`  Batch error: ${err.message?.slice(0, 100)}`);
		return new Map();
	}
}

function getProgress(): number {
	if (existsSync(PROGRESS_FILE)) {
		return parseInt(readFileSync(PROGRESS_FILE, 'utf-8').trim()) || 0;
	}
	return 0;
}

function setProgress(n: number) {
	writeFileSync(PROGRESS_FILE, String(n));
}

function cmd_generate() {
	const limit = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') ||
		(process.argv.includes('--limit') ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) : 0) ||
		Infinity;

	if (!existsSync(INPUT_FILE)) {
		console.error('No intent dataset found. Run generate-dataset.ts first.');
		process.exit(1);
	}

	const intents = readFileSync(INPUT_FILE, 'utf-8').trim().split('\n').map(l => JSON.parse(l));
	const genIntents = intents.filter(d =>
		!d.intent.action || (d.intent.action !== 'stop' && d.intent.action !== 'modify')
	);

	const startFrom = getProgress();
	const total = Math.min(startFrom + limit, genIntents.length);

	console.log(`Total generation intents: ${genIntents.length}`);
	console.log(`Progress: ${startFrom}/${genIntents.length}`);
	console.log(`Target: ${total} (batch size: ${BATCH_SIZE})`);
	console.log(`Batches remaining: ${Math.ceil((total - startFrom) / BATCH_SIZE)}`);
	console.log();

	let success = 0;
	let failed = 0;
	let batchNum = 0;

	for (let i = startFrom; i < total; i += BATCH_SIZE) {
		batchNum++;
		const batchEnd = Math.min(i + BATCH_SIZE, total);
		const batch = genIntents.slice(i, batchEnd);

		console.log(`Batch ${batchNum}: examples ${i + 1}-${batchEnd} (${batch.length} items)...`);

		const results = generateBatch(batch);
		console.log(`  Got ${results.size}/${batch.length} results`);

		for (let j = 0; j < batch.length; j++) {
			const code = results.get(j + 1);
			if (code) {
				const example = { intent: batch[j].intent, prompt: batch[j].prompt, code };
				appendFileSync(OUT_FILE, JSON.stringify(example) + '\n');
				success++;
			} else {
				failed++;
			}
		}

		setProgress(batchEnd);

		// Progress update
		const existing = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf-8').trim().split('\n').length : 0;
		console.log(`  Total in dataset: ${existing} | Success: ${success}, Failed: ${failed}`);
		console.log();

		if (batchEnd < total) {
			execSync('sleep 2');
		}
	}

	console.log(`Done: ${success} success, ${failed} failed`);
	const finalCount = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf-8').trim().split('\n').length : 0;
	console.log(`Total in dataset: ${finalCount}`);
}

function cmd_validate() {
	if (!existsSync(OUT_FILE)) {
		console.log('No strudel dataset found.');
		process.exit(1);
	}

	const data = readFileSync(OUT_FILE, 'utf-8').trim().split('\n').map(l => JSON.parse(l));
	let valid = 0;
	const issues: string[] = [];

	for (let i = 0; i < data.length; i++) {
		const d = data[i];
		if (!d.code || d.code.length < 10) {
			issues.push(`[${i}] Code too short: "${d.code?.slice(0, 50)}"`);
			continue;
		}
		if (!d.code.includes('s(') && !d.code.includes('note(') && !d.code.includes('n(')) {
			issues.push(`[${i}] No sound source: "${d.code.slice(0, 80)}"`);
			continue;
		}
		if (d.code.includes('```')) {
			issues.push(`[${i}] Contains backticks`);
			continue;
		}
		valid++;
	}

	console.log(`Total: ${data.length}`);
	console.log(`Valid: ${valid}`);
	console.log(`Issues: ${issues.length}`);
	if (issues.length > 0) {
		console.log('Sample issues:');
		issues.slice(0, 10).forEach(i => console.log(`  ${i}`));
	}
}

function cmd_split() {
	if (!existsSync(OUT_FILE)) {
		console.log('No strudel dataset found.');
		process.exit(1);
	}

	const data = readFileSync(OUT_FILE, 'utf-8').trim().split('\n').map(l => JSON.parse(l));
	const shuffled = data.sort(() => Math.random() - 0.5);

	const SYS = 'You convert music intent JSON to strudel.cc code. Output ONLY valid strudel code.';

	function toChatFormat(examples: any[]) {
		return examples.map(d => ({
			messages: [
				{ role: 'system', content: SYS },
				{ role: 'user', content: JSON.stringify(d.intent) },
				{ role: 'assistant', content: d.code }
			]
		}));
	}

	const testSize = Math.floor(shuffled.length * 0.08);
	const valSize = Math.floor(shuffled.length * 0.12);
	const test = toChatFormat(shuffled.slice(0, testSize));
	const val = toChatFormat(shuffled.slice(testSize, testSize + valSize));
	const train = toChatFormat(shuffled.slice(testSize + valSize));

	const outDir = join(DATA_DIR, 'strudel-finetune');
	mkdirSync(outDir, { recursive: true });

	const writeJsonl = (path: string, items: any[]) =>
		writeFileSync(path, items.map(i => JSON.stringify(i)).join('\n') + '\n');

	writeJsonl(join(outDir, 'train.jsonl'), train);
	writeJsonl(join(outDir, 'valid.jsonl'), val);
	writeJsonl(join(outDir, 'test.jsonl'), test);

	console.log(`Split: train=${train.length}, val=${val.length}, test=${test.length}`);
	console.log(`Written to ${outDir}/`);
}

function cmd_stats() {
	if (!existsSync(OUT_FILE)) {
		console.log('No strudel dataset found.');
		process.exit(1);
	}

	const data = readFileSync(OUT_FILE, 'utf-8').trim().split('\n').map(l => JSON.parse(l));
	const genres: Record<string, number> = {};
	let totalCodeLen = 0;
	let hasStack = 0;

	for (const d of data) {
		const g = d.intent?.genre || 'unknown';
		genres[g] = (genres[g] || 0) + 1;
		totalCodeLen += d.code?.length || 0;
		if (d.code?.includes('stack(')) hasStack++;
	}

	console.log(`Total examples: ${data.length}`);
	console.log(`Avg code length: ${Math.round(totalCodeLen / data.length)} chars`);
	console.log(`With stack(): ${hasStack} (${Math.round(hasStack * 100 / data.length)}%)`);
	console.log(`Genres covered: ${Object.keys(genres).length}`);
	console.log(`Min per genre: ${Math.min(...Object.values(genres))}`);
	console.log(`Max per genre: ${Math.max(...Object.values(genres))}`);
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--validate')) cmd_validate();
else if (args.includes('--split')) cmd_split();
else if (args.includes('--stats')) cmd_stats();
else cmd_generate();
