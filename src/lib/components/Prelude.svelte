<script lang="ts">
	import SavedFlows from './SavedFlows.svelte';
	import { savedNodesDatas } from '$lib/models/autoSave';
	export let busy = false;
	export let error = '';
</script>

<SavedFlows bind:busy bind:error savedFlowsDatas={$savedNodesDatas} />
