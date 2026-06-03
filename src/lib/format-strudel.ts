export function formatStrudel(code: string): string {
	const input = code.trim();

	// Tokenize: split into quoted strings and everything else
	// This ensures we never modify content inside quotes
	const tokens: Array<{ type: 'code' | 'string'; value: string }> = [];
	let i = 0;
	while (i < input.length) {
		if (input[i] === '"') {
			const start = i;
			i++;
			while (i < input.length && input[i] !== '"') {
				if (input[i] === '\\') i++;
				i++;
			}
			i++; // closing quote
			tokens.push({ type: 'string', value: input.slice(start, i) });
		} else {
			const start = i;
			while (i < input.length && input[i] !== '"') i++;
			tokens.push({ type: 'code', value: input.slice(start, i) });
		}
	}

	// Only transform code tokens, leave strings untouched
	const transformed = tokens.map((t) => {
		if (t.type === 'string') return t.value;

		let s = t.value;
		// Add newline before .method chains (but not the first one after source)
		s = s.replace(/\)(\s*\.)/g, ')\n  $1');
		// Format stack opening
		s = s.replace(/stack\(\s*/g, 'stack(\n  ');
		// Comma-separated stack layers
		s = s.replace(/,(\s*)(?=[a-z]|n\(|note\(|s\()/g, ',\n  ');
		return s;
	});

	let result = transformed.join('');

	// Clean up: fix double-indented lines, normalize indent
	const lines = result.split('\n');
	const output: string[] = [];
	let depth = 0;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) continue;

		// Track depth by parens
		if (line === ')' || line.startsWith(').') || line.startsWith(')$')) {
			depth = Math.max(0, depth - 1);
		}

		const indent = '  '.repeat(depth);

		if (line.startsWith('.')) {
			output.push(indent + '  ' + line);
		} else {
			output.push(indent + line);
		}

		// Increase depth after opening stack(
		if (line.startsWith('stack(')) {
			depth++;
		}
	}

	return output.join('\n');
}
