<script lang="ts" context="module">
	export type DemoNode = { id: string; text: string; children?: DemoNode[] };
</script>

<script lang="ts">
	export let node: DemoNode;
	export let level = 1;
	export let last = false;
	// text typed so far; cells missing from it are only there from the start if `level` is 1
	export let typed: Record<string, string>;
	export let focusId: string | undefined;

	$: shown = level == 1 || node.id in typed;
	$: text = level == 1 ? node.text : typed[node.id] ?? '';
	$: focus = focusId == node.id;
	$: visibleChildren = (node.children ?? []).filter((child) => child.id in typed);
</script>

{#if shown}
	<div class="node">
		<div class={`content palette-${level % 2 ? 'accent' : 'accent-secondary'}`} class:focus>
			<div class="line" />
			<div class="text">
				{text}{#if focus}<span class="caret" />{/if}
			</div>
			{#if last}<div class="line below" />{/if}
		</div>
		{#if visibleChildren.length}
			<div class="children">
				{#each visibleChildren as child, index (child.id)}
					<svelte:self
						node={child}
						level={level + 1}
						last={index == visibleChildren.length - 1}
						{typed}
						{focusId}
					/>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.node {
		display: flex;
		flex-direction: row;
		animation: cellIn 0.25s ease-out;
	}
	.content {
		position: relative;
		flex-shrink: 0;
		width: var(--column-width);
		height: min-content;
		box-sizing: border-box;
		border-radius: var(--border-radius-small);
		color: var(--this-text);
	}
	.content.focus {
		background: var(--this-background-active);
	}
	.text {
		padding: var(--padding);
		line-height: 1.5em;
		overflow-wrap: anywhere;
	}
	.line {
		position: absolute;
		top: 0;
		left: var(--padding);
		width: calc(var(--column-width) - var(--padding) * 2);
		height: var(--line-width);
		margin-top: calc(-0.5 * var(--line-width));
		border-radius: var(--border-radius-small);
		background: var(--this-background-indent);
	}
	.line.below {
		top: 100%;
	}
	.focus .line {
		background: var(--this-color-fade);
	}
	.caret {
		display: inline-block;
		width: calc(var(--line-width) / 4);
		height: 1.1em;
		margin-left: calc(var(--line-width) / 8);
		vertical-align: text-bottom;
		background: var(--this-text);
		animation: blink 1s steps(1) infinite;
	}
	@keyframes cellIn {
		from {
			opacity: 0;
			transform: translateY(calc(var(--padding) * -1));
		}
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.node,
		.caret {
			animation: none;
		}
	}
</style>
