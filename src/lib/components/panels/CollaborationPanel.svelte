<script lang="ts">
	import PanelHeader from './PanelHeader.svelte';
	import PanelField from './PanelField.svelte';
	import PanelStatus from './PanelStatus.svelte';
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
	function keydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && text.trim()) {
			event.preventDefault();
			send();
		}
	}
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

<section class="collaboration-panel" aria-label="Collaboration">
	<PanelHeader name="Collaboration">
		{#if $connections.tag === 'empty'}
			<Button
				icon="people"
				ariaLabel="Enable collaboration"
				tooltip="share this flow with your partner"
				on:click={() => openPopup(Share, 'Share')}
			/>
		{:else}
			<Button
				icon="arrowRight"
				ariaLabel="Send selected argument"
				tooltip="send your partner a link to the selected argument"
				disabled={!argument}
				disabledReason="Select an argument first"
				on:click={sendArgument}
			/>
		{/if}
	</PanelHeader>
	{#if $connections.tag === 'empty'}
		<PanelStatus>Share this flow to message your partner.</PanelStatus>
	{:else}
		<div class="messages" aria-live="polite">
			{#each $partnerNotices as notice (notice.id)}
				<div class="message" class:received={notice.received}>
					<p><span class="from">{notice.received ? 'Partner' : 'You'}</span>{notice.text}</p>
					{#if notice.argumentId}<ArgumentLink id={notice.argumentId} />{/if}
				</div>
			{:else}
				<PanelStatus>Messages to and from your partner show up here.</PanelStatus>
			{/each}
		</div>
		<form class="compose" on:submit|preventDefault>
			<PanelField
				multiline
				rows={2}
				ariaLabel="Message your partner"
				placeholder="message your partner"
				maxlength={2000}
				bind:value={text}
				on:keydown={keydown}
			/>
			<Button
				icon="arrowUp"
				ariaLabel="Send"
				tooltip="send"
				disabled={!text.trim()}
				on:click={send}
			/>
		</form>
		{#if error}<PanelStatus error>{error}</PanelStatus>{/if}
	{/if}
</section>

<style>
	.collaboration-panel {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		min-height: 0;
		flex: 1;
	}
	.messages {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		overflow: auto;
		min-height: 0;
		flex: 1;
	}
	.message {
		padding: 0 var(--padding);
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
	.message p {
		margin: 0;
	}
	.from {
		color: var(--text-weak);
		font-size: 0.85em;
		padding-right: var(--padding);
	}
	.compose {
		display: flex;
		align-items: flex-end;
		gap: var(--padding-small);
		flex-shrink: 0;
	}
	.compose :global(.panel-field) {
		flex: 1;
	}
</style>
