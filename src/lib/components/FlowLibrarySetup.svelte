<script lang="ts">
	import Button from './Button.svelte';
	import {
		directFolderAccess,
		chooseLibrary,
		disconnectLibrary,
		refreshLibrary,
		reconnectLibrary,
		importLibrary,
		library
	} from '$lib/models/flowLibrary';
	import { maybeSaveNodes, saveBeforeSwitch } from '$lib/models/autoSave';
	import { frozen } from '$lib/models/store';

	export let busy = false;
	export let error = '';
	let folderInput: HTMLInputElement;
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
	async function pickFolder() {
		if (!directFolderAccess) {
			return folderInput.click();
		}
		if (busy) return;
		busy = true;
		error = '';
		try {
			if (await chooseLibrary(saveBeforeSwitch)) maybeSaveNodes();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}
	async function importFolder() {
		const files = folderInput.files;
		if (!files?.length || busy) return;
		busy = true;
		error = '';
		try {
			await saveBeforeSwitch();
			await importLibrary(files);
			maybeSaveNodes();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
			folderInput.value = '';
		}
	}
</script>

<section class="setup" aria-label="Flow library setup">
	<div class="heading">
		<h1>Flow library</h1>
		<Button
			icon={directFolderAccess && $library.name ? 'delete' : 'upload'}
			ariaLabel={directFolderAccess
				? $library.name
					? 'Disconnect'
					: 'link a folder for automatic disk saves'
				: 'Import folder'}
			tooltip={directFolderAccess && $library.name
				? 'Disconnect this folder'
				: directFolderAccess
				? 'link a folder for automatic disk saves'
				: 'Import flows from a folder'}
			disabled={busy || $frozen}
			disabledReason="library is busy"
			on:click={() => (directFolderAccess && $library.name ? run(disconnectLibrary) : pickFolder())}
		/>
		{#if directFolderAccess && $library.name}
			<Button
				icon="undo"
				ariaLabel={$library.needsPermission ? 'Reconnect folder' : 'Refresh'}
				tooltip={$library.needsPermission
					? 'Allow access to this folder'
					: 'Refresh folder contents'}
				disabled={busy || $frozen}
				on:click={() =>
					run(() => ($library.needsPermission ? reconnectLibrary() : refreshLibrary()))}
			/>
		{/if}
	</div>
	<input
		bind:this={folderInput}
		aria-label="Import flow folder"
		type="file"
		{...{ webkitdirectory: true }}
		multiple
		hidden
		on:change={importFolder}
	/>
	{#if !directFolderAccess && $library.warning}<p role="status">{$library.warning}</p>{/if}
	{#if error}<p role="alert">{error}</p>{/if}
</section>

<style>
	.setup {
		padding: var(--padding-big);
		background: var(--background);
		border-radius: var(--border-radius);
	}
	.heading {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--padding-big);
	}
	p {
		color: var(--text-weak);
		margin: var(--padding) 0 0;
		line-height: 1.5;
		max-width: 65ch;
	}
</style>
