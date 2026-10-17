<script lang="ts">
	import Tooltip from '../Tooltip.svelte';
	export let name: string;
</script>

<Tooltip content="No flow is open.">
	<p class="panel-placeholder">{name}</p>
</Tooltip>

<style>
	.panel-placeholder {
		margin: 0;
		color: var(--text-weak);
		white-space: nowrap;
		cursor: help;
	}
</style>
