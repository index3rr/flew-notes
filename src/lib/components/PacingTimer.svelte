<script lang="ts">
	import { onDestroy } from 'svelte';
	import { focusId } from '$lib/models/focus';
	import Button from './Button.svelte';
	import { checkIdBox, getColumnBoxes } from '$lib/models/node';
	import type { Nodes, BoxId, Box } from '$lib/models/node';
	import { settings } from '$lib/models/settings';

	export let nodes: Nodes;
	export let mainTimerTime: number;
	export let isRunning: boolean;
	export let palette: string;

	let prevFocusId: BoxId | null = null;
	let boxes: BoxId[] = [];
	let currentIndex = -1;
	let pacingCountdown = 0;
	let interval: ReturnType<typeof setInterval> | null = null;
	let startTimestamp = 0;
	let ogTime = 0;
	let prevRunning = false;
	let timeOverride: Map<BoxId, number> = new Map();

	function shouldSkipBox(box: Box): boolean {
		return !!(box.isExtension || box.crossed || box.content.length === 0);
	}

	function parseTimecode(content: string): number {
		const match = content.match(/(?:^|[\s(\[])(\d*):(\d{2})(?:$|[\s)\]])/);
		if (!match) return 0;
		const minutes = match[1] ? parseInt(match[1], 10) : 0;
		const seconds = parseInt(match[2], 10);
		return (minutes * 60 + seconds) * 1000;
	}

	function resetPacing() {
		const remaining = boxes.slice(currentIndex);
		const graceMs = (settings.data.pacingGracePeriod.value as number) * 1000;

		let fixedSum = 0;
		let variableCount = 0;
		for (const id of remaining) {
			const fixed = timeOverride.get(id) ?? 0;
			if (fixed > 0) fixedSum += fixed;
			else variableCount++;
		}

		const distributable = Math.max(0, mainTimerTime - graceMs - fixedSum);
		const tpb = variableCount > 0 ? Math.floor(distributable / variableCount) : 0;

		const currentFixed = timeOverride.get(boxes[currentIndex]) ?? 0;
		if (currentFixed > 0) {
			pacingCountdown = currentFixed;
			ogTime = currentFixed;
		} else {
			pacingCountdown = tpb;
			ogTime = tpb;
		}
		startTimestamp = Date.now();
		stopInterval();
		if (isRunning) {
			interval = setInterval(tick, 100);
		}
	}

	$: {
		const boxId = $focusId ? checkIdBox(nodes, $focusId) : null;
		if (boxId && boxId !== prevFocusId) {
			prevFocusId = boxId;
			const allBoxes = getColumnBoxes(nodes, boxId);
			boxes = allBoxes.filter((id) => {
				const n = nodes[id];
				return !n || n.value.tag !== 'box' || !shouldSkipBox(n.value);
			});
			timeOverride = new Map();
			for (const id of boxes) {
				const box = nodes[id];
				if (box && box.value.tag === 'box') {
					const ms = parseTimecode(box.value.content);
					if (ms > 0) timeOverride.set(id, ms);
				}
			}
			currentIndex = boxes.indexOf(boxId);
			if (currentIndex >= 0) {
				resetPacing();
			} else {
				pacingCountdown = 0;
				ogTime = 0;
				stopInterval();
			}
		}
	}

	$: {
		if (prevFocusId) {
			if (isRunning && !prevRunning) {
				resetPacing();
			} else if (!isRunning && prevRunning) {
				stopInterval();
			}
			prevRunning = isRunning;
		}
	}

	function stopInterval() {
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
	}

	function tick() {
		pacingCountdown = Math.max(0, ogTime - (Date.now() - startTimestamp));
	}

	function advance(dir: 'next' | 'prev') {
		if (boxes.length === 0 || currentIndex < 0) return;
		let newIndex: number;
		if (dir === 'next') {
			newIndex = (currentIndex + 1) % boxes.length;
		} else {
			newIndex = (currentIndex - 1 + boxes.length) % boxes.length;
		}
		focusId.set(boxes[newIndex]);
	}

	$: currentBox = currentIndex >= 0 ? nodes[boxes[currentIndex]] : null;
	$: boxContent = currentBox?.value?.content || '';
	$: displayMinutes = String(Math.floor(Math.max(0, pacingCountdown) / 60000)).padStart(2, '0');
	$: displaySeconds = String(Math.floor((Math.max(0, pacingCountdown) % 60000) / 1000)).padStart(2, '0');
	$: isDone = pacingCountdown <= 0 && isRunning;

	onDestroy(() => {
		stopInterval();
	});
</script>

{#if prevFocusId && boxes.length > 0}
	<div class="pacing">
		<div class="top palette-{palette}">
			<Button icon="arrowLeft" palette={palette} on:click={() => advance('prev')} />
			<div class="time" class:done={isDone}>
				{displayMinutes}:{displaySeconds}
			</div>
			<Button icon="arrowRight" palette={palette} on:click={() => advance('next')} />
		</div>
		<div class="info">
			<span class="name">{boxContent || '(empty)'}</span>
			{#if currentIndex >= 0}
				<span class="index">{currentIndex + 1}/{boxes.length}</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.pacing {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		gap: var(--padding-small);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-direction: row;
		width: 100%;
	}
	.time {
		font-size: 1.5rem;
		color: var(--this-text);
	}
	@keyframes done {
		0% { color: var(--this-text); }
		50% { color: var(--this-color); }
		100% { color: var(--this-text); }
	}
	.done {
		animation: done 1s infinite;
	}
	.info {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		gap: var(--padding);
		font-size: 0.85rem;
		color: var(--this-text-weak);
		overflow: hidden;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		text-align: center;
	}
	.index {
		flex-shrink: 0;
	}
</style>
