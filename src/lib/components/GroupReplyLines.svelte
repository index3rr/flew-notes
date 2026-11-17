<script lang="ts">
	import { getContext, onMount, onDestroy } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { BoxId, FlowId } from '$lib/models/node';
	import { nodes } from '$lib/models/store';
	import { folded } from '$lib/models/fold';
	import { groupReplyMembers } from '$lib/models/groupReply';

	export let flowId: FlowId;
	const elements = getContext<Writable<Map<BoxId, HTMLElement>>>('boxElements');
	const curves = getContext<Writable<Map<BoxId, string[]>>>('groupReplyCurves');
	const spacing = getContext<Writable<Map<BoxId, number>>>('groupReplySpacing');
	let observer: ResizeObserver | undefined;
	let frame = 0;

	function visible(id: BoxId) {
		let node = $nodes[id];
		if (!node || node.value.flowId !== flowId || node.value.empty || node.value.isExtension)
			return false;
		while (node && node.parent !== flowId) {
			if ($folded.get(node.parent as BoxId)) return false;
			node = $nodes[node.parent as BoxId];
		}
		return true;
	}

	function measure() {
		frame = 0;
		const next = new Map<BoxId, string[]>();
		const nextSpacing = new Map<BoxId, number>();
		for (const [parent, members] of $groupReplyMembers) {
			const first = $elements.get(parent);
			const lastId = members[members.length - 1];
			const last = $elements.get(lastId);
			const children = first?.closest('.box')?.querySelector(':scope > .children');
			if (!first || !last || !children) continue;
			const sourceHeight = last.getBoundingClientRect().bottom - first.getBoundingClientRect().top;
			const responseHeight = children.getBoundingClientRect().height;
			nextSpacing.set(lastId, Math.max(0, responseHeight - sourceHeight));
		}
		for (const [id, el] of $elements) {
			const reply = $nodes[id];
			if (!reply?.value.respondsTo?.length || !visible(id)) continue;
			const targets = [reply.parent as BoxId, ...reply.value.respondsTo].filter(
				(target) => visible(target) && $nodes[target]?.level === reply.level - 1
			);
			const rects = targets.flatMap((target) => {
				const element = $elements.get(target);
				return element ? [element.getBoundingClientRect()] : [];
			});
			if (rects.length < 2) continue;
			const lastResponseId = $nodes[reply.parent]?.children.findLast((child) => visible(child));
			const lastResponse = (lastResponseId && $elements.get(lastResponseId)) || el;
			const line = lastResponse.parentElement?.querySelector('.line.below');
			if (!line || !lastResponseId) continue;
			const rect = line.getBoundingClientRect();
			const originY = rect.top + rect.height / 2;
			// Continue the lowest card's bottom line into the final response's bottom line.
			const bottom = rects.reduce((lowest, target) =>
				target.bottom > lowest.bottom ? target : lowest
			);
			const padding = parseFloat(getComputedStyle(lastResponse).paddingLeft);
			const gutter = lastResponse.getBoundingClientRect().left - rect.left;
			const startX = bottom.right - padding - rect.left;
			const startY = bottom.bottom - originY;
			const d = `M ${startX} ${startY} C ${gutter} ${startY} ${gutter} 0 0 0`;
			next.set(lastResponseId, [...(next.get(lastResponseId) ?? []), d]);
		}
		curves.set(next);
		spacing.set(nextSpacing);
	}

	function schedule() {
		if (observer && !frame) frame = requestAnimationFrame(measure);
	}

	$: $nodes, $folded, $groupReplyMembers, schedule();
	$: if (observer) {
		observer.disconnect();
		for (const element of $elements.values()) {
			observer.observe(element);
			const line = element.parentElement?.querySelector('.line.below');
			if (line) observer.observe(line);
			// Box transitions animate the outer height and move neighboring cells.
			const box = element.closest('.box');
			if (box) observer.observe(box);
		}
		schedule();
	}
	onMount(() => {
		observer = new ResizeObserver(schedule);
	});
	onDestroy(() => {
		observer?.disconnect();
		cancelAnimationFrame(frame);
		curves.set(new Map());
		spacing.set(new Map());
	});
</script>
