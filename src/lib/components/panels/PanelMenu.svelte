<script lang="ts">
	import { onMount } from 'svelte';
	import PanelRow from './PanelRow.svelte';
	export let actions: { label: string; run: () => void | Promise<void>; disabled?: boolean }[] = [];
	let menu: HTMLDivElement;
	onMount(() => menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
	function keydown(event: KeyboardEvent) {
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
				? buttons.length - 1
				: (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
		buttons[next]?.focus();
	}
	export let closePopup: () => void = () => undefined;
</script>

<div class="menu palette-plain" role="menu" bind:this={menu} on:keydown={keydown} tabindex="-1">
	{#each actions as action}<PanelRow
			menuItem
			disabled={action.disabled}
			on:click={() => {
				closePopup();
				void action.run();
			}}>{action.label}</PanelRow
		>{/each}
</div>

<style>
	.menu {
		width: min(calc(100vw - var(--padding-big)), 22em);
		padding-top: calc(var(--button-size) + var(--padding) * 2);
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
</style>
