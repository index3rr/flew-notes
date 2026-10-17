<script lang="ts">
	import type { SavedNodesData } from '$lib/models/autoSave';
	import { savedFlow } from '$lib/models/transition';
	import { createEventDispatcher } from 'svelte';
	import { settings } from '$lib/models/settings';
	export let flowData: SavedNodesData;
	export let alternate = false;
	export let compact = false;
	export let disabled = false;
	export let draggable = false;
	const dispatch = createEventDispatcher<{
		importPage: number;
		dragPage: { index: number; event: DragEvent };
	}>();
	export let filename: string | null = null;
	function prettyDate(date: string) {
		const today = new Date();
		const dateObj = new Date(date);
		if (
			today.getDate() === dateObj.getDate() &&
			today.getMonth() === dateObj.getMonth() &&
			today.getFullYear() === dateObj.getFullYear()
		) {
			return dateObj.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: 'numeric',
				hour12: true
			});
		} else {
			return dateObj.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		}
	}
</script>

<div
	class="flow"
	class:alternate
	class:compact
	class:file={filename !== null}
	data-filename={filename}
	transition:savedFlow
>
	<div class="infoView" class:customScrollbar={settings.data.customScrollbar.value}>
		<div class="infos">
			<div class="flow-heading">
				<strong class="info">{flowData.title || 'Untitled flow'}</strong>
				{#if !compact}<time
						class="time"
						datetime={flowData.modified}
						title={new Date(flowData.modified).toLocaleString()}
						>{prettyDate(flowData.modified)}</time
					>
				{/if}
			</div>
			{#each flowData.flowInfos as info, index}
				{#if compact}
					<button
						type="button"
						class="info page"
						aria-label={`Import ${info.content || 'Untitled page'}`}
						class:palette-accent={!info.invert}
						class:palette-accent-secondary={info.invert}
						{disabled}
						{draggable}
						title="Click to import page, or drag it into your flow"
						on:click={() => dispatch('importPage', index)}
						on:dragstart={(event) => dispatch('dragPage', { index, event })}
						>{info.content || 'Untitled page'}</button
					>
				{:else}
					<div
						class="info"
						class:palette-accent={!info.invert}
						class:palette-accent-secondary={info.invert}
					>
						{info.content}
					</div>
				{/if}
			{/each}
		</div>
	</div>
	{#if !compact}<div class="fixed">
			<div class="flowButtons">
				<slot />
			</div>
		</div>
	{/if}
</div>

<style>
	.flow.compact {
		grid-template-columns: minmax(0, 1fr);
		flex-shrink: 0;
	}
	.compact .infos {
		width: auto;
		flex-wrap: wrap;
		gap: var(--padding-small);
	}
	.compact .infoView {
		overflow: visible;
	}
	.compact .flow-heading {
		width: 100%;
	}
	.compact .flow-heading .info {
		background: transparent;
		padding: 0;
		height: auto;
		font-weight: var(--font-weight);
	}
	.compact .page {
		box-sizing: content-box;
		min-height: var(--button-size);
		height: auto;
		padding: var(--padding);
	}
	.page {
		border: 0;
		font: inherit;
		font-weight: var(--font-weight);
		cursor: pointer;
		max-width: 100%;
		transition: background var(--transition-speed);
	}
	.page:hover {
		background: var(--this-background-active);
	}
	.page:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.flow {
		padding: var(--padding);
		box-sizing: border-box;
		border-radius: var(--border-radius);
		background: var(--background);
		display: grid;
		flex-direction: row;
		width: 100%;
		position: relative;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--padding);
	}
	.flow.alternate {
		background: var(--background-secondary);
	}
	.infoView {
		overflow-x: auto;
		position: relative;
		border-radius: var(--border-radius);
	}
	.infos {
		display: flex;
		flex-direction: row;
		width: max-content;
		gap: var(--padding);
	}
	.info {
		padding: var(--padding);
		border-radius: var(--border-radius);
		background-color: var(--this-background-indent);
		color: var(--this-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		height: var(--button-size);
		display: flex;
		align-items: center;
	}
	.fixed {
		justify-content: flex-end;
		flex-wrap: wrap;
		display: flex;
		flex-direction: row;
		gap: var(--padding);
	}
	.flow-heading {
		gap: var(--padding);
		display: flex;
		flex-direction: row;
		align-items: center;
	}
	.time {
		padding: var(--padding);
		border-radius: var(--border-radius);
		color: var(--this-text);
		background-color: var(--background-indent);
		height: var(--button-size);
		display: flex;
		align-items: center;
		white-space: nowrap;
	}
	.flowButtons {
		justify-content: flex-end;
		flex-wrap: wrap;
		display: flex;
		flex-direction: row;
		gap: var(--padding);
	}
	@media (max-width: 800px) {
		.flow {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
