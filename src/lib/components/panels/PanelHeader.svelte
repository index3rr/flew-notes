<script lang="ts">
	import Tooltip from '../Tooltip.svelte';
	// The one header every titled panel uses: a weak name on the left, icon actions on the right.
	export let name: string;
	export let detail: string | null = null;
	export let tooltip: string | null = null;
</script>

<header class="panel-header">
	<Tooltip content={tooltip}>
		<h2 class="name">
			{name}{#if detail}<span class="detail">{detail}</span>{/if}
		</h2>
	</Tooltip>
	<div class="actions"><slot /></div>
</header>

<style>
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: calc(var(--button-size) + var(--padding) * 2);
		flex-shrink: 0;
		min-width: 0;
	}
	.panel-header > :global(:first-child) {
		min-width: 0;
		flex: 1;
	}
	.name {
		margin: 0;
		padding: 0 var(--padding);
		font-size: 1em;
		font-weight: var(--font-weight);
		color: var(--text-weak);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.detail {
		padding-left: var(--padding);
		font-size: 0.85em;
	}
	.actions {
		display: flex;
		flex-shrink: 0;
	}
	.actions:empty {
		display: none;
	}
</style>
