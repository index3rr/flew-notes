<script lang="ts">
	export let error = false;
</script>

<p class="panel-status" class:error role={error ? 'alert' : 'status'}><slot /></p>

<style>
	.panel-status {
		margin: 0;
		padding: 0 var(--padding);
		color: var(--text-weak);
		font-size: 0.85em;
		overflow-wrap: anywhere;
	}
	.panel-status.error {
		color: var(--text-error);
	}
</style>
