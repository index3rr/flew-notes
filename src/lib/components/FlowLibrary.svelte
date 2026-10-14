<script lang="ts">
	import Button from './Button.svelte';
	import FlowCard from './FlowCard.svelte';
	import {
		library,
		directFolderAccess,
		refreshLibrary,
		readLibraryFile,
		deleteLibraryFile
	} from '$lib/models/flowLibrary';
	import { openDocument, saveBeforeSwitch } from '$lib/models/autoSave';
	import { downloadString } from '$lib/models/file';
	import { frozen } from '$lib/models/store';
	export let busy = false;
	export let error = '';
	async function run(action: () => Promise<unknown>) {
		if (busy) return;
		busy = true;
		error = '';
		try {
			await action();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}
	async function open(name: string, duplicate = false) {
		await saveBeforeSwitch();
		const file = await readLibraryFile(name);
		await openDocument(file.raw, { target: file.target, duplicate });
	}
</script>

<section aria-label="Flow library" class="library">
	{#if $library.name}
		{#if $library.connected}
			{#each $library.folders as name}
				<Button
					icon="folder"
					text={name}
					disabled={busy}
					on:click={() => run(() => refreshLibrary([...$library.path, name]))}
				/>
			{/each}
			{#each $library.files as name, index}
				<FlowCard flowData={$library.fileInfos[name]} filename={name} alternate={index % 2 === 1}>
					<Button
						icon="open"
						text="open"
						ariaLabel="Open"
						disabled={busy || $frozen}
						on:click={() => run(() => open(name))}
					/>
					<Button
						icon="copy"
						text="duplicate"
						ariaLabel="Duplicate"
						disabled={busy || $frozen}
						on:click={() => run(() => open(name, true))}
					/>
					<Button
						icon="download"
						text="download"
						ariaLabel="Download"
						disabled={busy}
						on:click={() =>
							run(async () => {
								const file = await readLibraryFile(name);
								downloadString(file.raw, name);
							})}
					/>
					{#if directFolderAccess}
						<Button
							icon="trash"
							text="delete"
							ariaLabel="Delete"
							disabled={busy}
							on:click={() => {
								if (confirm(`Delete ${name}? This cannot be undone.`))
									void run(async () => {
										await saveBeforeSwitch();
										await deleteLibraryFile(name);
									});
							}}
						/>
					{/if}
				</FlowCard>
			{/each}
			{#if !$library.files.length && !$library.folders.length}<p>
					No flow files in this folder.
				</p>{/if}
		{/if}
	{/if}
	{#if $library.warning}<p role="status">{$library.warning}</p>{/if}
</section>

<style>
	.library {
		display: flex;
		flex-direction: column;
		gap: var(--padding-big);
	}
	.library:empty {
		display: none;
	}
	p {
		color: var(--text-weak);
		margin: 0;
		line-height: 1.5;
	}
</style>
