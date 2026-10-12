<script lang="ts">
	import SideDoc from '$lib/components/SideDoc.svelte';
	export let editable = true;
</script>

<div class="notes-panel">
	<SideDoc {editable} />
</div>

<style>
	.notes-panel {
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
</style>
