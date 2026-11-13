<script lang="ts">
	import PanelPlaceholder from './PanelPlaceholder.svelte';
	export let available = true;
	import { partnerNotices } from '$lib/models/collaboration';
	import { sendPartnerMessage } from '$lib/models/sharingChannel';
	import Button from '../Button.svelte';
	import Share from '../Share.svelte';
	import { openPopup } from '$lib/models/popup';
	import { connections } from '$lib/models/store';
	import { nodes } from '$lib/models/store';
	import { focusId, lastFocusIds, selectedFlowId } from '$lib/models/focus';
	import { currentArgument } from '$lib/models/argumentNavigation';
	import { getColumnName } from '$lib/models/node';
	import ArgumentLink from '../ArgumentLink.svelte';
	import { resolvePendingAction } from '$lib/models/nodePendingAction';
	$: argument = currentArgument($nodes, $selectedFlowId, $focusId, $lastFocusIds);
	let text = '';
	let error = '';
	function send() {
		if (sendPartnerMessage(text)) {
			text = '';
			error = '';
		} else error = 'Connect to a partner using Share before sending a message.';
	}
	function sendArgument() {
		resolvePendingAction($nodes);
		const selected = currentArgument();
		if (!selected) return;
		const page = $nodes[selected.node.value.flowId]?.value.content || 'Untitled page';
		const message = `${text.trim() || 'Please review'}: ${page} · ${
			getColumnName($nodes, selected.id) || 'Argument'
		}\n${selected.node.value.content.slice(0, 1200)}`;
		if (sendPartnerMessage(message, selected.id)) {
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
		<Button
			icon="arrowRight"
			text="Send selected argument"
			tooltip="Link your partner directly to the selected argument"
			disabled={!argument}
			disabledReason="Select an argument first"
			on:click={sendArgument}
		/>
		{#if error}<p role="status">{error}</p>{/if}
	</form>
	<div class="messages" aria-live="polite">
		{#each $partnerNotices as notice}<div class="message">
				<p>
					{notice.received ? 'Partner' : 'You'}: {notice.text}
				</p>
				{#if notice.argumentId}<ArgumentLink id={notice.argumentId} />{/if}
			</div>{/each}
	</div>
{/if}

<style>
	form :global(.element) {
		width: auto;
		max-width: 100%;
	}
	form :global(button.top),
	.messages :global(button.top),
	.enable-collaboration :global(button.top) {
		box-sizing: border-box;
		width: fit-content;
		max-width: 100%;
		height: auto;
		min-height: calc(var(--button-size) + var(--padding) * 2);
		white-space: normal;
		overflow-wrap: anywhere;
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
		border: none;
		border-radius: var(--border-radius);
		outline: none;
		padding: var(--padding);
		min-height: 4em;
		resize: vertical;
		transition: background var(--transition-speed);
	}
	textarea:focus {
		background: var(--background-active);
	}
	.message {
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
	.messages {
		overflow: auto;
	}
</style>
