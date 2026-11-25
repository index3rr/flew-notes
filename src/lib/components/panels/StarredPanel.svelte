<script lang="ts">
	import PanelHeader from './PanelHeader.svelte';
	import PanelRow from './PanelRow.svelte';
	import PanelStatus from './PanelStatus.svelte';
	import { nodes, pendingAction, frozen } from '$lib/models/store';
	import { type Box, type BoxId, type FlowId, type Node } from '$lib/models/node';
	import { newUpdateAction, toggleBoxFormat } from '$lib/models/nodeDecorateAction';
	import Button from '$lib/components/Button.svelte';
	import { resolvePendingAction, type PendingAction } from '$lib/models/nodePendingAction';
	import { showArgument } from '$lib/models/argumentNavigation';

	export let selectedFlowId: FlowId | null = null;
	export let clickTab: (id: FlowId) => void = () => undefined;

	$: starred = Object.entries($nodes)
		.flatMap(([id, node]) => {
			if (id === 'root' || !node || node.value.tag !== 'box' || !node.value.starred) {
				return [];
			}
			return [{ id: id as BoxId, node: node as Node<Box> }];
		})
		.sort((a, b) => {
			const flowOrder =
				$nodes.root.children.indexOf(a.node.value.flowId) -
				$nodes.root.children.indexOf(b.node.value.flowId);
			if (flowOrder !== 0) return flowOrder;
			return a.node.level - b.node.level;
		});

	function goToBox(id: BoxId, flowId: FlowId) {
		if (selectedFlowId !== flowId) clickTab(flowId);
		showArgument(id);
	}

	function flowPalette(id: FlowId, level: number) {
		const flow = $nodes[id];
		return ((level - 1) % 2 === 0) !== (flow?.value.tag === 'flow' && flow.value.invert)
			? 'accent'
			: 'accent-secondary';
	}

	function grow(element: HTMLTextAreaElement) {
		element.style.height = 'auto';
		element.style.height = `${element.scrollHeight}px`;
	}

	let editingNote: BoxId | null = null;
	let ownPending: PendingAction | null = null;
	function editNote(id: BoxId, value: string) {
		if ($frozen) return;
		const box = $nodes[id]?.value;
		if (!box || box.tag !== 'box') return;
		if ($pendingAction !== ownPending || editingNote !== id) resolvePendingAction($nodes);
		const next: PendingAction = {
			beforeFocusId: id,
			afterFocusId: id,
			ownerId: box.flowId,
			action: (nodes) => {
				const current = nodes[id]?.value;
				return current?.tag === 'box'
					? newUpdateAction(id, { ...current, starNote: value })
					: { tag: 'identity' };
			}
		};
		editingNote = id;
		ownPending = next;
		$pendingAction = next;
	}
</script>

<section class="starred-panel" aria-label="Starred arguments">
	<PanelHeader name="Starred arguments" detail={starred.length ? String(starred.length) : null} />
	{#if starred.length === 0}
		<PanelStatus>Star an argument to keep it here.</PanelStatus>
	{:else}
		<div class="list">
			{#each starred as { id, node } (id)}
				<article class={`palette-${flowPalette(node.value.flowId, node.level)}`}>
					<PanelRow
						palette={flowPalette(node.value.flowId, node.level)}
						weak={!node.value.content}
						on:click={() => goToBox(id, node.value.flowId)}
					>
						{node.value.content || 'empty argument'}
						<svelte:fragment slot="actions">
							<Button
								icon="star"
								palette={flowPalette(node.value.flowId, node.level)}
								toggled={true}
								disabled={$frozen}
								disabledReason="Wait for synchronization"
								tooltip="unstar"
								onclick={() => toggleBoxFormat(id, 'starred')}
							/>
						</svelte:fragment>
					</PanelRow>
					<textarea
						value={node.value.starNote ?? ''}
						placeholder="add note"
						aria-label="Note for starred argument"
						readonly={$frozen}
						rows="1"
						on:input={(event) => {
							editNote(id, event.currentTarget.value);
							grow(event.currentTarget);
						}}
						use:grow
					/>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.starred-panel {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	textarea {
		display: block;
		box-sizing: border-box;
		width: 100%;
		line-height: 1.5em;
		padding: 0 var(--padding) var(--padding);
		resize: none;
		overflow: hidden;
		border: none;
		background: none;
		color: var(--text-weak);
		font: inherit;
		font-size: 0.85em;
		outline: none;
	}
	textarea:focus {
		color: var(--text);
	}
	textarea::placeholder {
		color: var(--text-weak);
	}
</style>
