<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { ConversationMessage, ApiResponse } from '$lib/types';
	import { saveBeat, getAllBeats, deleteBeat, type SavedBeat } from '$lib/storage';

	const MAX_RETRIES = 2;
	const MAX_HISTORY = 10;

	let ready = $state(false);
	let editorEl: HTMLElement | undefined = $state();

	let chatInput = $state('');
	let messages = $state<Array<{ role: 'user' | 'assistant'; text: string; code?: string }>>([]);
	let waiting = $state(false);
	let retryInfo = $state('');
	let chatMessagesEl: HTMLElement | undefined = $state();
	let currentCode = $state('');

	// Save/Browse state
	let showSaveDialog = $state(false);
	let saveName = $state('');
	let showBrowse = $state(false);
	let savedBeats = $state<SavedBeat[]>([]);

	function getEditor() {
		return (editorEl as any)?.editor;
	}

	function play() {
		getEditor()?.start();
	}

	function stop() {
		getEditor()?.stop();
	}

	function updateEditor() {
		getEditor()?.evaluate();
	}

	function readEditorCode(): string {
		try {
			return getEditor()?.editor?.state?.doc?.toString() || '';
		} catch {
			return '';
		}
	}

	// Save/Browse
	function openSaveDialog() {
		saveName = '';
		showSaveDialog = true;
	}

	async function handleSave() {
		const name = saveName.trim();
		if (!name) return;
		const code = currentCode || readEditorCode();
		if (!code) return;
		await saveBeat(name, code);
		showSaveDialog = false;
		saveName = '';
	}

	function handleSaveKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSave();
		} else if (e.key === 'Escape') {
			showSaveDialog = false;
		}
	}

	async function openBrowse() {
		savedBeats = await getAllBeats();
		showBrowse = true;
	}

	function loadBeat(beat: SavedBeat) {
		const editor = getEditor();
		if (!editor) return;
		editor.setCode(beat.code);
		currentCode = beat.code;
		showBrowse = false;
	}

	async function removeBeat(id: number) {
		await deleteBeat(id);
		savedBeats = await getAllBeats();
	}

	// Evaluation + retry
	function evaluateAndWaitForResult(): Promise<{ error?: string }> {
		return new Promise((resolve) => {
			const timeout = setTimeout(() => resolve({}), 5000);

			const handler = (e: Event) => {
				clearTimeout(timeout);
				editorEl?.removeEventListener('update', handler);
				const detail = (e as CustomEvent).detail;
				if (detail?.evalError) {
					resolve({ error: detail.evalError.message || String(detail.evalError) });
				} else {
					resolve({});
				}
			};

			editorEl?.addEventListener('update', handler, { once: true });
			getEditor()?.evaluate();
		});
	}

	async function executeAction(
		action: string,
		code: string
	): Promise<{ error?: string }> {
		const editor = getEditor();
		if (!editor) return {};

		if (code && (action === 'update' || action === 'play')) {
			editor.setCode(code);
			currentCode = code;
			const result = await evaluateAndWaitForResult();
			if (action === 'play' && !result.error) {
				editor.start();
			}
			return result;
		}
		if (action === 'stop') {
			editor.stop();
		}
		return {};
	}

	function buildConversationHistory(): ConversationMessage[] {
		return messages.slice(-MAX_HISTORY).map((m) => ({
			role: m.role,
			text: m.text,
			code: m.code
		}));
	}

	async function callApi(prompt: string): Promise<ApiResponse> {
		const res = await fetch('/api/claude', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				prompt,
				currentCode: currentCode || readEditorCode(),
				conversationHistory: buildConversationHistory()
			})
		});

		if (!res.ok) throw new Error(res.statusText);
		return await res.json();
	}

	async function scrollToBottom() {
		await tick();
		chatMessagesEl?.scrollTo({ top: chatMessagesEl.scrollHeight, behavior: 'smooth' });
	}

	async function sendMessage() {
		const prompt = chatInput.trim();
		if (!prompt || waiting) return;

		chatInput = '';
		messages.push({ role: 'user', text: prompt });
		waiting = true;
		retryInfo = '';
		scrollToBottom();

		try {
			const data = await callApi(prompt);

			messages.push({
				role: 'assistant',
				text: data.message || 'Done.',
				code: data.code || undefined
			});
			scrollToBottom();

			if (data.action && data.action !== 'none') {
				const result = await executeAction(data.action, data.code || '');

				if (result.error) {
					let retryCount = 0;
					let lastError = result.error;
					let lastCode = data.code || '';

					while (retryCount < MAX_RETRIES) {
						retryCount++;
						retryInfo = `Fixing error (attempt ${retryCount}/${MAX_RETRIES})...`;
						scrollToBottom();

						const retryPrompt = `The code produced an error: "${lastError}". Fix it. The failing code:\n${lastCode}`;
						const retryData = await callApi(retryPrompt);

						messages[messages.length - 1].text =
							retryData.message || messages[messages.length - 1].text;
						messages[messages.length - 1].code = retryData.code || undefined;
						scrollToBottom();

						if (retryData.action && retryData.action !== 'none' && retryData.code) {
							const retryResult = await executeAction(retryData.action, retryData.code);
							if (!retryResult.error) {
								retryInfo = '';
								break;
							}
							lastError = retryResult.error;
							lastCode = retryData.code;
						} else {
							break;
						}
					}

					if (retryInfo) {
						messages.push({
							role: 'assistant',
							text: `Could not fix the error after ${MAX_RETRIES} retries. The code is in the editor for manual editing.`
						});
						retryInfo = '';
						scrollToBottom();
					}
				}
			}
		} catch (err: any) {
			messages.push({ role: 'assistant', text: `Error: ${err.message}` });
		} finally {
			waiting = false;
			retryInfo = '';
			scrollToBottom();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function handleEditorUpdate(e: Event) {
		const detail = (e as CustomEvent).detail;
		if (detail?.code) {
			currentCode = detail.code;
		}
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	onMount(async () => {
		await import('@strudel/repl');
		ready = true;
		await tick();
		editorEl?.addEventListener('update', handleEditorUpdate);
		return () => editorEl?.removeEventListener('update', handleEditorUpdate);
	});
</script>

<div class="layout">
	<div class="editor-pane">
		<header>
			<h1>Strudel Player</h1>
			<p>Live code music in your browser</p>
		</header>

		{#if ready}
			<div class="controls">
				<button class="btn play" onclick={play}>Play</button>
				<button class="btn stop" onclick={stop}>Stop</button>
				<button class="btn update" onclick={updateEditor}>Update</button>
				<div class="controls-spacer"></div>
				<button class="btn save" onclick={openSaveDialog}>Save</button>
				<button class="btn browse" onclick={openBrowse}>Browse</button>
			</div>

			<div class="editor-wrap">
				<strudel-editor bind:this={editorEl}>
					<!--
s("bd sd:1 hh bd sd:3")
.bank("RolandTR808")
.speed(1)
					-->
				</strudel-editor>
			</div>
		{:else}
			<div class="loading">Loading editor...</div>
		{/if}
	</div>

	<div class="chat-pane">
		<div class="chat-header">Strudel Assistant</div>

		<div class="chat-messages" bind:this={chatMessagesEl}>
			{#each messages as msg}
				<div class="msg {msg.role}">
					<span class="msg-label">{msg.role === 'user' ? 'You' : 'Claude'}</span>
					<pre class="msg-text">{msg.text}</pre>
					{#if msg.code}
						<pre class="msg-code">{msg.code}</pre>
					{/if}
				</div>
			{/each}

			{#if waiting}
				<div class="status-indicator">{retryInfo || 'Thinking...'}</div>
			{/if}
		</div>

		<div class="chat-input-area">
			<textarea
				bind:value={chatInput}
				onkeydown={handleKeydown}
				placeholder="Describe the music you want..."
				rows="2"
				disabled={waiting}
			></textarea>
			<button class="btn send" onclick={sendMessage} disabled={waiting || !chatInput.trim()}>
				Send
			</button>
		</div>
	</div>
</div>

<!-- Save dialog -->
{#if showSaveDialog}
	<div class="overlay" onclick={() => (showSaveDialog = false)} role="presentation">
		<div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog">
			<h2>Save Beat</h2>
			<input
				type="text"
				bind:value={saveName}
				onkeydown={handleSaveKeydown}
				placeholder="Beat name..."
				autofocus
			/>
			<div class="dialog-actions">
				<button class="btn cancel" onclick={() => (showSaveDialog = false)}>Cancel</button>
				<button class="btn confirm" onclick={handleSave} disabled={!saveName.trim()}>Save</button>
			</div>
		</div>
	</div>
{/if}

<!-- Browse dialog -->
{#if showBrowse}
	<div class="overlay" onclick={() => (showBrowse = false)} role="presentation">
		<div class="dialog browse-dialog" onclick={(e) => e.stopPropagation()} role="dialog">
			<h2>Saved Beats</h2>
			{#if savedBeats.length === 0}
				<p class="empty-state">No saved beats yet.</p>
			{:else}
				<div class="beat-list">
					{#each savedBeats as beat}
						<div class="beat-item">
							<div class="beat-info">
								<span class="beat-name">{beat.name}</span>
								<span class="beat-date">{formatDate(beat.updatedAt)}</span>
							</div>
							<div class="beat-actions">
								<button class="btn-sm load" onclick={() => loadBeat(beat)}>Load</button>
								<button class="btn-sm delete" onclick={() => removeBeat(beat.id)}>Delete</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
			<div class="dialog-actions">
				<button class="btn cancel" onclick={() => (showBrowse = false)}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, -apple-system, sans-serif;
		background: #1a1a2e;
		color: #e0e0e0;
		height: 100vh;
		overflow: hidden;
	}

	.layout {
		display: grid;
		grid-template-columns: 1fr 400px;
		height: 100vh;
	}

	.editor-pane {
		padding: 2rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.editor-wrap {
		flex: 1 1 0;
		min-height: 0;
		position: relative;
	}

	:global(strudel-editor) {
		position: absolute;
		inset: 0;
		display: block;
		overflow: auto;
	}

	header {
		margin-bottom: 1.5rem;
		flex-shrink: 0;
	}

	h1 {
		margin: 0;
		font-size: 1.8rem;
		color: #fff;
	}

	header p {
		margin: 0.5rem 0 0;
		color: #888;
	}

	.controls {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1rem;
		flex-shrink: 0;
		align-items: center;
	}

	.controls-spacer {
		flex: 1;
	}

	.btn {
		padding: 0.5rem 1.25rem;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.btn:hover {
		opacity: 0.85;
	}

	.btn:active {
		opacity: 0.7;
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.play {
		background: #4caf50;
		color: #fff;
	}

	.stop {
		background: #e53935;
		color: #fff;
	}

	.update {
		background: #2196f3;
		color: #fff;
	}

	.save {
		background: #ff9800;
		color: #fff;
	}

	.browse {
		background: #7c4dff;
		color: #fff;
	}

	.loading {
		padding: 2rem;
		text-align: center;
		color: #666;
	}

	.chat-pane {
		display: flex;
		flex-direction: column;
		border-left: 1px solid #2a2a4a;
		background: #16162a;
		height: 100vh;
		min-height: 0;
	}

	.chat-header {
		padding: 1rem 1.25rem;
		font-weight: 700;
		font-size: 1rem;
		border-bottom: 1px solid #2a2a4a;
		color: #fff;
		flex-shrink: 0;
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
	}

	.msg {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.msg-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.msg.user .msg-label {
		color: #90caf9;
	}

	.msg.assistant .msg-label {
		color: #a5d6a7;
	}

	.msg-text {
		margin: 0;
		white-space: pre-wrap;
		word-wrap: break-word;
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 0.85rem;
		line-height: 1.5;
		color: #ddd;
	}

	.msg-code {
		margin: 0.5rem 0 0;
		padding: 0.75rem;
		background: #1a1a2e;
		border: 1px solid #2a2a4a;
		border-radius: 6px;
		white-space: pre-wrap;
		word-wrap: break-word;
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 0.8rem;
		line-height: 1.5;
		color: #c792ea;
	}

	.status-indicator {
		color: #f0a050;
		font-style: italic;
		font-size: 0.85rem;
	}

	.chat-input-area {
		display: flex;
		gap: 0.5rem;
		padding: 1rem;
		border-top: 1px solid #2a2a4a;
		flex-shrink: 0;
	}

	.chat-input-area textarea {
		flex: 1;
		resize: none;
		background: #1e1e3a;
		border: 1px solid #2a2a4a;
		border-radius: 6px;
		color: #e0e0e0;
		padding: 0.5rem 0.75rem;
		font-family: inherit;
		font-size: 0.85rem;
	}

	.chat-input-area textarea:focus {
		outline: none;
		border-color: #5c6bc0;
	}

	.send {
		background: #5c6bc0;
		color: #fff;
		align-self: flex-end;
	}

	/* Overlay + Dialog */
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.dialog {
		background: #1e1e3a;
		border: 1px solid #2a2a4a;
		border-radius: 12px;
		padding: 1.5rem;
		width: 400px;
		max-width: 90vw;
	}

	.dialog h2 {
		margin: 0 0 1rem;
		font-size: 1.1rem;
		color: #fff;
	}

	.dialog input[type='text'] {
		width: 100%;
		padding: 0.6rem 0.75rem;
		background: #16162a;
		border: 1px solid #2a2a4a;
		border-radius: 6px;
		color: #e0e0e0;
		font-size: 0.9rem;
		font-family: inherit;
		box-sizing: border-box;
	}

	.dialog input[type='text']:focus {
		outline: none;
		border-color: #5c6bc0;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.cancel {
		background: #333;
		color: #ccc;
	}

	.confirm {
		background: #ff9800;
		color: #fff;
	}

	/* Browse dialog */
	.browse-dialog {
		width: 500px;
		max-height: 70vh;
		display: flex;
		flex-direction: column;
	}

	.beat-list {
		overflow-y: auto;
		max-height: 50vh;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.beat-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem;
		background: #16162a;
		border: 1px solid #2a2a4a;
		border-radius: 8px;
	}

	.beat-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.beat-name {
		font-weight: 600;
		color: #fff;
		font-size: 0.9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.beat-date {
		font-size: 0.75rem;
		color: #666;
	}

	.beat-actions {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.btn-sm {
		padding: 0.3rem 0.75rem;
		border: none;
		border-radius: 5px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.btn-sm:hover {
		opacity: 0.85;
	}

	.btn-sm.load {
		background: #5c6bc0;
		color: #fff;
	}

	.btn-sm.delete {
		background: #444;
		color: #e53935;
	}

	.empty-state {
		text-align: center;
		color: #666;
		padding: 2rem 0;
	}
</style>
