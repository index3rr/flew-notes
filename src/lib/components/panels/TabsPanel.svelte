<script lang="ts">
	import { selectItems } from '$lib/models/multiSelect';
	import { deleteFlows } from '$lib/models/nodeDecorateAction';
	import { focusId } from '$lib/models/focus';
	import PanelHeader from './PanelHeader.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import AddTab from '$lib/components/AddTab.svelte';
	import Tab from '$lib/components/Tab.svelte';
	import { nodes } from '$lib/models/store';
	import { documentOpen } from '$lib/models/autoSave';
	import { frozen } from '$lib/models/store';
	import { settings } from '$lib/models/settings';
	import type { FlowId } from '$lib/models/node';

	export let selectedFlowId: FlowId | null = null;
	export let clickTab: (id: FlowId) => void = () => undefined;
	export let addFlow: (style: any) => void = () => undefined;
	export let handleSort: (e: { detail: { from: number; to: number } }) => void = () => undefined;
	export let switchSpeakers = false;

	let selectedPages = new Set<FlowId>();
	let anchor: FlowId | null = null;
	let lastPage: FlowId | null = null;
	$: if (selectedFlowId !== lastPage) {
		lastPage = selectedFlowId;
		selectedPages = new Set(selectedFlowId ? [selectedFlowId] : []);
		anchor = selectedFlowId;
	}
	$: {
		const valid = [...selectedPages].filter((id) => $nodes[id]);
		if (valid.length !== selectedPages.size) selectedPages = new Set(valid);
	}
	function select(id: FlowId, event: MouseEvent) {
		const next = selectItems($nodes.root.children, selectedPages, id, anchor, event);
		selectedPages = next.selected;
		anchor = next.anchor;
		if (!event.shiftKey && !event.ctrlKey && !event.metaKey) clickTab(id);
	}
	function removePages() {
		if ($frozen || !selectedPages.size) return;
		const ids = [...selectedPages];
		if (ids.length > 1 && !confirm(`Delete ${ids.length} flow pages?`)) return;
		deleteFlows(ids);
		selectedPages = new Set();
		$focusId = null;
	}
	let element: HTMLDivElement;
	function keydown(event: KeyboardEvent) {
		if (!(event.target instanceof Node) || !element?.contains(event.target)) return;
		if (
			(event.key === 'Delete' || event.key === 'Backspace') &&
			!(event.target instanceof HTMLInputElement) &&
			!(event.target instanceof HTMLTextAreaElement)
		) {
			event.preventDefault();
			event.stopPropagation();
			removePages();
		}
	}
</script>

<svelte:window on:keydown={keydown} />
<div
	bind:this={element}
	role="region"
	aria-label="Flow pages"
	class="tabs"
	class:customScrollbar={settings.data.customScrollbar.value}
>
	<PanelHeader
		name="Tabs"
		actions={[
			{
				label: 'Select all pages',
				run: () => {
					selectedPages = new Set($nodes.root.children);
				}
			},
			{ label: 'Delete selected pages', disabled: $frozen || !selectedPages.size, run: removePages }
		]}
	/>
	<div class="tabScroll">
		<SortableList list={$nodes.root.children} on:sort={handleSort} let:item>
			<Tab
				on:click={(event) => select(item, event)}
				flowId={item}
				selected={selectedPages.has(item)}
			/>
		</SortableList>
		<AddTab disabled={!$documentOpen || $frozen} {addFlow} bind:switchSpeakers />
	</div>
</div>

<style>
	.tabs {
		overflow-y: auto;
		height: 100%;
		box-sizing: border-box;
		position: relative;
	}
	.tabScroll {
		padding: 0;
		margin: 0;
		padding-top: 0;
		padding-bottom: calc(var(--view-height) * 0.6);
	}
</style>
