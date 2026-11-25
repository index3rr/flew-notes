<script lang="ts">
	export let name: string;
</script>

<div class="panel-placeholder"><span>{name}</span></div>

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
		justify-content: space-between;
		gap: var(--padding-small);
	}
</style>
