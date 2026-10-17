<script lang="ts">
	import PanelPlaceholder from './PanelPlaceholder.svelte';
	import SideDoc from '$lib/components/SideDoc.svelte';
	export let editable = true;
</script>

<div class="notes-panel" class:unavailable={!editable}>
	{#if editable}<SideDoc />{:else}<PanelPlaceholder name="Notes" />{/if}
</div>

<style>
	.notes-panel.unavailable {
		height: auto;
	}
	.notes-panel {
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
</style>
