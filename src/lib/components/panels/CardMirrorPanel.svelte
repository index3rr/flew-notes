<script lang="ts">
	import Button from '../Button.svelte';
	import PanelHeader from './PanelHeader.svelte';
	import PanelField from './PanelField.svelte';
	import PanelRow from './PanelRow.svelte';
	import PanelStatus from './PanelStatus.svelte';
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
	function selectAll(event: Event) {
		(event.target as HTMLTextAreaElement | null)?.select();
	}
	function excerpt(text: string) {
		const chars = Array.from(text);
		return chars.length > 160 ? chars.slice(0, 160).join('') + '…' : text;
	}
</script>

<section class="cardmirror-panel" aria-label="CardMirror integration">
	<PanelHeader name="CardMirror">
		<Button
			icon="download"
			ariaLabel="Download CardMirror plugin"
			tooltip="download the plugin, then load it from CardMirror's plugin settings and run “Connect to Flew”"
			on:click={downloadPlugin}
		/>
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
	<PanelStatus>
		{$cardMirror.state === 'connected'
			? 'Connected to CardMirror'
			: $cardMirror.state === 'connecting'
			? 'Connecting…'
			: $cardMirror.state === 'pairing'
			? 'Waiting for CardMirror reply'
			: 'Not connected'}
	</PanelStatus>
	{#if $cardMirror.state !== 'connected'}
		<PanelStatus>Send arguments and open SpeechDrop documents in the desktop app.</PanelStatus>
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
		<div class="destination">
			<select
				aria-label="CardMirror receiving page"
				value={$cardMirrorDestination?.flowId ?? ''}
				on:change={(e) => chooseDestination(e.currentTarget.value)}
			>
				<option value="">follow selected cell</option>
				{#each $nodes.root.children as id}<option value={id}
						>{$nodes[id]?.value.content || 'Untitled page'}</option
					>{/each}
			</select>
			{#if $cardMirrorDestination && page}
				<select
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
				</select>
			{/if}
		</div>
		{#if $cardMirrorDestination && !page}<PanelStatus error>
				The pinned page was closed. Choose another destination or follow the selected cell.
			</PanelStatus>{:else}<PanelStatus>
				Receiving in {page?.value.content || 'Untitled page'}{column
					? ` · ${column}`
					: ''}{$cardMirrorDestination ? ', pinned while you browse other flows' : ''}
			</PanelStatus>{/if}
		{#if $cardMirror.notice}<PanelStatus>{$cardMirror.notice}</PanelStatus>{/if}
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
	{#if argument}
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
						title="return to the original evidence in CardMirror"
						disabled={busy || $cardMirror.state !== 'connected'}
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
	.destination,
	.source {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
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
	select:focus {
		background: var(--background-active);
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
