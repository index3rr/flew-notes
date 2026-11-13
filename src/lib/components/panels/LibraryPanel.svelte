<script lang="ts">
	import PanelPlaceholder from './PanelPlaceholder.svelte';
	import LibraryPanelRow from './LibraryPanelRow.svelte';
	import { savedNodesDatas } from '$lib/models/autoSave';
	import {
		library,
		refreshLibrary,
		readLibraryFile,
		directFolderAccess
	} from '$lib/models/flowLibrary';
	export let available = true;
	let error = '';
	async function navigate(path: string[]) {
		try {
			await refreshLibrary(path);
			error = '';
		} catch (cause) {
			error = (cause as Error).message;
		}
	}
	$: saved = Object.entries($savedNodesDatas).sort(
		(a, b) => Date.parse(b[1].modified) - Date.parse(a[1].modified)
	);
</script>

<section class="library-panel" aria-label="Flow library panel">
	{#if !available}
		<PanelPlaceholder name="Flow library" />
	{:else}
		{#if error}<p role="alert">{error}</p>{/if}
		{#if directFolderAccess && $library.name}
			{#if $library.path.length}<button
					class="folder"
					aria-label="Up one folder"
					on:click={() => navigate($library.path.slice(0, -1))}>../</button
				>{/if}
			{#each $library.folders as name}<button
					class="folder"
					on:click={() => navigate([...$library.path, name])}>{name}/</button
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
			{/each}
		{/if}
	{/if}
</section>

<style>
	.library-panel {
		overflow: auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.folder {
		border: none;
		background: none;
		color: var(--text);
		text-align: left;
		font: inherit;
		padding: var(--padding);
		border-radius: var(--border-radius);
		transition: background var(--transition-speed);
	}
	.folder:hover {
		background: var(--background-indent);
	}
	.folder:active {
		transition: none;
		background: var(--background-active);
	}
	p {
		margin: 0;
		color: var(--text-weak);
	}
</style>
