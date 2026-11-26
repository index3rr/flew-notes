<script lang="ts">
	import Tooltip from '../Tooltip.svelte';
	import Button from '../Button.svelte';
	import Settings from '../Settings.svelte';
	import PanelMenu from './PanelMenu.svelte';
	import { panelIds, panelNames, type PanelId } from '$lib/models/panels';
	import { panelHelp } from '$lib/models/panelHelp';
	import type { PanelMenuAction } from '$lib/models/panelMenus';
	import { settings } from '$lib/models/settings';
	import { openPopup } from '$lib/models/popup';
	import { startPanelTutorial } from '$lib/models/tutorial';
	import { onDestroy } from 'svelte';
	export let name: string;
	export let detail: string | null = null;
	export let tooltip: string | null = null;
	export let actions: PanelMenuAction[] | (() => PanelMenuAction[]) = [];
	$: panel = panelIds.find((id) => panelNames[id] === name) as PanelId | undefined;
	function visibleNames() {
		return Object.fromEntries(
			panelIds.map((id) => [id, settings.data[id + 'ShowName'].value !== false])
		);
	}
	let names = visibleNames();
	onDestroy(
		settings.subscribe(
			panelIds.map((id) => id + 'ShowName'),
			() => (names = visibleNames())
		)
	);
	$: showName = panel ? names[panel] : true;
	function setPanelSetting(key: string, value: boolean | number) {
		settings.setValue(key, value);
		settings.saveToLocalStorage();
	}

	function menu() {
		if (!panel) return;
		const id = panel;
		openPopup(PanelMenu, name, {
			panel: id,
			actions,
			commonActions: () => [
				{ label: 'How to use ' + name, run: () => startPanelTutorial(id) },
				{ label: 'Settings', run: () => openPopup(Settings, 'Settings', { initialGroup: name }) },
				{
					label: settings.data[id + 'ShowName'].value ? 'Hide panel name' : 'Show panel name',
					keepOpen: true,
					run: () => setPanelSetting(id + 'ShowName', !settings.data[id + 'ShowName'].value)
				}
			]
		});
	}
</script>

<header class="panel-header" class:without-name={!showName}>
	{#if showName}<Tooltip content={tooltip ?? (panel ? panelHelp[panel].summary : null)}>
			<h2 class="name">
				{name}{#if detail}<span class="detail">{detail}</span>{/if}
			</h2>
		</Tooltip>{/if}
	<div class="actions">
		<slot />{#if panel}<Button
				icon="dots"
				ariaLabel={`${name} menu`}
				tooltip={`${name.toLowerCase()} menu`}
				on:click={menu}
			/>{/if}
	</div>
</header>

<style>
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: calc(var(--button-size) + var(--padding) * 2);
		flex-shrink: 0;
		min-width: 0;
	}
	.without-name {
		position: absolute;
		inset-block-start: 0;
		inset-inline-end: 0;
		z-index: 1;
	}
	/* Only the first content row makes room for the menu. The rest stays full width. */
	:global(.panel-body > :has(> .panel-header.without-name)) {
		position: relative;
		min-height: calc(var(--button-size) + var(--padding) * 2);
	}
	:global(.panel-header.without-name ~ .panel-leading),
	:global(.panel-header.without-name ~ .panel-status:first-of-type),
	:global(.panel-header.without-name ~ .tabScroll li:first-child),
	:global(.panel-header.without-name ~ .tabScroll > .addTab:first-child),
	:global(.panel-header.without-name ~ .blocks > :first-child > .panel-row:first-child),
	:global(.panel-header.without-name ~ .blocks > .panel-status:first-child),
	:global(.panel-header.without-name ~ .list > article:first-child > .panel-row:first-child),
	:global(.panel-header.without-name ~ .list > .flow:first-child .flow-heading),
	:global(.panel-header.without-name ~ .list > .panel-status:first-child),
	:global(.panel-header.without-name + .pages > .panel-status:first-child),
	:global(.panel-header.without-name ~ .top > .timer > :first-child),
	:global(.panel-header.without-name ~ .send-targets > :first-child),
	:global(.panel-header.without-name ~ .steps > :first-child) {
		margin-inline-end: calc(var(--button-size) + var(--padding) * 3);
		width: auto;
		min-height: calc(var(--button-size) + var(--padding) * 2);
	}
	:global(.panel-header.without-name ~ .document .panel-field) {
		padding-inline-end: calc(var(--button-size) + var(--padding) * 3);
	}
	:global(.panel-placeholder > .panel-header.without-name) {
		position: static;
		justify-content: flex-end;
	}
	.panel-header > :global(:first-child) {
		min-width: 0;
		flex: 1;
	}
	.name {
		margin: 0;
		padding: 0 var(--padding);
		font-size: 1em;
		font-weight: var(--font-weight);
		color: var(--text-weak);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.detail {
		padding-left: var(--padding);
		font-size: 0.85em;
	}
	.panel-header > .actions {
		flex: 0 0 auto;
	}
	.actions {
		display: flex;
		flex-shrink: 0;
	}
	.actions:empty {
		display: none;
	}
</style>
