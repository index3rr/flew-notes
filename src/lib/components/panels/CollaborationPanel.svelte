<script lang="ts">
	import PartnerMessage from '../PartnerMessage.svelte';
	import PanelHeader from './PanelHeader.svelte';
	import PartnerComposer from '../PartnerComposer.svelte';
	import PanelStatus from './PanelStatus.svelte';
	import { onMount } from 'svelte';
	import {
		partnerNotices,
		enablePartnerNotifications,
		partnerNotificationPermission,
		watchPartnerNotifications
	} from '$lib/models/collaboration';
	import { sendPartnerMessage } from '$lib/models/sharingChannel';
	import Button from '../Button.svelte';
	import Share from '../Share.svelte';
	import { openPopup } from '$lib/models/popup';
	import { connections } from '$lib/models/store';
	import { nodes } from '$lib/models/store';
	import { focusId, lastFocusIds, selectedFlowId } from '$lib/models/focus';
	import { currentArgument } from '$lib/models/argumentNavigation';
	import { resolvePendingAction } from '$lib/models/nodePendingAction';
	onMount(watchPartnerNotifications);
	$: argument = currentArgument($nodes, $selectedFlowId, $focusId, $lastFocusIds);
	let text = '';
	function keydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && text.trim()) {
			event.preventDefault();
			send();
		}
	}
	let error = '';
	function send() {
		const match = text.match(/\[\[argument:([^\]]+)\]\]/);
		if (sendPartnerMessage(text, match?.[1] as import('$lib/models/node').BoxId | undefined)) {
			text = '';
			error = '';
		} else error = 'Connect to a partner using Share before sending a message.';
	}
	function sendArgument() {
		resolvePendingAction($nodes);
		const selected = currentArgument();
		if (!selected) return;
		text += `${text && !text.endsWith(' ') ? ' ' : ''}[[argument:${selected.id}]]`;
	}
</script>

<section class="collaboration-panel" aria-label="Collaboration">
	<PanelHeader name="Collaboration">
		{#if $partnerNotificationPermission !== 'granted' && $partnerNotificationPermission !== 'unsupported'}
			<Button
				icon="screen"
				ariaLabel="Enable partner notifications"
				tooltip="enable system notifications"
				disabled={$partnerNotificationPermission === 'denied'}
				disabledReason="Allow notifications in your browser settings"
				on:click={async () => {
					try {
						await enablePartnerNotifications();
					} catch {
						error = 'Could not enable system notifications.';
					}
				}}
			/>
		{/if}
		{#if $connections.tag === 'empty'}
			<Button
				icon="people"
				ariaLabel="Enable collaboration"
				tooltip="share this flow with your partner"
				on:click={() => openPopup(Share, 'Share')}
			/>
		{/if}
	</PanelHeader>
	{#if $connections.tag === 'empty'}
		<PanelStatus>Share this flow to message your partner.</PanelStatus>
	{:else}
		<div class="messages" aria-live="polite">
			{#each $partnerNotices as notice (notice.id)}
				<div class="message" class:received={notice.received}>
					<p>
						<span class="from">{notice.received ? 'Partner' : 'You'}</span><PartnerMessage
							text={notice.text}
							argumentId={notice.argumentId}
						/>
					</p>
				</div>
			{/each}
		</div>
		<form class="compose" on:submit|preventDefault>
			<Button
				icon="link"
				ariaLabel="Insert selected argument link"
				tooltip="insert a link to the selected argument"
				disabled={!argument}
				on:click={sendArgument}
			/>
			<PartnerComposer bind:value={text} on:keydown={keydown} />
			<Button
				icon="arrowUp"
				ariaLabel="Send"
				tooltip="send"
				disabled={!text.trim()}
				on:click={send}
			/>
		</form>
	{/if}
	{#if error}<PanelStatus error>{error}</PanelStatus>{/if}
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
