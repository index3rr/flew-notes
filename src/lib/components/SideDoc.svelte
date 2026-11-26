<script lang="ts">
	import PanelField from './panels/PanelField.svelte';
	import { panelDrop } from '$lib/models/panelDrop';
	import { pagesMime, boxesMime, readPageDrag } from '$lib/models/panelDrag';
	import { documentOpen } from '$lib/models/document';
	import { sideDocText, frozen } from '$lib/models/store';
	let element: HTMLDivElement;
	function drop(event: DragEvent) {
		if ($frozen || !$documentOpen) return;
		const transfer = event.dataTransfer;
		if (!transfer) return;
		let text = transfer.getData('text/plain');
		if (!text && transfer.getData(pagesMime)) {
			try {
				const { source, ids } = readPageDrag(transfer.getData(pagesMime));
				text = ids
					.flatMap((id) => source[id]!.children.map((child) => source[child]!.value.content))
					.join('\n');
			} catch {
				return;
			}
		}
		if (!text && transfer.getData(boxesMime)) {
			try {
				text = JSON.parse(transfer.getData(boxesMime))
					.boxes.map((box: { value: { content: string } }) => box.value.content)
					.join('\n');
			} catch {
				return;
			}
		}
		if (!text) return;
		event.preventDefault();
		event.stopPropagation();
		const field = element.querySelector('textarea');
		const start = field?.selectionStart ?? $sideDocText.length;
		const end = field?.selectionEnd ?? start;
		$sideDocText = $sideDocText.slice(0, start) + text + $sideDocText.slice(end);
		field?.focus();
	}
</script>

<div
	role="region"
	aria-label="Notes text"
	class="document"
	bind:this={element}
	use:panelDrop={{
		types: [pagesMime, boxesMime, 'text/plain'],
		disabled: $frozen || !$documentOpen
	}}
	on:drop={drop}
>
	<PanelField
		multiline
		fill
		disabled={$frozen || !$documentOpen}
		placeholder="type notes here"
		ariaLabel="Notes"
		bind:value={$sideDocText}
	/>
</div>

<style>
	.document {
		width: 100%;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
</style>
