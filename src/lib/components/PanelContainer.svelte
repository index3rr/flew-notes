<script lang="ts">
	import { settings } from '$lib/models/settings';
	import { onDestroy } from 'svelte';
	import TabsPanel from './panels/TabsPanel.svelte';
	import TimersPanel from './panels/TimersPanel.svelte';
	import NotesPanel from './panels/NotesPanel.svelte';
	import StarredPanel from './panels/StarredPanel.svelte';
	import SpeechDropPanel from './panels/SpeechDropPanel.svelte';
	import LibraryPanel from './panels/LibraryPanel.svelte';
	import TranscriptPanel from './panels/TranscriptPanel.svelte';
	import CollaborationPanel from './panels/CollaborationPanel.svelte';
	import Button from './Button.svelte';
	import { nodes, connections } from '$lib/models/store';
	import type { FlowId } from '$lib/models/node';

	export let side: 'left' | 'right';

	const panelIds = [
		'tabsPanel',
		'notesPanel',
		'starredPanel',
		'speechDropPanel',
		'timersPanel',
		'libraryPanel',
		'transcriptPanel',
		'collaborationPanel'
	] as const;
	type PanelId = (typeof panelIds)[number];
	const documentPanelIds: readonly PanelId[] = [
		'libraryPanel',
		'notesPanel',
		'starredPanel',
		'collaborationPanel'
	];

	const panelIcons: Record<PanelId, string> = {
		tabsPanel: 'dots',
		notesPanel: 'file',
		starredPanel: 'star',
		speechDropPanel: 'download',
		timersPanel: 'clock',
		libraryPanel: 'folder',
		transcriptPanel: 'keyboard',
		collaborationPanel: 'people'
	};
	interface PanelConfig {
		id: PanelId;
		name: string;
	}

	const allPanels: PanelConfig[] = [
		{ id: 'tabsPanel', name: 'Tabs' },
		{ id: 'notesPanel', name: 'Notes' },
		{ id: 'starredPanel', name: 'Starred arguments' },
		{ id: 'speechDropPanel', name: 'SpeechDrop' },
		{ id: 'timersPanel', name: 'Timers' },
		{ id: 'libraryPanel', name: 'Flow library' },
		{ id: 'transcriptPanel', name: 'Transcript' },
		{ id: 'collaborationPanel', name: 'Collaboration' }
	];

	let expanded: PanelId | null = null;
	let panelValues = Object.fromEntries(
		panelIds.map((id) => [id, settings.data[id].value])
	) as Record<PanelId, number>;

	onDestroy(
		settings.subscribe([...panelIds], (key: string) => {
			panelValues = {
				...panelValues,
				[key as PanelId]: settings.data[key].value as number
			};
		})
	);

	$: documentPanelsAvailable = $nodes.root.children.length > 0;

	$: activePanels = allPanels
		.filter((p) => {
			const pos = panelValues[p.id];
			return side === 'left' ? pos === 1 || pos === 3 : pos === 2 || pos === 4;
		})
		.sort((a, b) => {
			const orderA = panelIds.indexOf(a.id);
			const orderB = panelIds.indexOf(b.id);
			return orderA - orderB;
		});

	$: visiblePanelIds = activePanels
		.filter((panel) => panelValues[panel.id] < 3 || expanded === panel.id)
		.map((panel) => panel.id);

	export let selectedFlowId: FlowId | null = null;
	export let clickTab: (id: FlowId) => void = () => {};
	export let addFlow: (style: any) => void = () => {};
	export let handleSort: (e: { detail: { from: number; to: number } }) => void = () => {};
	export let switchSpeakers: boolean = false;
</script>

{#if activePanels.length > 0}
	<div class="panel-container" class:customScrollbar={settings.data.customScrollbar.value}>
		{#each activePanels as panel}
			{#if visiblePanelIds.indexOf(panel.id) > 0}
				<div class="divider" />
			{/if}
			<div
				class="panel"
				data-panel={panel.id}
				class:collapsed={panelValues[panel.id] >= 3 && expanded !== panel.id}
				class:auto-size={panel.id === 'timersPanel' ||
					panel.id === 'starredPanel' ||
					panel.id === 'speechDropPanel' ||
					(panel.id === 'collaborationPanel' && $connections.tag === 'empty') ||
					(!documentPanelsAvailable && documentPanelIds.includes(panel.id))}
			>
				{#if panel.id === 'libraryPanel'}
					<LibraryPanel available={documentPanelsAvailable} />
				{:else if panel.id === 'transcriptPanel'}
					<TranscriptPanel />
				{:else if panel.id === 'collaborationPanel'}
					<CollaborationPanel available={documentPanelsAvailable} />
				{:else if panel.id === 'tabsPanel'}
					<TabsPanel {selectedFlowId} {clickTab} {addFlow} {handleSort} bind:switchSpeakers />
				{:else if panel.id === 'timersPanel'}
					<TimersPanel />
				{:else if panel.id === 'notesPanel'}
					<NotesPanel editable={documentPanelsAvailable} />
				{:else if panel.id === 'starredPanel'}
					<StarredPanel available={documentPanelsAvailable} {selectedFlowId} {clickTab} />
				{:else if panel.id === 'speechDropPanel'}
					<SpeechDropPanel />
				{/if}
			</div>
		{/each}
		<div class="collapsed-buttons">
			{#each activePanels.filter((panel) => panelValues[panel.id] >= 3) as panel}
				<Button
					icon={panelIcons[panel.id]}
					toggled={expanded === panel.id}
					tooltip={panel.name}
					ariaLabel={panel.name}
					on:click={() => (expanded = expanded === panel.id ? null : panel.id)}
				/>
			{/each}
		</div>
	</div>
{/if}

<style>
	.panel.collapsed {
		display: none;
	}
	.collapsed-buttons {
		display: flex;
		flex-wrap: wrap;
		flex-shrink: 0;
		margin-top: auto;
	}
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
