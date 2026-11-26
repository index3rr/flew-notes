<script lang="ts">
	import { trackFeatureUsed } from '$lib/models/telemetry';
	import { panelDrop } from '$lib/models/panelDrop';
	import { selectItems } from '$lib/models/multiSelect';
	import { onDestroy } from 'svelte';
	import PanelHeader from './PanelHeader.svelte';
	import PanelStatus from './PanelStatus.svelte';
	import PanelRow from './PanelRow.svelte';
	import Button from '../Button.svelte';
	import { readSpeechDoc, shortenTag, type DocBlock } from '$lib/models/speechDoc';
	import { droppedDocument, fileMime, pagesMime, readPageDrag } from '$lib/models/panelDrag';
	import { newFlowId, newBoxId, type Nodes } from '$lib/models/node';
	import { getDebateStyleFlow } from '$lib/models/debateStyle';
	import { importFlowPage } from '$lib/models/nodeDecorateAction';
	import { documentOpen } from '$lib/models/document';
	import { cardMirror, readCardMirrorHeadings } from '$lib/models/cardMirror';
	import { settings } from '$lib/models/settings';
	function panelActions() {
		return [
			{ label: 'Load DOCX', run: () => input.click() },
			...(settings.data.autoflowCardMirrorControls.value && $cardMirror.state === 'connected'
				? [
						{ label: 'Read CardMirror headings', run: () => headings(false) },
						{ label: 'Read speech document headings', run: () => headings(true) }
				  ]
				: [])
		];
	}

	let blocks: DocBlock[] = [];
	let name = '';
	let error = '';
	let busy = false;
	let selected = new Set<number>();
	let anchor = 0;
	let expanded = new Set<number>();
	let input: HTMLInputElement;
	let request = 0;
	let controller: AbortController | null = null;
	const begin = () => {
		controller?.abort();
		controller = new AbortController();
		return ++request;
	};
	onDestroy(() => {
		request++;
		controller?.abort();
	});
	async function load(nameValue: string, blob: Blob, token = begin()) {
		busy = true;
		error = '';
		try {
			const loaded = await readSpeechDoc(blob);
			if (token !== request) return;
			blocks = loaded;
			if (blocks.length) trackFeatureUsed('autoflow', 'completed');
			name = nameValue;
			selected = new Set();
			expanded = new Set();
			if (!blocks.length) error = 'No headings found in this document.';
		} catch (cause) {
			if (token === request) error = (cause as Error).message;
		} finally {
			if (token === request) busy = false;
		}
	}
	function citation(
		provenance: import('$lib/integrations/cardmirror/protocol').Provenance | null | undefined
	) {
		const node = provenance?.sources[0]?.evidence?.node;
		const plain = (node: import('$lib/integrations/cardmirror/protocol').CardNode): string =>
			node.text ?? (node.content ?? []).map(plain).join('');
		const cite = node?.content
			?.filter((child) => child.type === 'cite_paragraph')
			.map(plain)
			.join('\n');
		return cite ? '\n' + cite : '';
	}
	function source(indices: number[]) {
		const template = getDebateStyleFlow(
			/(?:^|[\s_-])(?:1nc|2nc|neg)(?:[\s_.-]|$)/i.test(name) ? 'secondary' : 'primary'
		);
		if (!template) throw new Error('Choose a debate style first.');
		const tree: Nodes = { root: { value: { tag: 'root' }, level: -1, parent: null, children: [] } };
		for (const index of indices) {
			const block = blocks[index],
				id = newFlowId();
			tree.root.children.push(id);
			tree[id] = {
				value: {
					tag: 'flow',
					content: block.title,
					invert: template.invert,
					columns: template.columns
				},
				level: 0,
				parent: 'root',
				children: []
			};
			for (const [tagIndex, tag] of block.tags.entries()) {
				const key = newBoxId();
				tree[id]!.children.push(key);
				tree[key] = {
					value: {
						tag: 'box',
						content:
							shortenTag(tag) +
							(settings.data.autoflowIncludeCites.value
								? citation(block.provenance?.[tagIndex])
								: ''),
						flowId: id,
						...(block.provenance?.[tagIndex]
							? { cardMirror: structuredClone(block.provenance[tagIndex]!) }
							: {})
					},
					parent: id,
					level: 1,
					children: []
				};
			}
		}
		return tree;
	}
	function select(index: number, event: MouseEvent) {
		const next = selectItems(
			blocks.map((_, i) => i),
			selected,
			index,
			anchor,
			event
		);
		selected = next.selected;
		anchor = next.anchor ?? index;
		if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
			expanded = new Set(expanded);
			if (expanded.has(index)) expanded.delete(index);
			else expanded.add(index);
		}
	}

	function drag(event: DragEvent, index: number) {
		const indices = selected.has(index) ? [...selected].sort((a, b) => a - b) : [index];
		const tree = source(indices);
		event.dataTransfer?.setData(
			'text/plain',
			indices.map((i) => blocks[i].text || blocks[i].tags.join('\n')).join('\n\n')
		);
		event.dataTransfer?.setData(
			pagesMime,
			JSON.stringify({ nodes: tree, ids: tree.root.children })
		);
	}
	async function headings(speech = false) {
		const token = begin();
		busy = true;
		error = '';
		try {
			const result = await readCardMirrorHeadings(speech);
			if (token !== request) return;
			blocks = result.blocks;
			name = result.name;
			selected = new Set();
			expanded = new Set();
		} catch (cause) {
			if (token === request) error = (cause as Error).message;
		} finally {
			if (token === request) busy = false;
		}
	}
	async function drop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		const token = begin();
		busy = true;
		error = '';
		try {
			const file = await droppedDocument(event, controller!.signal);
			if (token === request && file) await load(file.name, file.blob, token);
		} catch (cause) {
			if (token === request) error = (cause as Error).message;
		} finally {
			if (token === request) busy = false;
		}
	}
