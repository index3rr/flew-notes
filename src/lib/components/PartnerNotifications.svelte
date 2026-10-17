<script lang="ts">
	import { partnerNotices } from '$lib/models/collaboration';
	let dismissed = new Set<string>();
</script>

<div class="notifications" aria-live="polite">
	{#each $partnerNotices
		.filter((item) => item.received && !dismissed.has(item.id))
		.slice(-3) as notice}
		<div class="notice">
			<span>Partner: {notice.text}</span><button
				aria-label="Dismiss partner notification"
				on:click={() => (dismissed = new Set([...dismissed, notice.id]))}>×</button
			>
		</div>
	{/each}
</div>

<style>
	.notifications {
		position: fixed;
		bottom: var(--padding-big);
		right: var(--padding-big);
		max-width: min(28em, 90vw);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}
	.notice {
		background: var(--background-active);
		color: var(--text);
		border-radius: var(--border-radius);
		padding: var(--padding-big);
		display: flex;
		gap: var(--gap);
		overflow-wrap: anywhere;
	}
	button {
		background: transparent;
		color: inherit;
		border: 0;
		cursor: pointer;
		font: inherit;
	}
</style>
