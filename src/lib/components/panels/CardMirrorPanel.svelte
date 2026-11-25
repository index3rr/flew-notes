<script lang="ts">
	import PanelMenu from './PanelMenu.svelte';
	import { openPopup } from '$lib/models/popup';
	import Button from '../Button.svelte';
	import PanelHeader from './PanelHeader.svelte';
	import PanelField from './PanelField.svelte';
	import PanelRow from './PanelRow.svelte';
	import PanelStatus from './PanelStatus.svelte';
	import {
		cardMirror,
		cardMirrorOffer,
		cardMirrorDocuments,
		createCardMirrorOffer,
		confirmCardMirror,
		disconnectCardMirror,
		jumpToCardMirror,
		cancelCardMirrorDocument
	} from '$lib/models/cardMirror';
	import { focusId, lastFocusIds, selectedFlowId } from '$lib/models/focus';
	import { nodes } from '$lib/models/store';
	import { currentArgument } from '$lib/models/argumentNavigation';
	import type { BoxId } from '$lib/models/node';
	import { resolvePendingAction } from '$lib/models/nodePendingAction';

	let reply = '';
	let busy = false;
	let error = '';
	let sourceLimit = 8;
	let displayedBox: BoxId | null = null;
	$: argument = currentArgument($nodes, $selectedFlowId, $focusId, $lastFocusIds);
	$: sources = argument?.node.value.cardMirror?.sources ?? [];
	$: if ((argument?.id ?? null) !== displayedBox) {
		sourceLimit = 8;
		displayedBox = argument?.id ?? null;
	}
	$: groups = [...new Set(sources.slice(0, sourceLimit).map((source) => source.documentTitle))].map(
		(title) => ({
			title,
			sources: sources.slice(0, sourceLimit).filter((source) => source.documentTitle === title)
		})
	);

	async function perform(action: () => Promise<unknown>) {
		busy = true;
		error = '';
		try {
			await action();
		} catch (e) {
			error = e instanceof Error ? e.message : 'CardMirror request failed.';
		} finally {
			busy = false;
		}
	}
	function downloadPlugin() {
		const link = document.createElement('a');
		link.href = '/integrations/cardmirror/plugin.js';
		link.download = 'flew-cardmirror-plugin.js';
		document.body.append(link);
		link.click();
		link.remove();
	}

	function copyArgument() {
		resolvePendingAction($nodes);
		const text = currentArgument()?.node.value.content ?? '';
		return perform(() => navigator.clipboard.writeText(text));
	}
	function selectAll(event: Event) {
		(event.target as HTMLTextAreaElement | null)?.select();
	}
	function excerpt(text: string) {
		const chars = Array.from(text);
		return chars.length > 160 ? chars.slice(0, 160).join('') + '…' : text;
	}
</script>

<section class="cardmirror-panel" aria-label="CardMirror integration">
	<PanelHeader
		name="CardMirror"
		detail={$cardMirror.state === 'connected'
			? 'connected'
			: $cardMirror.state === 'connecting'
			? 'Connecting…'
			: null}
	>
		<Button
			icon="dots"
			ariaLabel="CardMirror menu"
			tooltip="cardmirror menu"
			on:click={() =>
				openPopup(PanelMenu, 'CardMirror', {
					actions: [
						{
							label: 'Paste reply key',
							disabled: $cardMirror.state === 'connected',
							run: async () => {
								try {
									reply = await navigator.clipboard.readText();
								} catch {
									error = 'Could not read clipboard.';
								}
							}
						},
						{ label: 'Copy selected text', disabled: !argument, run: copyArgument }
					]
				})}
		/>

		{#if $cardMirror.state !== 'connected'}<Button
				icon="download"
				ariaLabel="Download CardMirror plugin"
				tooltip="download the plugin, then load it from CardMirror's plugin settings and run “Connect to Flew”"
				on:click={downloadPlugin}
			/>{/if}
		{#if $cardMirror.state !== 'disconnected'}<Button
				icon="delete"
				ariaLabel="Disconnect CardMirror"
				tooltip="disconnect"
				on:click={() => {
					disconnectCardMirror();
					reply = '';
				}}
			/>{/if}
	</PanelHeader>
	{#if $cardMirror.state !== 'connected'}
		<div class="steps">
			<Button
				icon="link"
				text="Create connection key"
				disabled={busy}
				on:click={() => perform(createCardMirrorOffer)}
			/>
			{#if $cardMirrorOffer}
				<PanelField
					multiline
					readonly
					ariaLabel="Flew connection key"
					value={$cardMirrorOffer}
					on:focus={selectAll}
				/>
				<Button
					icon="copy"
					text="Copy connection key"
					disabled={busy}
					on:click={() => perform(() => navigator.clipboard.writeText($cardMirrorOffer))}
				/>
				<PanelField
					multiline
					ariaLabel="CardMirror reply key"
					placeholder="paste CardMirror's reply key"
					spellcheck={false}
					bind:value={reply}
				/>
				<Button
					icon="link"
					text="Connect CardMirror"
					disabled={busy || !reply.trim()}
					on:click={() =>
						perform(async () => {
							await confirmCardMirror(reply);
							reply = '';
						})}
				/>
			{/if}
		</div>
	{:else}
		{#if $cardMirrorDocuments.sending}<PanelStatus>
				Sending {$cardMirrorDocuments.sending}: {$cardMirrorDocuments.progress}%
			</PanelStatus>
			<Button
				icon="delete"
				text="Cancel document transfer"
				on:click={cancelCardMirrorDocument}
			/>{/if}
		{#if $cardMirrorDocuments.checked && !$cardMirrorDocuments.supported}<PanelStatus>
				Opening SpeechDrop documents requires the updated plugin in the desktop app.
			</PanelStatus>{/if}
	{/if}
	{#if sources.length}
		<PanelHeader name="Selected argument" detail={sources.length ? String(sources.length) : null}>
			<Button
				icon="copy"
				ariaLabel="Copy argument text"
				tooltip="copy plain text to paste into your speech document"
				disabled={busy}
				on:click={copyArgument}
			/>
		</PanelHeader>
		{#each groups as group}
			<div class="source">
				<PanelStatus>{group.title || 'Untitled document'}</PanelStatus>
				{#each group.sources as source}<PanelRow
						ariaLabel="Jump to source"
						title={source.token
							? 'return to the original evidence in CardMirror'
							: 'saved evidence attached; original document link unavailable'}
						disabled={busy || $cardMirror.state !== 'connected' || !source.token}
						on:click={() => perform(() => jumpToCardMirror(source.token))}
						>{source.kind === 'cite' ? 'Citation: ' : ''}{excerpt(source.excerpt)}</PanelRow
					>{/each}
			</div>
		{/each}
		{#if sources.length > sourceLimit}<PanelRow weak on:click={() => (sourceLimit += 8)}
				>show {sources.length - sourceLimit} more</PanelRow
			>{/if}
	{/if}
	{#if error || $cardMirror.error}<PanelStatus error>{error || $cardMirror.error}</PanelStatus>{/if}
</section>

<style>
	.cardmirror-panel {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		min-width: 0;
	}
	.steps,
	.source {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.steps :global(.element) {
		width: auto;
		min-width: 0;
		max-width: 100%;
	}
	.steps :global(button.top) {
		max-width: 100%;
		box-sizing: border-box;
		height: auto;
		min-height: calc(var(--button-size) + var(--padding) * 2);
		white-space: normal;
		overflow-wrap: anywhere;
	}
</style>
