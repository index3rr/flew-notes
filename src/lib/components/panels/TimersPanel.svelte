<script lang="ts">
	import PanelHeader from './PanelHeader.svelte';
	import Timers from '$lib/components/Timers.svelte';
</script>

<div class="timer-panel">
	<PanelHeader name="Timers" />
	<Timers />
</div>

<style>
	.timer-panel {
		width: 100%;
	}
</style>
