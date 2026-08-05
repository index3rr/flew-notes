<script lang="ts">
	import { settings } from '$lib/models/settings';
	import { onDestroy } from 'svelte';
	import TabsPanel from './panels/TabsPanel.svelte';
	import TimersPanel from './panels/TimersPanel.svelte';
	import NotesPanel from './panels/NotesPanel.svelte';
	import type { FlowId } from '$lib/models/node';

	export let side: 'left' | 'right';

	const panelIds = ['tabsPanel', 'timersPanel', 'notesPanel'] as const;
	type PanelId = (typeof panelIds)[number];

	interface PanelConfig {
		id: PanelId;
		name: string;
	}

	const allPanels: PanelConfig[] = [
		{ id: 'tabsPanel', name: 'Tabs' },
		{ id: 'timersPanel', name: 'Timers' },
		{ id: 'notesPanel', name: 'Notes' }
	];

	let panelValues: Record<PanelId, number> = {
		tabsPanel: settings.data['tabsPanel'].value as number,
		timersPanel: settings.data['timersPanel'].value as number,
		notesPanel: settings.data['notesPanel'].value as number
	};

	onDestroy(
		settings.subscribe([...panelIds], (key: string) => {
			panelValues = {
				...panelValues,
				[key as PanelId]: settings.data[key].value as number
			};
		})
	);

	$: activePanels = allPanels
		.filter((p) => {
			const pos = panelValues[p.id];
			return (side === 'left' && pos === 1) || (side === 'right' && pos === 2);
		})
		.sort((a, b) => {
			const orderA = panelIds.indexOf(a.id);
			const orderB = panelIds.indexOf(b.id);
			return orderA - orderB;
		});

	export let selectedFlowId: FlowId | null = null;
	export let clickTab: (id: FlowId) => void = () => {};
	export let addFlow: (style: any) => void = () => {};
	export let handleSort: (e: { detail: { from: number; to: number } }) => void = () => {};
	export let switchSpeakers: boolean = false;
</script>

{#if activePanels.length > 0}
	<div class="panel-container" class:customScrollbar={settings.data.customScrollbar.value}>
		{#each activePanels as panel, i}
			{#if i > 0}
				<div class="divider" />
			{/if}
			<div class="panel" class:auto-size={panel.id === 'timersPanel'}>
				{#if panel.id === 'tabsPanel'}
					<TabsPanel {selectedFlowId} {clickTab} {addFlow} {handleSort} bind:switchSpeakers />
				{:else if panel.id === 'timersPanel'}
					<TimersPanel />
				{:else if panel.id === 'notesPanel'}
					<NotesPanel />
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.panel-container {
		background: var(--background);
		width: 100%;
		border-radius: var(--border-radius);
		padding: var(--padding);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}
	.panel {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.panel.auto-size {
		flex: 0 0 auto;
		min-height: auto;
		overflow: visible;
	}
	.divider {
		height: 0;
		flex-shrink: 0;
		padding: var(--padding) 0;
	}
	.divider::after {
		content: '';
		display: block;
		height: 1px;
		background: var(--color-fade);
	}
</style>
