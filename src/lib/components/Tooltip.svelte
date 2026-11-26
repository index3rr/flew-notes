<script lang="ts">
	import { tooltipPosition } from '$lib/models/tooltipPosition';
	import { tooltipTransition } from '../models/transition';
	import Shortcut from './Shortcut.svelte';
	import { tick, onDestroy } from 'svelte';
	import { settings } from '$lib/models/settings';
	import { tooltipState } from '$lib/models/store';

	export let content: string | null;
	export let shortcut: string[] | null = null;
	export let disabled: boolean | string = false;
	export let layout = 'bottom';
	export let inline = false;
	let isHovered = false;
	let x = 0;
	let y = 0;
	let element: HTMLElement;
	let tooltip: HTMLDivElement;
	let maxHeight = 0;

	let useTooltips = true;

	onDestroy(() => {
		if (openTimeout != null) clearTimeout(openTimeout);
	});
	onDestroy(
		settings.subscribe(['useTooltips'], function () {
			useTooltips = settings.data.useTooltips.value as boolean;
		})
	);
	let openTimeout: ReturnType<typeof setTimeout> | null = null;
	async function openTooltip() {
		isHovered = true;
		await tick();
		mouseMove();
		$tooltipState.open = true;
	}
	function mouseOver() {
		if (!isHovered) {
			$tooltipState.claimed = true;
			if ($tooltipState.open) {
				openTooltip();
			} else {
				if (openTimeout == null) {
					openTimeout = setTimeout(openTooltip, 0);
				}
			}
		}
	}
	function mouseMove() {
		if (!tooltip || !element) return;
		const gap = parseFloat(getComputedStyle(element).getPropertyValue('--padding')) || 0;
		({ x, y, maxHeight } = tooltipPosition(
			element.getBoundingClientRect(),
			{ width: tooltip.offsetWidth, height: Math.max(tooltip.offsetHeight, tooltip.scrollHeight) },
			{ width: window.innerWidth, height: window.innerHeight },
			layout,
			gap
		));
	}
	function portal(node: HTMLDivElement) {
		// A transformed flow column would otherwise become the fixed-position containing block.
		document.body.append(node);
		const observer = new ResizeObserver(mouseMove);
		observer.observe(node);
		observer.observe(element);
		window.addEventListener('resize', mouseMove);
		window.addEventListener('scroll', mouseMove, true);
		mouseMove();
		return {
			destroy() {
				observer.disconnect();
				window.removeEventListener('resize', mouseMove);
				window.removeEventListener('scroll', mouseMove, true);
				node.remove();
			}
		};
	}
	async function onContentChanged() {
		await tick();
		mouseMove();
	}
	$: tooltip, content, shortcut, disabled, layout, onContentChanged();
	function mouseLeave() {
		if (openTimeout != null) {
			clearTimeout(openTimeout);
			openTimeout = null;
		}
		$tooltipState.claimed = false;
		isHovered = false;
		setTimeout(function () {
			if (!$tooltipState.claimed) {
				$tooltipState.open = false;
			}
		}, 300);
	}
</script>

{#if content != null && useTooltips}
	<div
		class="element"
		class:inline
		on:mouseover={mouseOver}
		on:focus={mouseOver}
		on:mouseleave={mouseLeave}
		on:blur={mouseLeave}
		bind:this={element}
		role="tooltip"
	>
		<slot />
	</div>

	{#if isHovered}
		<div
			bind:this={tooltip}
			use:portal
			style="top: {y}px; left: {x}px; max-height: {maxHeight}px;"
			class="tooltip"
			transition:tooltipTransition
		>
			<div class="content">
				{content}
			</div>
			{#if !disabled && shortcut != null}
				<Shortcut keys={shortcut} />
			{/if}
			{#if disabled}
				<div class="disabled">
					{disabled}
				</div>
			{/if}
		</div>
	{/if}
{:else}
	<slot />
{/if}

<style>
	.element {
		width: min-content;
		height: min-content;
	}
	.element.inline {
		display: inline-block;
	}
	.tooltip {
		width: max-content;
		pointer-events: none;
		border: none;
		padding: var(--padding);
		color: var(--text);
		background-color: var(--background-back);
		border-radius: var(--border-radius);
		position: fixed;
		white-space: normal;
		max-width: calc(100vw - var(--padding) * 2);
		box-sizing: border-box;
		overflow-wrap: anywhere;
		overflow-y: auto;
		z-index: 10000;
		font-size: var(--font-size);
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.disabled {
		color: var(--text-weak);
	}
</style>
