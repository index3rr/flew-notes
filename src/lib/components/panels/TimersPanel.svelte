<script lang="ts">
	import Timers from '$lib/components/Timers.svelte';
</script>

<div class="timer-panel">
	<Timers />
</div>

<style>
	.timer-panel {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
		width: 100%;
		height: 100%;
		overflow-y: auto;
	}
</style>
