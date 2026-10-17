<script lang="ts">
	import Button from './Button.svelte';
	import {
		deleteNodes,
		loadSavedNodes,
		type SavedNodesData,
		downloadSavedNodes
	} from '$lib/models/autoSave';
	import FlowCard from './FlowCard.svelte';

	export let flowData: SavedNodesData;
	export let key: string;
	export let alternate = false;

	let error = '';
	async function saveAs() {
		error = '';
		try {
			await downloadSavedNodes(key);
		} catch (e) {
			error = (e as Error).message;
		}
	}

	async function open(copy = false) {
		try {
			await loadSavedNodes(key, !copy);
		} catch (e) {
			error = (e as Error).message;
		}
	}
</script>

<FlowCard {flowData} {alternate}>
	<Button icon="open" ariaLabel="open" tooltip="Open" on:click={() => open()} />
	<Button icon="copy" ariaLabel="duplicate" tooltip="Duplicate" on:click={() => open(true)} />
	<Button icon="download" ariaLabel="download" tooltip="Download" on:click={saveAs} />
	<Button
		icon="trash"
		ariaLabel="delete"
		tooltip="Delete"
		on:click={() => {
			if (confirm('Delete this browser save? This cannot be undone.')) deleteNodes(key);
		}}
	/>
</FlowCard>
{#if error}<p role="alert">{error}</p>{/if}
