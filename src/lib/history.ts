import { createPatch, diffLines } from 'diff';

export interface Snapshot {
	code: string;
	prompt: string;
	timestamp: number;
}

export class HistoryService {
	private stack: Snapshot[] = [];
	private pointer: number = -1;
	private maxSize: number;

	constructor(maxSize = 50) {
		this.maxSize = maxSize;
	}

	push(code: string, prompt: string = ''): void {
		if (this.current()?.code === code) return;
		this.stack = this.stack.slice(0, this.pointer + 1);
		this.stack.push({ code, prompt, timestamp: Date.now() });
		if (this.stack.length > this.maxSize) this.stack.shift();
		this.pointer = this.stack.length - 1;
	}

	undo(): Snapshot | undefined {
		if (!this.canUndo) return undefined;
		return this.stack[--this.pointer];
	}

	redo(): Snapshot | undefined {
		if (!this.canRedo) return undefined;
		return this.stack[++this.pointer];
	}

	current(): Snapshot | undefined {
		return this.stack[this.pointer];
	}

	previous(): Snapshot | undefined {
		if (this.pointer > 0) return this.stack[this.pointer - 1];
		return undefined;
	}

	get canUndo(): boolean {
		return this.pointer > 0;
	}

	get canRedo(): boolean {
		return this.pointer < this.stack.length - 1;
	}

	get length(): number {
		return this.stack.length;
	}

	get position(): number {
		return this.pointer;
	}

	// Compact unified diff between previous and current version
	diffFromPrevious(): string {
		const prev = this.previous();
		const curr = this.current();
		if (!prev || !curr) return '';
		return createPatch('code', prev.code, curr.code, '', '', { context: 1 });
	}

	// Diff between any two versions
	diffBetween(fromIndex: number, toIndex: number): string {
		const from = this.stack[fromIndex];
		const to = this.stack[toIndex];
		if (!from || !to) return '';
		return createPatch('code', from.code, to.code, '', '', { context: 1 });
	}

	// Compact summary for LLM context — shows what changed and why
	contextForLLM(): string {
		const curr = this.current();
		if (!curr) return '';

		const prev = this.previous();
		if (!prev) return `Current code:\n${curr.code}`;

		const changes = diffLines(prev.code, curr.code);
		const summary = changes
			.filter((c) => c.added || c.removed)
			.map((c) => (c.added ? `+ ${c.value.trim()}` : `- ${c.value.trim()}`))
			.join('\n');

		if (!summary) return `Current code:\n${curr.code}`;

		return `Current code:\n${curr.code}\n\nLast change (from "${prev.prompt}"):\n${summary}`;
	}

	// Get all snapshots for browse/timeline UI
	all(): Snapshot[] {
		return [...this.stack];
	}

	clear(): void {
		this.stack = [];
		this.pointer = -1;
	}
}
