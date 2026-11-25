<script lang="ts">
	import { fileMime, boxesMime, pagesMime } from '$lib/models/panelDrag';
	import { settings } from '$lib/models/settings';
	import { afterUpdate, beforeUpdate, onDestroy, onMount } from 'svelte';
	import AutoflowPanel from './panels/AutoflowPanel.svelte';
	import TabsPanel from './panels/TabsPanel.svelte';
	import TimersPanel from './panels/TimersPanel.svelte';
	import NotesPanel from './panels/NotesPanel.svelte';
	import StarredPanel from './panels/StarredPanel.svelte';
	import SpeechDropPanel from './panels/SpeechDropPanel.svelte';
	import LibraryPanel from './panels/LibraryPanel.svelte';
	import TranscriptPanel from './panels/TranscriptPanel.svelte';
	import CollaborationPanel from './panels/CollaborationPanel.svelte';
	import CoveragePanel from './panels/CoveragePanel.svelte';
	import CardMirrorPanel from './panels/CardMirrorPanel.svelte';
	import PanelPlaceholder from './panels/PanelPlaceholder.svelte';
	import Button from './Button.svelte';
	import { connections } from '$lib/models/store';
	import { documentOpen } from '$lib/models/document';
	import type { FlowId } from '$lib/models/node';
	import {
		panelIds,
		panelNames,
		panelIcons,
		documentPanelIds,
		panelSide,
		type PanelId
	} from '$lib/models/panels';
	import { panelIn, panelResize } from '$lib/models/transition';

	export let side: 'left' | 'right';
	export let selectedFlowId: FlowId | null = null;
	export let clickTab: (id: FlowId) => void = () => undefined;
	export let addFlow: (style: any) => void = () => undefined;
	export let handleSort: (e: { detail: { from: number; to: number } }) => void = () => undefined;
	export let switchSpeakers = false;

	let expanded: PanelId | null = null;
	let panelValues = Object.fromEntries(
		panelIds.map((id) => [id, settings.data[id].value])
	) as Record<PanelId, number>;

	onDestroy(
		settings.subscribe([...panelIds], (key: string) => {
			panelValues = { ...panelValues, [key as PanelId]: settings.data[key].value as number };
		})
	);

	$: documentPanelsAvailable = $documentOpen;
	$: activePanels = panelIds.filter((id) => panelSide(panelValues[id]) === side);
	$: collapsedPanels = activePanels.filter((id) => panelValues[id] >= 3);
	$: if (expanded && !collapsedPanels.includes(expanded)) expanded = null;
	$: visiblePanelIds = activePanels.filter((id) => panelValues[id] < 3 || expanded === id);

	let dragPrevious: PanelId | null = null;
	let dragOpened = false;
	let droppedInPanel = false;
	onMount(() => {
		const drop = (event: DragEvent) => {
			droppedInPanel =
				event.target instanceof Element &&
				!!event.target.closest('.panel-body [data-drop-state="ready"], .panel-body .tabs');
		};
		const end = () => {
			if (dragOpened && !droppedInPanel) expanded = dragPrevious;
			dragOpened = false;
			droppedInPanel = false;
		};
		window.addEventListener('drop', drop, true);
		window.addEventListener('dragend', end);
		return () => {
			window.removeEventListener('drop', drop, true);
			window.removeEventListener('dragend', end);
		};
	});
	function expandForDrop(event: DragEvent, id: PanelId) {
		const transfer = event.dataTransfer;
		if (
			!transfer ||
			![fileMime, boxesMime, pagesMime, 'Files'].some((type) => transfer.types.includes(type))
		)
			return;
		event.preventDefault();
		event.stopPropagation();
		if (!dragOpened) {
			dragPrevious = expanded;
			dragOpened = true;
			droppedInPanel = false;
		}
		expanded = id;
	}

	function unavailable(id: PanelId, available: boolean) {
		return !available && documentPanelIds.includes(id);
	}
	function autoSize(id: PanelId, available: boolean, sharing: boolean) {
		if (unavailable(id, available)) return true;
		if (id === 'collaborationPanel') return !sharing;
		return (
			id === 'timersPanel' ||
			id === 'starredPanel' ||
			id === 'speechDropPanel' ||
			id === 'cardMirrorPanel'
		);
	}

	// Bodies that replace a placeholder stagger in by their position on this side.
	function stagger(id: PanelId) {
		return visiblePanelIds.indexOf(id) * ((settings.data.transitionSpeed.value as number) / 6);
	}

	// When panels appear, collapse, or fill in, measure the old layout and animate each card to its new size.
	const elements: Partial<Record<PanelId, HTMLElement>> = {};
	$: layoutKey = `${visiblePanelIds.join()}|${documentPanelsAvailable}|${$connections.tag}`;
	let lastLayoutKey: string | null = null;
	let before: Map<PanelId, number> | null = null;
	beforeUpdate(() => {
		if (layoutKey === lastLayoutKey) return;
		const initial = lastLayoutKey === null;
		lastLayoutKey = layoutKey;
		if (initial) return;
		before = new Map(
			activePanels.map((id) => [id, elements[id]?.getBoundingClientRect().height ?? 0])
		);
	});
	afterUpdate(() => {
		if (!before) return;
		for (const id of visiblePanelIds) {
			const element = elements[id];
			if (element)
				panelResize(element, before.get(id) ?? 0, element.getBoundingClientRect().height);
		}
		before = null;
	});
