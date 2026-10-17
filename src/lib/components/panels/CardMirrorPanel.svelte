<script lang="ts">
	import Button from '../Button.svelte';
	import PanelPlaceholder from './PanelPlaceholder.svelte';
	import {
		cardMirror,
		cardMirrorOffer,
		createCardMirrorOffer,
		confirmCardMirror,
		disconnectCardMirror,
		jumpToCardMirror
	} from '$lib/models/cardMirror';
	import { focusId, lastFocusIds, selectedFlowId } from '$lib/models/focus';
	import { nodes } from '$lib/models/store';

	export let available = true;
	let reply = '';
	let busy = false;
	let error = '';
	$: target = $focusId ?? ($selectedFlowId ? $lastFocusIds[$selectedFlowId] : null);
	$: node = target ? $nodes[target] : null;
	$: sources = node?.value.tag === 'box' ? node.value.cardMirror?.sources ?? [] : [];
	$: page = $selectedFlowId ? $nodes[$selectedFlowId] : null;
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
</script>

{#if !available}
	<PanelPlaceholder name="CardMirror" />
{:else}
	<section class="cardmirror-panel palette-plain" aria-label="CardMirror integration">
		<h2>CardMirror</h2>
		<p class="muted">Send arguments from CardMirror to the selected cell in this page.</p>
		<p role="status">
			{$cardMirror.state === 'connected'
				? 'Connected to CardMirror'
				: $cardMirror.state === 'connecting'
				? 'Connecting…'
				: $cardMirror.state === 'pairing'
				? 'Waiting for CardMirror reply'
				: 'Not connected'}
		</p>
		{#if $cardMirror.state !== 'connected'}
			<p class="muted">
				Enable plugins in CardMirror’s settings and use Load plugin from file to load this companion
				plugin. Run “Connect to Flew” in CardMirror’s command palette.
			</p>
			<Button icon="download" text="Download CardMirror plugin" on:click={downloadPlugin} />
			<Button
				icon="link"
				text="Create connection key"
				disabled={busy}
				on:click={() => perform(createCardMirrorOffer)}
			/>
			{#if $cardMirrorOffer}
				<label
					>Flew connection key<textarea
						aria-label="Flew connection key"
						readonly
						value={$cardMirrorOffer}
						rows="3"
						on:focus={(e) => e.currentTarget.select()}
					/></label
				>
				<Button
					icon="copy"
					text="Copy connection key"
					on:click={() => perform(() => navigator.clipboard.writeText($cardMirrorOffer))}
				/>
				<label
					>CardMirror reply key<textarea
						aria-label="CardMirror reply key"
						bind:value={reply}
						rows="3"
						spellcheck="false"
					/></label
				>
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
		{:else}
			<p>Receiving in {page?.value.content || 'Untitled page'}</p>
			<p class="muted">
				CardMirror: Mod+Alt+F sends; Mod+Alt+E reveals a sent argument. Choose Flew Page changes the
				destination. Disable Ebb’s matching shortcuts if both plugins are enabled.
			</p>
			{#if $cardMirror.notice}<p class="muted">{$cardMirror.notice}</p>{/if}
		{/if}
		{#if $cardMirror.state !== 'disconnected'}
			<Button
				icon="delete"
				text="Disconnect CardMirror"
				on:click={() => {
					disconnectCardMirror();
					reply = '';
				}}
			/>
		{/if}
		{#if sources.length}
			<h3>Source in CardMirror</h3>
			{#each sources as source}
				<div class="source">
					<p>{source.documentTitle}</p>
					<p class="muted excerpt">{source.excerpt}</p>
					<Button
						icon="arrowRight"
						text="Jump to source"
						disabled={busy || $cardMirror.state !== 'connected'}
						on:click={() => perform(() => jumpToCardMirror(source.token))}
					/>
				</div>
			{/each}
		{/if}
		{#if error || $cardMirror.error}<p role="alert">{error || $cardMirror.error}</p>{/if}
	</section>
{/if}

<style>
	.cardmirror-panel {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}
	h2,
	h3,
	p {
		margin: 0;
	}
	h3 {
		font-size: inherit;
		font-weight: var(--font-weight);
	}
	.muted {
		color: var(--this-text-weak);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: var(--padding-small);
		resize: vertical;
		background: var(--this-background-indent);
		color: var(--this-text);
		border: none;
		border-radius: var(--border-radius-small);
	}
	.source {
		padding: var(--padding-small) 0;
	}
	.excerpt {
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
</style>
