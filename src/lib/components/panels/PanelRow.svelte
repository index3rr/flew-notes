<script lang="ts">
	// A list item styled like a tab: palette text, indent on hover, active when pressed or selected.
	export let palette: string | null = null;
	export let weak = false;
	export let selected = false;
	export let disabled = false;
	export let draggable = false;
	export let ariaLabel: string | null = null;
	export let title: string | null = null;
</script>

<div class={`panel-row ${palette ? `palette-${palette}` : ''}`}>
	<button
		class="content"
		class:weak
		class:selected
		{disabled}
		{draggable}
		on:dragstart
		{title}
		aria-label={ariaLabel ?? undefined}
		on:click
		on:mousedown={(event) => {
			if (!draggable) event.preventDefault();
		}}
	>
		<slot />
	</button>
	{#if $$slots.actions}<div class="actions"><slot name="actions" /></div>{/if}
</div>

<style>
	.panel-row {
		display: flex;
		align-items: flex-start;
		min-width: 0;
	}
	.content {
		flex: 1;
		min-width: 0;
		display: block;
		padding: var(--padding);
		border: none;
		border-radius: var(--border-radius);
		background: none;
		color: var(--this-text);
		font: inherit;
		font-weight: var(--font-weight);
		text-align: left;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		transition: background var(--transition-speed);
	}
	.content.weak,
	.content:disabled {
		color: var(--this-text-weak);
	}
	.content:hover {
		background: var(--this-background-indent);
	}
	.content:disabled:hover {
		background: none;
	}
	.content:active,
	.content.selected {
		transition: none;
		background: var(--this-background-active);
	}
	.actions {
		display: flex;
		flex-shrink: 0;
	}
</style>
