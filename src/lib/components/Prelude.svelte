<script lang="ts">
	import Tutorial from './Tutorial.svelte';
	import { showTutorial } from '$lib/models/tutorial';
	import SavedFlows from './SavedFlows.svelte';
	import { savedNodesDatas } from '$lib/models/autoSave';
	import { library } from '$lib/models/flowLibrary';
	export let busy = false;
	export let error = '';

	$: savedFlowsExist = Object.keys($savedNodesDatas).length > 0 || !!$library.name;
</script>

{#if savedFlowsExist && !$showTutorial}
	<SavedFlows bind:busy bind:error savedFlowsDatas={$savedNodesDatas} />
{:else}
	<Tutorial bind:showTutorial={$showTutorial} {savedFlowsExist} />
{/if}