</script>

{#if activePanels.length > 0}
	<div class="panel-container" class:customScrollbar={settings.data.customScrollbar.value}>
		{#each activePanels as id (id)}
			<div
				class="panel"
				data-panel={id}
				bind:this={elements[id]}
				class:collapsed={!visiblePanelIds.includes(id)}
				class:auto-size={autoSize(id, documentPanelsAvailable, $connections.tag !== 'empty')}
			>
				{#if unavailable(id, documentPanelsAvailable)}
					<PanelPlaceholder name={panelNames[id]} />
				{:else}
					<div class="panel-body" in:panelIn={{ delay: stagger(id) }}>
						{#if id === 'autoflowPanel'}
							<AutoflowPanel />
						{:else if id === 'cardMirrorPanel'}
							<CardMirrorPanel />
						{:else if id === 'libraryPanel'}
							<LibraryPanel />
						{:else if id === 'transcriptPanel'}
							<TranscriptPanel />
						{:else if id === 'collaborationPanel'}
							<CollaborationPanel />
						{:else if id === 'coveragePanel'}
							<CoveragePanel {selectedFlowId} {clickTab} />
						{:else if id === 'tabsPanel'}
							<TabsPanel {selectedFlowId} {clickTab} {addFlow} {handleSort} bind:switchSpeakers />
						{:else if id === 'timersPanel'}
							<TimersPanel />
						{:else if id === 'notesPanel'}
							<NotesPanel />
						{:else if id === 'starredPanel'}
							<StarredPanel {selectedFlowId} {clickTab} />
						{:else if id === 'speechDropPanel'}
							<SpeechDropPanel />
						{/if}
					</div>
				{/if}
			</div>
		{/each}
		{#if collapsedPanels.length > 0}
			<div class="panel auto-size collapsed-buttons">
				{#each collapsedPanels as id (id)}
					<div
						class="collapsed-target"
						role="presentation"
						on:dragenter={(event) => expandForDrop(event, id)}
						on:dragover={(event) => expandForDrop(event, id)}
					>
						<Button
							icon={panelIcons[id]}
							toggled={expanded === id}
							tooltip={panelNames[id]}
							ariaLabel={panelNames[id]}
							on:click={() => (expanded = expanded === id ? null : id)}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.panel-container {
		width: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}
	/* Each panel is its own surface, like the title bar and flow beside it. */
	.panel {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-sizing: border-box;
		padding: var(--padding);
		background: var(--background);
		border-radius: var(--border-radius);
	}
	.panel.auto-size {
		flex: 0 0 auto;
	}
	.panel.collapsed {
		display: none;
	}
	.panel-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	.collapsed-target {
		display: flex;
	}
	.collapsed-buttons {
		flex-direction: row;
		flex-wrap: wrap;
		margin-top: auto;
	}
</style>
