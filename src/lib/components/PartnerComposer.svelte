<script lang="ts">
	import { onMount } from 'svelte';
	import { nodes } from '$lib/models/store';
	import type { BoxId } from '$lib/models/node';
	export let value = '';
	let editor: HTMLDivElement;
	let last: string | null = null;
	function read(node: Node): string {
		if (node instanceof HTMLElement && node.dataset.argumentId)
			return '[[argument:' + node.dataset.argumentId + ']]';
		if (node.nodeName === 'BR') return '\n';
		if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
		return (
			[...node.childNodes].map(read).join('') +
			(node.nodeName === 'DIV' && node !== editor ? '\n' : '')
		);
	}
	function input() {
		value = read(editor);
		last = value;
	}
	export function focus() {
		editor.focus();
	}
	function sync(text: string) {
		if (!editor || text === last) return;
		last = text;
		const focused = document.activeElement === editor;
		editor.replaceChildren();
		for (const part of text.split(/(\[\[argument:[^\]]+\]\])/g)) {
			if (part.startsWith('[[argument:')) {
				const id = part.slice(11, -2),
					chip = document.createElement('span');
				chip.className = 'argument-chip';
				chip.contentEditable = 'false';
				chip.dataset.argumentId = id;
				chip.textContent = $nodes[id as BoxId]?.value.content.slice(0, 55) || 'Argument';
				editor.append(chip);
			} else editor.append(document.createTextNode(part));
		}
		if (focused) {
			const range = document.createRange();
			range.selectNodeContents(editor);
			range.collapse(false);
			getSelection()?.removeAllRanges();
			getSelection()?.addRange(range);
		}
	}
	$: sync(value);
	onMount(() => sync(value));
	function paste(event: ClipboardEvent) {
		event.preventDefault();
		const text = event.clipboardData?.getData('text/plain') ?? '';
		const selection = getSelection();
		const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
		const node = document.createTextNode(text);
		if (range && editor.contains(range.commonAncestorContainer)) {
			range.deleteContents();
			range.insertNode(node);
			range.setStartAfter(node);
			range.collapse(true);
			selection?.removeAllRanges();
			selection?.addRange(range);
		} else editor.append(node);
		input();
	}
</script>

<div
	bind:this={editor}
	class="partner-composer"
	contenteditable="true"
	role="textbox"
	tabindex="0"
	aria-label="Message your partner"
	aria-multiline="true"
	data-placeholder="message your partner"
	on:input={input}
	on:keydown
	on:paste={paste}
/>

<style>
	.partner-composer {
		flex: 1;
		min-width: 0;
		min-height: calc(2em + var(--padding) * 2);
		max-height: calc(var(--view-height) / 3);
		overflow: auto;
		box-sizing: border-box;
		background: var(--background-indent);
		color: var(--text);
		border: none;
		border-radius: var(--border-radius);
		padding: var(--padding);
		font: inherit;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		outline: none;
	}
	.partner-composer:focus {
		background: var(--background-active);
	}
	.partner-composer:empty::before {
		content: attr(data-placeholder);
		color: var(--text-weak);
		pointer-events: none;
	}
	.partner-composer :global(.argument-chip) {
		display: inline-block;
		background: var(--background-accent-indent);
		color: var(--text-accent);
		border-radius: var(--border-radius-small);
		padding: 0 var(--padding-small);
		margin-inline: var(--padding-small);
	}
</style>
