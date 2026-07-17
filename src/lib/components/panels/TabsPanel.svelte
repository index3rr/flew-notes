<script lang="ts">
	import SortableList from '$lib/components/SortableList.svelte';
	import AddTab from '$lib/components/AddTab.svelte';
	import Tab from '$lib/components/Tab.svelte';
	import { nodes } from '$lib/models/store';
	import { settings } from '$lib/models/settings';
	import type { FlowId } from '$lib/models/node';

	export let selectedFlowId: FlowId | null = null;
	export let clickTab: (id: FlowId) => void = () => {};
	export let addFlow: (style: any) => void = () => {};
	export let handleSort: (e: { detail: { from: number; to: number } }) => void = () => {};
	export let switchSpeakers: boolean = false;
</script>

<div class="tabs" class:customScrollbar={settings.data.customScrollbar.value}>
	<div class="tabScroll">
		<SortableList list={$nodes.root.children} on:sort={handleSort} let:index>
			<Tab
				on:click={() => clickTab($nodes.root.children[index])}
				flowId={$nodes.root.children[index]}
				selected={selectedFlowId == $nodes.root.children[index]}
			/>
		</SortableList>
		<AddTab {addFlow} bind:switchSpeakers />
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
