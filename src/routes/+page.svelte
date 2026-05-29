<script lang="ts">
	import { onMount, tick } from 'svelte';

	let ready = $state(false);
	let editorEl: HTMLElement | undefined = $state();

	let chatInput = $state('');
	let messages = $state<Array<{ role: 'user' | 'assistant'; text: string; code?: string }>>([]);
	let waiting = $state(false);
	let chatMessagesEl: HTMLElement | undefined = $state();

	function getEditor() {
		return (editorEl as any)?.editor;
	}

	function play() {
		getEditor()?.start();
	}

	function stop() {
		getEditor()?.stop();
	}

	function update() {
		getEditor()?.evaluate();
	}

	function setCode(code: string) {
		getEditor()?.setCode(code);
	}

	function executeAction(action: string, code: string) {
		const editor = getEditor();
		if (!editor) return;

		if (code && (action === 'update' || action === 'play')) {
			editor.setCode(code);
			editor.evaluate();
		}
		if (action === 'play') {
			editor.start();
		} else if (action === 'stop') {
			editor.stop();
		}
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
		scrollToBottom();

		try {
			const res = await fetch('/api/claude', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt })
			});

			if (!res.ok) {
				messages.push({ role: 'assistant', text: `Error: ${res.statusText}` });
				return;
			}

			const data = await res.json();
			messages.push({
				role: 'assistant',
				text: data.message || 'Done.',
				code: data.code || undefined
			});

			if (data.action && data.action !== 'none') {
				executeAction(data.action, data.code || '');
			}
		} catch (err: any) {
			messages.push({ role: 'assistant', text: `Error: ${err.message}` });
		} finally {
			waiting = false;
			scrollToBottom();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	onMount(async () => {
		await import('@strudel/repl');
		ready = true;
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
				<button class="btn update" onclick={update}>Update</button>
			</div>

			<strudel-editor bind:this={editorEl}>
				<!--
s("bd sd:1 hh bd sd:3")
.bank("RolandTR808")
.speed(1)
				-->
			</strudel-editor>
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
				<div class="waiting-indicator">Thinking...</div>
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
		overflow-y: auto;
	}

	header {
		margin-bottom: 1.5rem;
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
	}

	.chat-header {
		padding: 1rem 1.25rem;
		font-weight: 700;
		font-size: 1rem;
		border-bottom: 1px solid #2a2a4a;
		color: #fff;
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
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

	.waiting-indicator {
		color: #666;
		font-style: italic;
	}

	.chat-input-area {
		display: flex;
		gap: 0.5rem;
		padding: 1rem;
		border-top: 1px solid #2a2a4a;
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
</style>
