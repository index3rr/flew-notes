<script lang="ts">
	import Tooltip from '../Tooltip.svelte';
	export let name: string;
</script>

<Tooltip content="No flow is open.">
	<p class="panel-placeholder">{name}</p>
</Tooltip>

<style>
	/* Matches PanelHeader so the name stays put when the panel's body arrives. */
	.panel-placeholder {
		display: flex;
		align-items: center;
		box-sizing: border-box;
		min-height: calc(var(--button-size) + var(--padding) * 2);
		margin: 0;
		padding: 0 var(--padding);
		color: var(--text-weak);
		white-space: nowrap;
		cursor: help;
	}
</style>
