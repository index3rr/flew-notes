<script lang="ts">
	import type { SavedNodesData } from '$lib/models/autoSave';
	import { savedFlow } from '$lib/models/transition';
	import { settings } from '$lib/models/settings';
	export let flowData: SavedNodesData;
	export let alternate = false;
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
	class:file={filename !== null}
	data-filename={filename}
	transition:savedFlow
>
	<div class="infoView" class:customScrollbar={settings.data.customScrollbar.value}>
		<div class="infos">
			<div class="flow-heading">
				<strong class="info">{flowData.title || 'Untitled flow'}</strong>
				<time
					class="time"
					datetime={flowData.created}
					title={new Date(flowData.created).toLocaleString()}>{prettyDate(flowData.created)}</time
				>
			</div>
			{#each flowData.flowInfos as info}
				<div
					class="info"
					class:palette-accent={!info.invert}
					class:palette-accent-secondary={info.invert}
				>
					{info.content}
				</div>
			{/each}
		</div>
	</div>
	<div class="fixed">
		<div class="flowButtons">
			<slot />
		</div>
	</div>
</div>

<style>
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
