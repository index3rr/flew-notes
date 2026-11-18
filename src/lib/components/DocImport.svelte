<script lang="ts">
	import { onMount } from 'svelte';
	import Button from './Button.svelte';
	import { nodes, frozen } from '$lib/models/store';
	import { currentSpeech } from '$lib/models/timer';
	import { documentSpeeches, nextSpeech, speechForTimer } from '$lib/models/coverage';
	import { getAllDebateStyleFlows } from '$lib/models/debateStyle';
	import { importSpeechDoc } from '$lib/models/nodeDecorateAction';
	import { showArgument } from '$lib/models/argumentNavigation';
	import {
		matchPage,
		pageName,
		readSpeechDoc,
		shortenTag,
		speechFromFileName,
		type DocPlanItem
	} from '$lib/models/speechDoc';
	import type { FlowId } from '$lib/models/node';

	export let closePopup: () => void = () => undefined;
	export let name: string;
	export let blob: Blob;

	let items: DocPlanItem[] = [];
	let loading = true;
	let error = '';
	let shorten = true;
	let expanded: number | null = null;

	const speeches = documentSpeeches($nodes);
	let speech =
		speechFromFileName(name, speeches) ??
		($currentSpeech ? speechForTimer($currentSpeech.upcoming, speeches) : null) ??
		nextSpeech($nodes, speeches) ??
		speeches[0] ??
		'';
	$: pages = $nodes.root.children
		.map((id) => ({ id, value: $nodes[id]?.value }))
		.filter((page) => page.value?.tag === 'flow')
		.map((page) => ({ id: page.id, name: page.value!.content as string }));
	$: count = items.filter((item) => item.target !== 'skip').length;

	onMount(async () => {
		try {
			const blocks = await readSpeechDoc(blob);
			if (!blocks.length)
				throw new Error('No headings found. Flowing needs a document with tags (Heading 4).');
			items = blocks.map((block) => {
				const id = matchPage(block, pages);
				return { block, target: id ?? 'new', newName: pageName(block) };
			});
		} catch (cause) {
			error = (cause as Error).message || 'Could not read this document.';
		} finally {
			loading = false;
		}
	});

	function setTarget(index: number, value: string) {
		items[index].target = value as FlowId | 'new' | 'skip';
	}

	function flow() {
		if ($frozen || !count) return;
		const result = importSpeechDoc(speech, items, getAllDebateStyleFlows(), shorten);
		closePopup();
		if (result?.first) showArgument(result.first);
	}
</script>

<div class="top palette-plain">
	<div class="heading">
		<p class="file">{name}</p>
		<label class="speech"
			>into
			<select aria-label="Speech column" bind:value={speech}>
				{#each speeches as option}<option value={option}>{option}</option>{/each}
			</select></label
		>
	</div>
	{#if loading}
		<p class="status">Reading headings…</p>
	{:else if error}
		<p class="status error" role="alert">{error}</p>
	{:else}
		<label class="option"
			><input type="checkbox" bind:checked={shorten} />shorten tags to their first claim</label
		>
		<ul class="blocks">
			{#each items as item, index}
				<li class:skipped={item.target === 'skip'}>
					<div class="block-heading">
						<button
							class="block-title"
							aria-expanded={expanded === index}
							on:click={() => (expanded = expanded === index ? null : index)}
						>
							{item.block.title}
							<span class="weak"
								>{item.block.tags.length} tag{item.block.tags.length === 1 ? '' : 's'}</span
							>
						</button>
						<select
							aria-label={`Page for ${item.block.title}`}
							value={item.target}
							on:change={(event) => setTarget(index, event.currentTarget.value)}
						>
							<option value="new">new page: {item.newName}</option>
							{#each pages as page}<option value={page.id}>{page.name || 'no name'}</option>{/each}
							<option value="skip">skip</option>
						</select>
					</div>
					{#if expanded === index}
						<ol class="tags">
							{#each item.block.tags as tag}<li>{shorten ? shortenTag(tag) : tag}</li>{/each}
						</ol>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<div class="actions">
		<Button
			icon="checklist"
			text={count
				? `Flow ${count} block${count === 1 ? '' : 's'} into ${speech}`
				: 'Nothing to flow'}
			disabled={loading || !!error || !count || $frozen}
			disabledReason={$frozen ? 'Wait for synchronization' : 'Choose a page for at least one block'}
			on:click={flow}
		/>
	</div>
</div>

<style>
	.top {
		width: min(calc(100vw - var(--padding) * 2), 600px);
		max-height: calc(100vh - var(--padding) * 2);
		padding: var(--padding-big);
		padding-top: calc(var(--button-size) + var(--padding) * 2);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--padding);
		overflow: auto;
	}
	p {
		margin: 0;
	}
	.heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--padding);
	}
	.file {
		overflow-wrap: anywhere;
	}
	.speech,
	.option {
		display: flex;
		align-items: center;
		gap: var(--padding);
		color: var(--text-weak);
		flex-shrink: 0;
	}
	.option input {
		accent-color: var(--color-accent);
		margin: 0;
	}
	.status {
		color: var(--text-weak);
		font-size: 0.85em;
	}
	.status.error {
		color: var(--text-error);
	}
	select {
		flex-shrink: 0;
		min-width: 0;
		width: 45%;
		padding: var(--padding);
		font: inherit;
		background: var(--background-indent);
		color: var(--text);
		border: none;
		border-radius: var(--border-radius);
		outline: none;
		transition: background var(--transition-speed);
	}
	.speech select {
		width: auto;
	}
	select:focus {
		background: var(--background-active);
	}
	.blocks,
	.tags {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.block-heading {
		display: flex;
		align-items: flex-start;
		gap: var(--padding);
	}
	.block-title {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		font-weight: var(--font-weight);
		text-align: left;
		padding: var(--padding);
		border-radius: var(--border-radius);
		overflow-wrap: anywhere;
		transition: background var(--transition-speed);
	}
	.block-title:hover {
		background: var(--background-indent);
	}
	.block-title:active {
		transition: none;
		background: var(--background-active);
	}
	.skipped .block-title,
	.weak {
		color: var(--text-weak);
	}
	.weak {
		font-size: 0.85em;
		padding-left: var(--padding);
	}
	.tags {
		padding: 0 var(--padding) var(--padding) var(--padding-big);
		color: var(--text-weak);
		font-size: 0.85em;
		list-style: decimal;
		display: block;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
</style>
