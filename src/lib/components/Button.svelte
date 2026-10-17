<script lang="ts">
	import Icon from './Icon.svelte';
	import Tooltip from './Tooltip.svelte';
	import TutorialHighlight from './TutorialHighlight.svelte';
	import Link from './Link.svelte';
	// TODO: add grouping

	export let icon: string;
	export let ariaLabel: string | null = null;
	export let text: string | null = null;
	export let tooltip: string | null = null;
	export let disabled: boolean | string = false;
	export let shortcut: string[] | null = null;
	export let palette: string | null = null;
	export let link: string | null = null;
	export let target: string | null = null;
	export let disabledReason = 'disabled';
	export let tooltipLayout = 'bottom';
	export let tutorialHighlight: number | null = null;
	export let onclick: () => void = () => undefined;

	export let notification = false;
	export let toggled = false;

	export let inline = false;

	export let preventBlur = true;
	function handleMouseDown(e: MouseEvent) {
		if (preventBlur) {
			e.preventDefault();
		}
	}
</script>

<TutorialHighlight step={tutorialHighlight}>
	<Tooltip
		content={tooltip}
		disabled={disabled && disabledReason}
		{shortcut}
		layout={tooltipLayout}
	>
		<Link {link} {target}>
			<button
				class={`top ${palette ? 'palette-' + palette : ''}`}
				class:notification
				class:toggled
				class:disabled
				on:click
				on:click={onclick}
				on:mousedown={handleMouseDown}
				class:inline
				aria-label={ariaLabel ?? undefined}
				disabled={!!disabled}
			>
				{#if notification}
					<div class="dot" />
				{/if}
				<Icon name={icon} size="var(--button-size)" />
				{#if text != null}
					{text}
				{/if}
			</button>
		</Link>
	</Tooltip>
</TutorialHighlight>

<style>
	.top {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: var(--padding-small);

		box-sizing: content-box;
		padding: var(--padding);
		width: max-content;
		min-width: var(--button-size);
		height: var(--button-size);

		border: none;
		background: none;
		margin: 0;
		text-align: left;
		border-radius: var(--border-radius);
		font-weight: var(--font-weight);
		color: var(--this-text);
		transition: background var(--transition-speed);
	}

	.top.inline {
		display: inline-flex;
		padding: var(--padding-small);
		vertical-align: middle;
	}
	.top.disabled {
		color: var(--this-text-weak);
	}

	.top:hover,
	.top.notification {
		background-color: var(--this-background-indent);
	}
	.top.disabled:hover,
	.top.disabled:active {
		background: none;
	}
	.top:active,
	.top.toggled {
		transition: none;
		background-color: var(--this-background-active);
	}
	.top.notification {
		position: relative;
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-accent);
		position: absolute;
		right: calc(var(--border-radius) / 2);
		top: calc(var(--border-radius) / 2);
	}
</style>
