<script lang="ts">
	import Shortcut from './Shortcut.svelte';
	import { tutorialShortcuts } from '$lib/models/panelHelp';
	export let text: string;
	$: parts = text.split(/(\{[a-zA-Z]+\})/g);
</script>

{#each parts as part}
	{@const keys = part.startsWith('{') ? tutorialShortcuts[part.slice(1, -1)] : null}
	{#if keys}<Shortcut {keys} inline />{:else}{part}{/if}
{/each}
