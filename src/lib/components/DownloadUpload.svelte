<script lang="ts">
	import { onDestroy } from 'svelte';
	import Button from './Button.svelte';
	import { downloadJson, downloadXlsx, downloadSettingsJson } from '$lib/models/file';
	import { documentOpen } from '$lib/models/document';
	import { nodes, frozen } from '$lib/models/store';
	import { resolvePendingAction } from '$lib/models/nodePendingAction';
	import { saveDocument } from '$lib/models/autoSave';
	import { library } from '$lib/models/flowLibrary';
	import { settings } from '$lib/models/settings';
	export let closePopup: () => void;
	let busy = false;
	let error = '';
	let customScrollbar = false;
	onDestroy(
		settings.subscribe(
			['customScrollbar'],
			() => (customScrollbar = Boolean(settings.data.customScrollbar.value))
		)
	);
	async function run(action: () => unknown | Promise<unknown>) {
		busy = true;
		error = '';
		try {
			resolvePendingAction($nodes);
			await action();
			closePopup();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not complete the file action.';
		} finally {
			busy = false;
		}
	}
	function openFile() {
		(document.getElementById('chooseFlowFile') as HTMLInputElement).click();
		closePopup();
	}
</script>

<section class="files palette-plain" class:customScrollbar aria-label="Flow files">
	<div class="group">
		<h2>Open</h2>
		<Button
			icon="open"
			text="Open flow or import settings"
			ariaLabel="Open flow or import settings"
			on:click={openFile}
			disabled={busy || $frozen}
		/>
		<p>You can also drop a JSON file into the app.</p>
	</div>
	<div class="group secondary">
		<h2>Save and export</h2>
		<p>
			Flows save automatically {$library.connected && !$library.imported
				? 'to your linked folder'
				: 'in this browser'}.
		</p>
		{#if $library.connected && !$library.imported}
			<Button
				icon="save"
				text="Save to linked folder"
				disabled={!$documentOpen || busy || $frozen}
				on:click={() => run(() => saveDocument())}
			/>
			<Button
				icon="copy"
				text="Save a copy to linked folder"
				disabled={!$documentOpen || busy || $frozen}
				on:click={() => run(() => saveDocument(true))}
			/>
		{/if}
		<Button
			icon="download"
			text="Download JSON copy"
			ariaLabel="Download JSON copy"
			disabled={!$documentOpen || busy || $frozen}
			disabledReason="Open a flow first"
			tooltip="keeps every page, attached card and note for reopening in Flew"
			on:click={() => run(() => downloadJson($nodes))}
		/>
		<Button
			icon="download"
			text="Export Excel workbook"
			ariaLabel="Export Excel workbook"
			disabled={!$nodes.root.children.length || busy || $frozen}
			disabledReason="Add a flow page first"
			tooltip="exports one worksheet per page for viewing in a spreadsheet"
			on:click={() => run(() => downloadXlsx($nodes))}
		/>
	</div>
	<div class="group">
		<h2>Settings</h2>
		<Button
			icon="gear"
			text="Export settings"
			ariaLabel="Export settings"
			disabled={busy}
			on:click={() => run(downloadSettingsJson)}
		/>
	</div>
	{#if error}<p role="alert">{error}</p>{/if}
</section>

<style>
	.files {
		width: min(calc(100vw - var(--padding-big)), 36em);
		max-height: calc(100vh - var(--padding-big));
		padding-top: calc(var(--button-size) + var(--padding-big));
		box-sizing: border-box;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
	.group {
		padding: var(--padding);
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.secondary {
		background: var(--background-secondary);
		border-radius: var(--border-radius);
	}
	h2 {
		font-size: 1em;
		padding-inline: var(--padding);
	}
	p {
		margin: 0;
		padding-inline: var(--padding);
		color: var(--text-weak);
		font-size: 0.85em;
		line-height: 1.6;
	}
	p[role='alert'] {
		color: var(--text-error);
	}
	.files :global(.element) {
		width: 100%;
	}
	.files :global(button.top) {
		box-sizing: border-box;
		width: 100%;
		height: auto;
		min-height: calc(var(--button-size) + var(--padding) * 2);
		justify-content: flex-start;
		text-align: left;
		white-space: normal;
		overflow-wrap: anywhere;
	}
</style>
