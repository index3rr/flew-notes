<script lang="ts">
	export let time: string = '0:00';
	export let palette: string = 'accent';
</script>

<div class="top palette-{palette}">
	<span class="time">{time}</span>
</div>

<style>
	.top {
		display: flex;
		align-items: center;
		width: 100%;
		justify-content: center;
	}
	.time {
		font-size: 1.5rem;
		color: var(--this-text);
	}
</style>