</script>

<section
	class="autoflow-panel"
	use:panelDrop={{ types: [fileMime, 'Files'] }}
	aria-label="Autoflow"
	on:dragover={(e) => {
		e.preventDefault();
		e.stopPropagation();
	}}
	on:drop={drop}
>
	<PanelHeader name="Autoflow" detail={name || null} actions={panelActions} />
	<input
		bind:this={input}
		type="file"
		accept=".docx"
		hidden
		on:change={() => {
			const file = input.files?.[0];
			if (file) void load(file.name, file);
			input.value = '';
		}}
	/>
	{#if error}<PanelStatus error>{error}</PanelStatus>{/if}
	<div class="blocks" class:customScrollbar={settings.data.customScrollbar.value}>
		{#each blocks as block, index}
			<div
				role="group"
				aria-label={block.title}
				draggable="true"
				on:dragstart={(event) => drag(event, index)}
			>
				<PanelRow
					draggable
					selected={selected.has(index)}
					on:click={(event) => select(index, event)}
					>{block.title}<span class="count"> · {block.tags.length}</span>
					<svelte:fragment slot="actions"
						><Button
							icon="add"
							tooltip="copy block to a new page"
							disabled={!$documentOpen}
							on:click={() => {
								const tree = source(
									selected.has(index) ? [...selected].sort((a, b) => a - b) : [index]
								);
								for (const id of tree.root.children) importFlowPage(tree, id);
							}}
						/></svelte:fragment
					>
				</PanelRow>
				{#if expanded.has(index)}{#each block.tags as tag}<PanelStatus
							>{shortenTag(tag)}</PanelStatus
						>{/each}{/if}
			</div>
		{:else}{#if !busy && !error}<PanelStatus
					>Drop a speech document here to browse its blocks.</PanelStatus
				>{/if}{/each}
	</div>
</section>

<style>
	.autoflow-panel {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		min-height: 0;
		flex: 1;
	}
	.blocks {
		overflow: auto;
		min-height: 0;
	}
	.count {
		color: var(--text-weak);
		font-size: 0.85em;
	}
</style>
