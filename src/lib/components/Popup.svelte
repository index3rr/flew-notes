<script lang="ts">
	import Button from './Button.svelte';
	import { popupIn, popupOut } from '../models/transition';
	import { closePopupInstance, type Popup } from '$lib/models/popup';
	export let popup: Popup;

	function closeSelf() {
		closePopupInstance(popup);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeSelf();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />
<div class="top" in:popupIn|global out:popupOut|global>
	<div class="upper">
		<Button
			icon="delete"
			ariaLabel="Close popup"
			tooltip="close"
			shortcut={['escape']}
			palette="plain-secondary"
			on:click={closeSelf}
		/><span>{popup.title}</span>
	</div>
	{#each [popup] as entry (entry)}
		<svelte:component
			this={entry.component}
			closePopup={() => closePopupInstance(entry)}
			{...entry.props}
		/>
	{/each}
</div>

<style>
	.top {
		background: var(--background);
		display: block;
		position: absolute;
		border-radius: var(--border-radius);
		overflow: hidden;
	}
	.upper {
		position: absolute;
		z-index: 3;
		background: var(--background);
		border-radius: var(--border-radius);
		display: flex;
		align-items: center;
		flex-direction: row;
		gap: var(--padding-small);
	}
	span {
		font-weight: var(--font-weight-bold);
	}
</style>
