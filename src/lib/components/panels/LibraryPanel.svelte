<script lang="ts">
	const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

	import { importLocalFlows } from '$lib/models/autoSave';
	import PanelHeader from './PanelHeader.svelte';
	import PanelRow from './PanelRow.svelte';
	import PanelStatus from './PanelStatus.svelte';
	import LibraryPanelRow from './LibraryPanelRow.svelte';
	import { savedNodesDatas } from '$lib/models/autoSave';
	import { settings } from '$lib/models/settings';
	import {
		library,
		refreshLibrary,
		readLibraryFile,
		directFolderAccess
	} from '$lib/models/flowLibrary';
	let filesInput: HTMLInputElement;
	let error = '';
	async function navigate(path: string[]) {
		try {
			await refreshLibrary(path);
			error = '';
		} catch (cause) {
			error = errorMessage(cause);
		}
	}
	$: saved = Object.entries($savedNodesDatas).sort(
		(a, b) => Date.parse(b[1].modified) - Date.parse(a[1].modified)
	);
	function panelActions() {
		return [{ label: 'Import flow files', run: () => filesInput.click() }];
	}
</script>

<section class="library-panel" aria-label="Flow library panel">
	<PanelHeader
		name="Flow library"
		detail={directFolderAccess && $library.name
			? [$library.name, ...$library.path].join('/')
			: null}
		tooltip="drag into flow tabs or into the flow"
		actions={panelActions}
	/>
	<input
		bind:this={filesInput}
		type="file"
		accept=".json"
		multiple
		hidden
		on:change={async () => {
			try {
				await importLocalFlows(
					await Promise.all(
						Array.from(filesInput.files ?? []).map(async (file) => ({
							name: file.name,
							raw: await file.text()
						}))
					)
				);
			} catch (cause) {
				error = errorMessage(cause);
			}
			filesInput.value = '';
		}}
	/>
	{#if error}<PanelStatus error>{error}</PanelStatus>{/if}
	<div class="list" class:customScrollbar={settings.data.customScrollbar.value}>
		{#if directFolderAccess && $library.name}
			{#if $library.path.length}<PanelRow
					weak
					ariaLabel="Up one folder"
					on:click={() => navigate($library.path.slice(0, -1))}>../</PanelRow
				>{/if}
			{#each $library.folders as name}<PanelRow on:click={() => navigate([...$library.path, name])}
					>{name}/</PanelRow
				>{/each}
			{#each $library.files as name, index (name)}
				<LibraryPanelRow
					flowData={$library.fileInfos[name]}
					alternate={index % 2 === 1}
					read={async () => (await readLibraryFile(name)).raw}
				/>
			{/each}
		{:else}
			{#each saved as [key, flowData], index (key)}
				<LibraryPanelRow
					{flowData}
					alternate={index % 2 === 1}
					read={async () => {
						const raw = localStorage.getItem(key);
						if (!raw) throw new Error('This saved flow is no longer available');
						return raw;
					}}
				/>
			{:else}
				<PanelStatus>No saved flows yet.</PanelStatus>
			{/each}
		{/if}
	</div>
</section>

<style>
	.library-panel {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		min-height: 0;
		flex: 1;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		overflow: auto;
		min-height: 0;
	}
</style>
