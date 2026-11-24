<script lang="ts">
	import type { BoxId } from '$lib/models/node';
	import { nodes } from '$lib/models/store';
	import { showArgument } from '$lib/models/argumentNavigation';
	import { goto } from '$app/navigation';
	import Button from './Button.svelte';
	export let id: BoxId;
</script>

<Button
	icon="arrowRight"
	text="Show argument"
	tooltip="Open the argument your partner linked"
	disabled={$nodes[id]?.value?.tag !== 'box'}
	disabledReason="This argument is no longer in the open flow"
	on:click={() => {
		if (showArgument(id) && location.pathname !== '/app') void goto('/app');
	}}
/>
