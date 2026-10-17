<script lang="ts">
	import PanelPlaceholder from './PanelPlaceholder.svelte';
	export let available = true;
	import { partnerNotices } from '$lib/models/collaboration';
	import { sendPartnerMessage } from '$lib/models/sharingChannel';
	import Button from '../Button.svelte';
	import Share from '../Share.svelte';
	import { openPopup } from '$lib/models/popup';
	import { connections } from '$lib/models/store';
	let text = '';
	let error = '';
	function send() {
		if (sendPartnerMessage(text)) {
			text = '';
			error = '';
		} else error = 'Connect to a partner using Share before sending a message.';
	}
</script>

{#if !available}
	<PanelPlaceholder name="Collaboration" />
{:else if $connections.tag === 'empty'}
	<div class="enable-collaboration">
		<Button icon="people" text="Enable collaboration" on:click={() => openPopup(Share, 'Share')} />
	</div>
{:else}
	<form on:submit|preventDefault>
		<label
			>Message your partner<textarea
				aria-label="Message your partner"
				bind:value={text}
				maxlength="2000"
			/></label
		>
		<Button icon="people" text="Send" disabled={!text.trim()} on:click={send} />
		{#if error}<p role="status">{error}</p>{/if}
	</form>
	<div class="messages" aria-live="polite">
		{#each $partnerNotices as notice}<p>
				{notice.received ? 'Partner' : 'You'}: {notice.text}
			</p>{/each}
	</div>
{/if}

<style>
	.enable-collaboration :global(button.top) {
		box-sizing: border-box;
		width: fit-content;
		max-width: 100%;
		height: auto;
		min-height: calc(var(--button-size) + var(--padding) * 2);
	}

	form,
	label {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
	textarea {
		font: inherit;
		color: var(--text);
		background: var(--background-indent);
		border: 0;
		padding: var(--padding);
		min-height: 4em;
		resize: vertical;
	}
	.messages {
		overflow: auto;
	}
</style>
