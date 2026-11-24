<script lang="ts">
	import { tooltipTransition } from '../models/transition';
	import Shortcut from './Shortcut.svelte';
	import { tick, onDestroy } from 'svelte';
	import { settings } from '$lib/models/settings';
	import { tooltipState } from '$lib/models/store';

	export let content: string | null;
	export let shortcut: string[] | null = null;
	export let disabled: boolean | string = false;
	export let layout: string = 'bottom';
	export let inline: boolean = false;
	let isHovered: boolean = false;
	let x: number = 0;
	let y: number = 0;
	let element: HTMLElement;
	let tooltip: {
		offsetWidth: number;
		offsetHeight: number;
	};

	let useTooltips = true;

	onDestroy(
		settings.subscribe(['useTooltips'], function () {
			useTooltips = settings.data.useTooltips.value as boolean;
		})
	);
	let openTimeout: ReturnType<typeof setTimeout> | null = null;
	async function openTooltip() {
		isHovered = true;
		mouseMove();
		await tick();
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
		if (tooltip) {
			let rect = element.getBoundingClientRect();
			const margin = parseFloat(getComputedStyle(element).getPropertyValue('--padding')) || 0;
			if (layout == 'bottom' || layout == 'top') {
				x = rect.left - tooltip.offsetWidth / 2 + rect.width / 2;
				if (x < margin) {
					x = margin;
				} else if (x + tooltip.offsetWidth > window.innerWidth - margin) {
					x = window.innerWidth - tooltip.offsetWidth - margin;
				}
				if (layout == 'bottom') {
					y = rect.bottom + margin;
				} else if (layout == 'top') {
					y = rect.top - tooltip.offsetHeight - margin;
				}
			} else if (layout == 'left' || layout == 'right') {
				y = rect.top - tooltip.offsetHeight / 2 + rect.height / 2;
				if (y < margin) {
					y = margin;
				} else if (y + tooltip.offsetHeight > window.innerHeight - margin) {
					y = window.innerHeight - tooltip.offsetHeight - margin;
				}
				if (layout == 'left') {
					x = rect.left - tooltip.offsetWidth - margin;
				} else if (layout == 'right') {
					x = rect.right + margin;
				}
			}
			x = Math.max(margin, Math.min(x, window.innerWidth - tooltip.offsetWidth - margin));
			y = Math.max(margin, Math.min(y, window.innerHeight - tooltip.offsetHeight - margin));
		}
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
		on:mousemove={mouseMove}
		bind:this={element}
		role="tooltip"
	>
		<slot />
	</div>

	{#if isHovered}
		<div
			bind:this={tooltip}
			style="top: {y}px; left: {x}px;"
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
