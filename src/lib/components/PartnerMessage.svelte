<script lang="ts">
	import ArgumentLink from './ArgumentLink.svelte';
	import type { BoxId } from '$lib/models/node';
	export let text: string;
	export let argumentId: BoxId | undefined = undefined;
	$: parts = text
		.split(/(\[\[argument:[^\]]+\]\])/g)
		.map((part) => ({
			text: part,
			id: part.startsWith('[[argument:') ? (part.slice(11, -2) as BoxId) : null
		}));
</script>

{#each parts as part}{#if part.id}<ArgumentLink id={part.id} />{:else}{part.text}{/if}{/each}
{#if argumentId && !text.includes('[[argument:')}<ArgumentLink id={argumentId} />{/if}
