<script lang="ts">
	import PanelHeader from './PanelHeader.svelte';
	import SideDoc from '$lib/components/SideDoc.svelte';
</script>

<div class="notes-panel">
	<PanelHeader name="Notes" />
	<SideDoc />
</div>

<style>
	.notes-panel {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		min-height: 0;
		overflow: hidden;
	}
</style>
