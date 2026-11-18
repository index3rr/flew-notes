<script lang="ts">
	import FlowCard from '../FlowCard.svelte';
	import PanelStatus from './PanelStatus.svelte';
	import type { SavedNodesData } from '$lib/models/autoSave';
	import { documentOpen } from '$lib/models/autoSave';
	import { frozen } from '$lib/models/store';
	import { loadNodes } from '$lib/models/file';
	import { importFlowPage } from '$lib/models/nodeDecorateAction';
	import type { Nodes } from '$lib/models/node';
	import { onDestroy } from 'svelte';
	export let flowData: SavedNodesData;
	export let read: () => Promise<string>;
	export let alternate = false;
	let source: Nodes | undefined;
	let error = '';
	let busy = false;
	let request = 0;
	async function preload() {
		const token = ++request;
		try {
			const loaded = loadNodes(JSON.parse(await read()), false);
			if (token === request) source = loaded;
		} catch {
			/* Clicking a page retries the read and reports an error. */
		}
	}
	$: flowData.modified, void preload();
	onDestroy(() => {
		request++;
	});
	async function copyPage(index: number) {
		if (busy || $frozen || !$documentOpen) return;
		busy = true;
		error = '';
		try {
			const loaded = loadNodes(JSON.parse(await read()), false);
			if ($frozen || !$documentOpen) return;
			const id = loaded.root.children[index];
			if (id) importFlowPage(loaded, id);
		} catch (cause) {
			error = (cause as Error).message;
		} finally {
			busy = false;
		}
	}
	function dragPage({ detail }: CustomEvent<{ index: number; event: DragEvent }>) {
		if (!source || busy || $frozen || !$documentOpen) {
			detail.event.preventDefault();
			return;
		}
		detail.event.dataTransfer?.setData(
			'application/x-flew-page',
			JSON.stringify({ nodes: source, id: source.root.children[detail.index] })
		);
	}
</script>

<FlowCard
	{flowData}
	{alternate}
	compact
	disabled={busy || $frozen || !$documentOpen}
	draggable={!!source}
	on:importPage={(event) => copyPage(event.detail)}
	on:dragPage={dragPage}
/>
{#if error}<PanelStatus error>{error}</PanelStatus>{/if}
