<script lang="ts">
	import PanelPlaceholder from './PanelPlaceholder.svelte';
	export let available = true;
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

	function flowPalette(id: FlowId) {
		const flow = $nodes[id];
		return flow?.value.tag === 'flow' && flow.value.invert ? 'accent-secondary' : 'accent';
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

<section class="starred-panel">
	{#if !available}
		<PanelPlaceholder name="Starred arguments" />
	{:else if starred.length === 0}
		<div class="empty">Starred arguments</div>
	{:else}
		<div class="list">
			{#each starred as { id, node } (id)}
				<article class={`palette-${flowPalette(node.value.flowId)}`}>
					<div class="argument">
						<button class="content" on:click={() => goToBox(id, node.value.flowId)}>
							{node.value.content || '(empty argument)'}
						</button>
						<Button
							icon="star"
							palette={flowPalette(node.value.flowId)}
							toggled={true}
							disabled={$frozen}
							disabledReason="Wait for synchronization"
							tooltip="unstar argument"
							onclick={() => toggleBoxFormat(id, 'starred')}
						/>
					</div>
					<textarea
						value={node.value.starNote ?? ''}
						placeholder="add note"
						aria-label="Note for starred argument"
						readonly={$frozen}
						on:input={(event) => editNote(id, event.currentTarget.value)}
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
	}
	.empty {
		padding: var(--padding);
		color: var(--text-weak);
		font-size: 0.8rem;
	}
	.list {
		display: flex;
		flex-direction: column;
	}
	.argument {
		display: flex;
		align-items: flex-start;
		width: 100%;
	}
	.content {
		flex: 1;
		min-width: 0;
		padding: var(--padding);
		border: none;
		border-radius: var(--border-radius);
		background: none;
		color: var(--this-text);
		font: inherit;
		text-align: left;
		white-space: pre-wrap;
		transition: background var(--transition-speed);
		cursor: pointer;
	}
	.content:hover {
		background: var(--this-background-indent);
	}
	.content:active {
		background: var(--this-background-active);
		transition: none;
	}
	article :global(button.top) {
		flex-shrink: 0;
	}
	textarea {
		display: block;
		box-sizing: border-box;
		width: 100%;
		min-height: calc(2em + var(--padding) * 2);
		line-height: 1.5em;
		padding: var(--padding);
		resize: none;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		font-size: 0.9rem;
		outline: none;
	}
	textarea::placeholder {
		color: var(--text-weak);
	}
</style>
