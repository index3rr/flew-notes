<script lang="ts">
	import Button from '../Button.svelte';
	import PanelPlaceholder from './PanelPlaceholder.svelte';
	import {
		cardMirror,
		cardMirrorOffer,
		cardMirrorDestination,
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
	import type { FlowId, BoxId } from '$lib/models/node';
	import { getColumnName } from '$lib/models/node';
	import { resolvePendingAction } from '$lib/models/nodePendingAction';

	export let available = true;
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
	$: receivingId = $cardMirrorDestination?.flowId ?? $selectedFlowId;
	$: page = receivingId ? $nodes[receivingId] : null;
	$: column = $cardMirrorDestination
		? page?.value.columns[$cardMirrorDestination.column]
		: argument
		? getColumnName($nodes, argument.id)
		: page?.value.columns[0];
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
	function chooseDestination(id: string) {
		cardMirrorDestination.set(
			id
				? {
						flowId: id as FlowId,
						column: argument?.node.value.flowId === id ? argument.node.level - 1 : 0
				  }
				: null
		);
	}
	function copyArgument() {
		resolvePendingAction($nodes);
		const text = currentArgument()?.node.value.content ?? '';
		return perform(() => navigator.clipboard.writeText(text));
	}
	function excerpt(text: string) {
		const chars = Array.from(text);
		return chars.length > 160 ? chars.slice(0, 160).join('') + '…' : text;
	}
</script>

{#if !available}
	<PanelPlaceholder name="CardMirror" />
{:else}
	<section class="cardmirror-panel" aria-label="CardMirror integration">
		<div class="heading">
			<h2>CardMirror</h2>
			{#if $cardMirror.state !== 'disconnected'}<Button
					icon="delete"
					ariaLabel="Disconnect CardMirror"
					tooltip="Disconnect CardMirror"
					on:click={() => {
						disconnectCardMirror();
						reply = '';
					}}
				/>{/if}
		</div>
		<p class="status" role="status">
			{$cardMirror.state === 'connected'
				? 'Connected to CardMirror'
				: $cardMirror.state === 'connecting'
				? 'Connecting…'
				: $cardMirror.state === 'pairing'
				? 'Waiting for CardMirror reply'
				: 'Not connected'}
		</p>
		{#if $cardMirror.state !== 'connected'}
			<p>Send arguments and open SpeechDrop documents in the desktop app.</p>
			<details>
				<summary>Plugin setup</summary>
				<p>
					Enable plugins in CardMirror’s settings, then use Load plugin from file. Restart
					CardMirror before loading an updated plugin. Run “Connect to Flew” in its command palette.
				</p>
				<Button icon="download" text="Download CardMirror plugin" on:click={downloadPlugin} />
			</details>
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
					disabled={busy}
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
			<label
				>Receive in<select
					aria-label="CardMirror receiving page"
					value={$cardMirrorDestination?.flowId ?? ''}
					on:change={(e) => chooseDestination(e.currentTarget.value)}
				>
					<option value="">Follow selected cell</option>
					{#each $nodes.root.children as id}<option value={id}
							>{$nodes[id]?.value.content || 'Untitled page'}</option
						>{/each}
				</select></label
			>
			{#if $cardMirrorDestination && page}
				<label
					>Speech column<select
						aria-label="CardMirror receiving column"
						value={$cardMirrorDestination.column}
						on:change={(e) => {
							if ($cardMirrorDestination)
								cardMirrorDestination.set({
									...$cardMirrorDestination,
									column: Number(e.currentTarget.value)
								});
						}}
					>
						{#each page.value.columns as name, index}<option value={index}>{name}</option>{/each}
					</select></label
				>
			{/if}
			<p class="status">
				Receiving in {page?.value.content || 'Untitled page'}{column ? ` · ${column}` : ''}
			</p>
			{#if $cardMirrorDestination && page}<p class="hint">
					Pinned here while you browse other flows.
				</p>{:else if $cardMirrorDestination}<p role="alert">
					The pinned page was closed. Choose another destination or follow the selected cell.
				</p>{/if}
			{#if $cardMirror.notice}<p class="status" role="status">{$cardMirror.notice}</p>{/if}
			{#if $cardMirrorDocuments.sending}<p role="status">
					Sending {$cardMirrorDocuments.sending}: {$cardMirrorDocuments.progress}%
				</p>
				<Button
					icon="delete"
					text="Cancel document transfer"
					on:click={cancelCardMirrorDocument}
				/>{/if}
			<details>
				<summary>Commands and connection</summary>
				<p>
					Mod+Alt+F sends below the selected cell. “Send to Flew as responses” adds replies in the
					next speech column. Mod+Alt+E reveals a sent argument. Disable Ebb’s matching shortcuts if
					both plugins are enabled.
				</p>
				{#if $cardMirrorDocuments.checked && !$cardMirrorDocuments.supported}<p>
						Opening SpeechDrop documents requires the updated plugin in the desktop app.
					</p>{/if}
				<Button icon="download" text="Download CardMirror plugin" on:click={downloadPlugin} />
			</details>
		{/if}
		{#if argument}
			<div class="heading">
				<h3>Selected argument</h3>
				<Button
					icon="copy"
					ariaLabel="Copy argument text"
					tooltip="Copy plain text to paste into your speech document"
					disabled={busy}
					on:click={copyArgument}
				/>
			</div>
			{#each groups as group}
				<div class="source">
					<p class="status">{group.title || 'Untitled document'}</p>
					{#each group.sources as source}<Button
							icon="arrowRight"
							text={`${source.kind === 'cite' ? 'Citation: ' : ''}${excerpt(source.excerpt)}`}
							ariaLabel="Jump to source"
							tooltip="Return to the original evidence in CardMirror"
							disabled={busy || $cardMirror.state !== 'connected'}
							disabledReason="Connect CardMirror first"
							on:click={() => perform(() => jumpToCardMirror(source.token))}
						/>{/each}
				</div>
			{/each}
			{#if sources.length > sourceLimit}<Button
					icon="arrowDown"
					text={`Show more sources (${sources.length - sourceLimit})`}
					on:click={() => (sourceLimit += 8)}
				/>{/if}
		{/if}
		{#if error || $cardMirror.error}<p role="alert">{error || $cardMirror.error}</p>{/if}
	</section>
{/if}

<style>
	.cardmirror-panel {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		min-width: 0;
	}
	.heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
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
	p {
		overflow-wrap: anywhere;
	}
	.status,
	.hint {
		color: var(--text-weak);
		font-size: 0.85em;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	textarea,
	select {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		padding: var(--padding);
		font: inherit;
		background: var(--background-indent);
		color: var(--text);
		border: none;
		border-radius: var(--border-radius);
		outline: none;
		transition: background var(--transition-speed);
	}
	textarea:focus,
	select:focus {
		background: var(--background-active);
	}
	textarea {
		resize: vertical;
	}
	.source {
		padding: var(--padding-small) 0;
	}
	details p {
		padding: var(--padding-small) 0;
		color: var(--text-weak);
	}
	summary {
		padding: var(--padding-small) 0;
	}
	.cardmirror-panel :global(.element) {
		width: auto;
		min-width: 0;
		max-width: 100%;
	}
	.cardmirror-panel :global(button.top) {
		max-width: 100%;
		box-sizing: border-box;
		height: auto;
		min-height: calc(var(--button-size) + var(--padding) * 2);
		white-space: normal;
		overflow-wrap: anywhere;
	}
</style>
