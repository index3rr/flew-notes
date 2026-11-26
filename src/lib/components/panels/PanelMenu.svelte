<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PanelRow from './PanelRow.svelte';
	import Button from '../Button.svelte';
	import Message from '../Message.svelte';
	import { openPopup } from '$lib/models/popup';
	import { settings } from '$lib/models/settings';
	import type { PanelId } from '$lib/models/panels';
	import type { PanelMenuAction } from '$lib/models/panelMenus';
	type Actions = PanelMenuAction[] | (() => PanelMenuAction[]);
	export let actions: Actions = [];
	export let commonActions: Actions = [];
	export let panel: PanelId | null = null;
	export let closePopup: () => void = () => undefined;
	let menu: HTMLDivElement;
	let specific: PanelMenuAction[] = [];
	let common: PanelMenuAction[] = [];
	let position = 0;
	let customScrollbar = false;
	onDestroy(
		settings.subscribe(['any'], () => {
			specific = read(actions);
			common = read(commonActions);
			position = panel ? Number(settings.data[panel].value) : 0;
			customScrollbar = Boolean(settings.data.customScrollbar.value);
		})
	);
	function read(value: Actions) {
		return typeof value === 'function' ? value() : value;
	}
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
	async function run(action: PanelMenuAction) {
		if (!action.keepOpen) closePopup();
		try {
			await action.run();
		} catch (cause) {
			if (action.keepOpen) closePopup();
			openPopup(Message, 'Could not complete action', {
				message: cause instanceof Error ? cause.message : 'Please try again.',
				error: true
			});
		}
	}
	function place(value: number) {
		if (!panel) return;
		settings.setValue(panel, value);
		settings.saveToLocalStorage();
	}
</script>

<div
	class="menu palette-plain"
	class:customScrollbar
	role="menu"
	bind:this={menu}
	on:keydown={keydown}
	tabindex="-1"
>
	{#if specific.length}<div class="action-group" role="group" aria-label="Panel actions">
			{#each specific as action}<PanelRow
					menuItem
					disabled={action.disabled}
					on:click={() => run(action)}>{action.label}</PanelRow
				>{/each}
		</div>{/if}
	{#if common.length}<div class="action-group common" role="group" aria-label="Panel options">
			{#each common as action}<PanelRow
					menuItem
					disabled={action.disabled}
					on:click={() => run(action)}>{action.label}</PanelRow
				>{/each}
		</div>{/if}
	{#if panel}<div class="placement" role="group" aria-label="Panel position">
			<Button
				icon="arrowLeft"
				ariaLabel="Move left"
				tooltip="move left"
				toggled={position === 1 || position === 3}
				on:click={() => place(position >= 3 ? 3 : 1)}
			/>
			<Button
				icon="arrowRight"
				ariaLabel="Move right"
				tooltip="move right"
				toggled={position === 2 || position === 4}
				on:click={() => place(position >= 3 ? 4 : 2)}
			/>
			<Button
				icon="foldArrows"
				ariaLabel={position >= 3 ? 'Expand' : 'Collapse'}
				tooltip={position >= 3 ? 'expand' : 'collapse'}
				toggled={position >= 3}
				disabled={position === 0}
				on:click={() => place(position >= 3 ? position - 2 : position + 2)}
			/>
			<Button
				icon="delete"
				ariaLabel="Hide panel"
				tooltip="hide panel"
				toggled={position === 0}
				on:click={() => place(0)}
			/>
		</div>{/if}
</div>

<style>
	.menu {
		width: min(calc(100vw - var(--padding-big)), 22em);
		max-height: calc(100vh - var(--padding-big));
		box-sizing: border-box;
		overflow-y: auto;
		padding-top: calc(var(--button-size) + var(--padding) * 2);
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
	.action-group {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.common,
	.placement {
		background: var(--background-secondary);
		border-radius: var(--border-radius-small);
		padding: var(--padding-small);
	}
	.placement {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		margin-top: auto;
	}
</style>
