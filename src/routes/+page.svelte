<script lang="ts">
	import { onMount } from 'svelte';

	let ready = $state(false);
	let editorEl: HTMLElement | undefined = $state();

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

	onMount(async () => {
		await import('@strudel/repl');
		ready = true;
	});
</script>

<div class="container">
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

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, -apple-system, sans-serif;
		background: #1a1a2e;
		color: #e0e0e0;
	}

	.container {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		margin-bottom: 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: 1.8rem;
		color: #fff;
	}

	p {
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
</style>
