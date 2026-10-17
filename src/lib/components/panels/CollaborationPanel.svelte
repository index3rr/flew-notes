<script lang="ts">
	import { partnerNotices } from '$lib/models/collaboration';
	import { sendPartnerMessage } from '$lib/models/sharingChannel';
	import Button from '../Button.svelte';
	let text = '';
	let error = '';
	function send() {
		if (sendPartnerMessage(text)) {
			text = '';
			error = '';
		} else error = 'Connect to a partner using Share before sending a message.';
	}
</script>

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

<style>
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
