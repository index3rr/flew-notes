<script lang="ts">
	import { panelDrop } from '$lib/models/panelDrop';
	import {
		boxesMime,
		pagesMime,
		fileMime,
		selectionRoots,
		readPageDrag,
		droppedDocument
	} from '$lib/models/panelDrag';
	import { serializeBoxSubtree } from '$lib/models/node';
	import { selectedBoxIds } from '$lib/models/selection';
	import { sendToCardMirror, openCardMirrorDocument } from '$lib/models/cardMirror';
	import { readEvidenceTransfer, evidenceMime } from '$lib/integrations/cardmirror/clipboard';
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
	async function sendSelection(speech = false) {
		resolvePendingAction($nodes);
		const ids = $selectedBoxIds.size ? $selectedBoxIds : argument ? [argument.id] : [];
		await perform(() =>
			sendToCardMirror(
				selectionRoots($nodes, ids).map((id) => serializeBoxSubtree($nodes, id)),
				speech
			)
		);
	}
	async function drop(event: DragEvent, speech = false) {
		event.preventDefault();
		event.stopPropagation();
		if ($cardMirror.state !== 'connected') return;
		await perform(async () => {
			const transfer = event.dataTransfer;
			if (!transfer) return;
			const pages = transfer.getData(pagesMime),
				boxes = transfer.getData(boxesMime);
			if (pages) {
				const { source, ids } = readPageDrag(pages);
				await sendToCardMirror(
					ids.flatMap((id) =>
						source[id]!.children.map((child) => serializeBoxSubtree(source, child))
					),
					speech
				);
			} else if (boxes) await sendToCardMirror(JSON.parse(boxes).boxes, speech);
			else if (transfer.types.includes(evidenceMime) || transfer.types.includes('text/html'))
				await sendToCardMirror(readEvidenceTransfer(transfer), speech);
			else {
				const file = await droppedDocument(event);
				if (file) await openCardMirrorDocument(file.name, file.blob);
			}
		});
	}
	function panelActions() {
		return [
			...($cardMirror.state !== 'connected'
				? [
						{ label: 'Download companion plugin', run: downloadPlugin },
						{
							label: 'Paste reply key',
							run: async () => {
								try {
									reply = await navigator.clipboard.readText();
								} catch {
									error = 'Could not read clipboard.';
								}
							}
						}
				  ]
				: []),
			...(argument ? [{ label: 'Copy selected text', run: copyArgument }] : []),
			...($cardMirror.state === 'connected' && argument
				? [
						{
							label: 'Send selected arguments to current document',
							run: () => sendSelection(false)
						},
						{ label: 'Send selected arguments to speech document', run: () => sendSelection(true) }
				  ]
				: []),
			...($cardMirror.state !== 'disconnected'
				? [{ label: 'Disconnect', run: disconnectCardMirror }]
				: [])
		];
	}
</script>

<section
	class="cardmirror-panel"
	aria-label="CardMirror integration"
	use:panelDrop={{
		types: [boxesMime, pagesMime, fileMime, evidenceMime, 'text/html', 'Files'],
		disabled: $cardMirror.state !== 'connected'
	}}
	on:drop={(event) => drop(event)}
>
	<PanelHeader
		name="CardMirror"
		detail={$cardMirror.state === 'connected'
			? 'connected'
			: $cardMirror.state === 'connecting'
			? 'Connecting…'
			: null}
		actions={panelActions}
	/>
	{#if $cardMirror.state === 'connected'}<div class="send-targets">
			<div class="transfer-target" role="region" aria-label="Send to current document">
				<span>current document</span>{#if argument}<Button
						icon="addRight"
						ariaLabel="Send selected arguments to current document"
						on:click={() => sendSelection(false)}
					/>{/if}
			</div>
			<div
				class="transfer-target"
				role="region"
				aria-label="Send to speech document"
				use:panelDrop={{ types: [boxesMime, pagesMime, evidenceMime, 'text/html'] }}
				on:drop={(event) => drop(event, true)}
			>
				<span>speech document</span>{#if argument}<Button
						icon="addRight"
						ariaLabel="Send selected arguments to speech document"
						on:click={() => sendSelection(true)}
					/>{/if}
			</div>
		</div>{/if}
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
		{#each groups as group}
			<div class="source">
				<PanelStatus>{group.title || 'Untitled document'}</PanelStatus>
				{#each group.sources as source}{#if source.token && $cardMirror.state === 'connected'}<PanelRow
							ariaLabel="Jump to source"
							title="return to the original evidence"
							on:click={() => perform(() => jumpToCardMirror(source.token))}
							>{excerpt(source.excerpt)}</PanelRow
						>{:else}<PanelStatus>{excerpt(source.excerpt)}</PanelStatus>{/if}{/each}
			</div>
		{/each}
		{#if sources.length > sourceLimit}<PanelRow weak on:click={() => (sourceLimit += 8)}
				>show {sources.length - sourceLimit} more</PanelRow
			>{/if}
	{/if}
	{#if error || $cardMirror.error}<PanelStatus error>{error || $cardMirror.error}</PanelStatus>{/if}
</section>

<style>
	.send-targets {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.transfer-target {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--background-indent);
		padding: var(--padding);
		border-radius: var(--border-radius-small);
		font-size: 0.85em;
		color: var(--text-weak);
	}
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
