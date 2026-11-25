<script lang="ts">
	import { panelDrop } from '$lib/models/panelDrop';
	import PanelMenu from './PanelMenu.svelte';
	import { openPopup } from '$lib/models/popup';
	import { serializeBoxSubtree } from '$lib/models/node';
	import { selectedBoxIds } from '$lib/models/selection';
	import { currentArgument } from '$lib/models/argumentNavigation';
	import { nodes } from '$lib/models/store';
	import { selectionRoots } from '$lib/models/panelDrag';
	import { get } from 'svelte/store';
	import { onDestroy } from 'svelte';
	import PanelHeader from './PanelHeader.svelte';
	import PanelStatus from './PanelStatus.svelte';
	import PanelRow from './PanelRow.svelte';
	import Button from '../Button.svelte';
	import { readSpeechDoc, shortenTag, type DocBlock } from '$lib/models/speechDoc';
	import {
		droppedDocument,
		fileMime,
		pagesMime,
		boxesMime,
		readPageDrag
	} from '$lib/models/panelDrag';
	import { newFlowId, newBoxId, type Nodes } from '$lib/models/node';
	import { getDebateStyleFlow } from '$lib/models/debateStyle';
	import { importFlowPage } from '$lib/models/nodeDecorateAction';
	import { documentOpen } from '$lib/models/document';
	import { cardMirror, readCardMirrorHeadings, sendToCardMirror } from '$lib/models/cardMirror';
	import { settings } from '$lib/models/settings';
	function menu() {
		openPopup(PanelMenu, 'Autoflow', {
			actions: [
				{ label: 'Load DOCX', run: () => input.click() },
				{
					label: 'Paste copied cells',
					disabled: $cardMirror.state !== 'connected',
					run: async () => {
						try {
							const data = JSON.parse(await navigator.clipboard.readText());
							if (data.tag !== 'flew-notes-boxes' || !Array.isArray(data.boxes))
								throw new Error('Copy flow cells first.');
							await sendToCardMirror(data.boxes, speechTarget);
						} catch (cause) {
							error = (cause as Error).message;
						}
					}
				}
			]
		});
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
						content: shortenTag(tag),
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
		if (event.shiftKey)
			selected = new Set(
				Array.from({ length: Math.abs(index - anchor) + 1 }, (_, i) => Math.min(index, anchor) + i)
			);
		else if (event.ctrlKey || event.metaKey) {
			const next = new Set(selected);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			selected = next;
			anchor = index;
		} else {
			selected = new Set([index]);
			anchor = index;
			expanded = new Set(expanded);
			if (expanded.has(index)) expanded.delete(index);
			else expanded.add(index);
		}
	}
	function drag(event: DragEvent, index: number) {
		const indices = selected.has(index) ? [...selected].sort((a, b) => a - b) : [index];
		const tree = source(indices);
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
	async function sendSelected(speech: boolean) {
		error = '';
		busy = true;
		speechTarget = speech;
		try {
			const tree = get(nodes);
			const ids = get(selectedBoxIds).size
				? get(selectedBoxIds)
				: currentArgument()
				? [currentArgument()!.id]
				: [];
			await sendToCardMirror(
				selectionRoots(tree, ids).map((id) => serializeBoxSubtree(tree, id)),
				speech
			);
		} catch (cause) {
			error = (cause as Error).message;
		} finally {
			busy = false;
		}
	}
	let speechTarget = false;
	async function drop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		const token = begin();
		busy = true;
		error = '';
		try {
			const pages = event.dataTransfer?.getData(pagesMime);
			if (pages) {
				const { source, ids } = readPageDrag(pages);
				await sendToCardMirror(
					ids.flatMap((id) =>
						source[id]!.children.map((child) => serializeBoxSubtree(source, child))
					),
					speechTarget
				);
				return;
			}
			const raw = event.dataTransfer?.getData(boxesMime);
			if (raw) {
				await sendToCardMirror(JSON.parse(raw).boxes, speechTarget);
				return;
			}
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
	use:panelDrop={{ types: [fileMime, boxesMime, pagesMime, 'Files'] }}
	aria-label="Autoflow"
	on:dragover={(e) => {
		e.preventDefault();
		e.stopPropagation();
	}}
	on:drop={drop}
>
	<PanelHeader
		name="Autoflow"
		detail={name || null}
		tooltip="drop a DOCX here; select blocks with Ctrl/Cmd or Shift, then drag them onto tabs or cells. Drop selected flow cells here to send them to CardMirror."
	>
		<Button icon="dots" ariaLabel="Autoflow menu" tooltip="autoflow menu" on:click={menu} />
		<Button
			icon="link"
			ariaLabel="Read CardMirror headings"
			tooltip="read the current CardMirror document headings"
			disabled={busy || $cardMirror.state !== 'connected'}
			on:click={() => headings()}
		/>
		<Button
			icon="mic"
			ariaLabel="Read speech document headings"
			tooltip="read CardMirror's speech document headings"
			disabled={busy || $cardMirror.state !== 'connected'}
			on:click={() => headings(true)}
		/>
	</PanelHeader>
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
	{#if $cardMirror.state === 'connected'}<div
			class="targets"
			role="group"
			aria-label="Send cells to CardMirror"
			on:dragenter={(event) => {
				speechTarget = !!(
					event.target instanceof Element && event.target.closest('[data-speech-target]')
				);
			}}
		>
			<Button
				icon="file"
				ariaLabel="Send selected cells to CardMirror"
				tooltip="send selected cells to the current CardMirror document, or drop cells here"
				toggled={!speechTarget}
				disabled={busy}
				on:dragenter={() => (speechTarget = false)}
				on:click={() => sendSelected(false)}
			/>
			<div data-speech-target>
				<Button
					icon="mic"
					ariaLabel="Send selected cells to speech document"
					tooltip="send selected cells to CardMirror's speech document, or drop cells here"
					toggled={speechTarget}
					disabled={busy}
					on:dragenter={() => (speechTarget = true)}
					on:click={() => sendSelected(true)}
				/>
			</div>
		</div>{/if}

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
	.targets {
		display: flex;
		gap: var(--padding-small);
		padding: 0 var(--padding);
	}
	.count {
		color: var(--text-weak);
		font-size: 0.85em;
	}
</style>
