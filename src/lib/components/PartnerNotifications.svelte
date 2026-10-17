<script lang="ts">
	import { partnerNotices } from '$lib/models/collaboration';
	import ArgumentLink from './ArgumentLink.svelte';
	import Button from './Button.svelte';
	let dismissed = new Set<string>();
</script>

<div class="notifications" aria-live="polite">
	{#each $partnerNotices
		.filter((item) => item.received && !dismissed.has(item.id))
		.slice(-3) as notice}
		<div class="notice">
			<div>
				<span>Partner: {notice.text}</span>{#if notice.argumentId}<ArgumentLink
						id={notice.argumentId}
					/>{/if}
			</div>
			<Button
				icon="delete"
				ariaLabel="Dismiss partner notification"
				tooltip="Dismiss notification"
				on:click={() => (dismissed = new Set([...dismissed, notice.id]))}
			/>
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
	.notice > div:first-child {
		min-width: 0;
		flex: 1;
		white-space: pre-wrap;
	}
</style>
