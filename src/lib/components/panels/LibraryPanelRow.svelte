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
	let selectedPages: number[] = [];
	let anchor = 0;
	let expandedPages: number[] = [];
	$: pagePreviews = source
		? source.root.children.map((id) =>
				source![id]!.children.map((child) => source![child]!.value.content)
		  )
		: [];
	function selectPage({ detail }: CustomEvent<{ index: number; event: MouseEvent }>) {
		const { index, event } = detail;
		if (event.shiftKey)
			selectedPages = Array.from(
				{ length: Math.abs(index - anchor) + 1 },
				(_, i) => Math.min(index, anchor) + i
			);
		else if (event.ctrlKey || event.metaKey) {
			selectedPages = selectedPages.includes(index)
				? selectedPages.filter((i) => i !== index)
				: [...selectedPages, index];
			anchor = index;
		} else {
			selectedPages = [index];
			anchor = index;
			expandedPages = expandedPages.includes(index)
				? expandedPages.filter((i) => i !== index)
				: [...expandedPages, index];
		}
	}
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
			for (const i of selectedPages.includes(index)
				? [...selectedPages].sort((a, b) => a - b)
				: [index]) {
				const id = loaded.root.children[i];
				if (id) importFlowPage(loaded, id);
			}
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
			JSON.stringify({
				nodes: source,
				ids: (selectedPages.includes(detail.index) ? selectedPages : [detail.index])
					.sort((a, b) => a - b)
					.map((index) => source!.root.children[index])
			})
		);
	}
</script>

<FlowCard
	{flowData}
	{alternate}
	compact
	{selectedPages}
	{expandedPages}
	{pagePreviews}
	on:selectPage={selectPage}
	disabled={busy || $frozen || !$documentOpen}
	draggable={!!source}
	on:importPage={(event) => copyPage(event.detail)}
	on:dragPage={dragPage}
/>
{#if error}<PanelStatus error>{error}</PanelStatus>{/if}
