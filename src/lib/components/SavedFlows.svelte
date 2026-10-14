<script lang="ts">
	import { type SavedNodesDatas } from '$lib/models/autoSave';
	import { settings } from '$lib/models/settings';
	import Button from './Button.svelte';
	import SavedFlow from './SavedFlow.svelte';
	import FlowLibrary from './FlowLibrary.svelte';
	import { library, refreshLibrary, directFolderAccess } from '$lib/models/flowLibrary';
	export let busy = false;
	export let error = '';

	export let savedFlowsDatas: SavedNodesDatas;

	async function up() {
		if (busy) return;
		busy = true;
		error = '';
		try {
			await refreshLibrary($library.path.slice(0, -1));
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}
	$: sortedSavedFlowsDatas = Object.entries(savedFlowsDatas).sort(
		(a, b) => new Date(b[1].modified).getTime() - new Date(a[1].modified).getTime()
	);
</script>

<div class="top">
	<div class="above">
		<div class="title">
			<h1 title={[$library.name, ...$library.path].join(' / ')}>
				{#if directFolderAccess && $library.name}Flows in {$library.path[
						$library.path.length - 1
					] ?? $library.name}{:else if !directFolderAccess}Local flows{:else}saved flows{/if}
			</h1>
			{#if directFolderAccess && $library.connected && $library.path.length}
				<Button
					icon="undo"
					text="Up one folder"
					tooltip="Go to the parent folder"
					disabled={busy}
					on:click={up}
				/>
			{/if}
		</div>
	</div>
	<div class="view" class:customScrollbar={settings.data.customScrollbar.value}>
		<div class="flows">
			{#if directFolderAccess && $library.name}
				<FlowLibrary bind:busy bind:error />
			{/if}
			{#if !$library.name || !directFolderAccess}
				{#each sortedSavedFlowsDatas as [key, flowData], index (key)}
					<SavedFlow {flowData} {key} alternate={index % 2 === 1} />
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.top {
		padding: 0;
		margin: 0;
		border: none;
		background: none;
		height: 100%;
		width: 100%;
		color: inherit;
		text-align: left;

		border-radius: var(--border-radius);
		background-color: var(--background);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		min-width: 38ch;

		gap: var(--padding);
	}
	.view {
		overflow-y: auto;
	}
	.flows {
		display: flex;
		flex-direction: column;
		gap: var(--padding-big);
		padding: 0 var(--padding) 50vh var(--padding);
	}
	h1 {
		margin: 0;
		padding: 0;
		line-height: 1em;
		white-space: nowrap;
	}
	.above {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		height: calc(var(--button-size) + var(--padding) * 4);
		padding: 0 var(--padding);
		gap: var(--padding);
		box-sizing: border-box;
	}
	.title {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: var(--padding);
	}
</style>
