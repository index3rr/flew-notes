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
	async function open(copy = false) {
		try {
			await loadSavedNodes(key, !copy);
		} catch (e) {
			error = (e as Error).message;
		}
	}
</script>

<FlowCard {flowData} {alternate}>
	<Button icon="open" text="open" on:click={() => open()} />
	<Button icon="copy" text="duplicate" on:click={() => open(true)} />
	<Button icon="download" text="download" on:click={() => downloadSavedNodes(key)} />
	<Button
		icon="trash"
		text="delete"
		on:click={() => {
			if (confirm('Delete this browser save? This cannot be undone.')) deleteNodes(key);
		}}
	/>
</FlowCard>
{#if error}<p role="alert">{error}</p>{/if}
