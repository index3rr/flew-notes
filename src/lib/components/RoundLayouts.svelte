<script lang="ts">
	import { tick } from 'svelte';
	import Button from './Button.svelte';
	import PanelField from './panels/PanelField.svelte';
	import { panelIds, panelNames } from '$lib/models/panels';
	import {
		applyRoundLayout,
		readRoundLayouts,
		removeRoundLayout,
		saveRoundLayout,
		updateRoundLayout,
		type RoundLayout
	} from '$lib/models/roundLayouts';
	import { settings } from '$lib/models/settings';

	export let closePopup: () => void;
	let region: HTMLElement;
	let layouts = readRoundLayouts();
	let newName = '';
	let editingId: string | null = null;
	let editedName = '';
	let status = '';
	let error = '';

	function change(action: () => RoundLayout[], message: string) {
		status = '';
		error = '';
		try {
			layouts = action();
			status = message;
			return true;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not save layouts in this browser.';
			return false;
		}
	}

	function add() {
		if (change(() => saveRoundLayout(newName), `Saved ${newName.trim()}.`)) newName = '';
	}

	async function startRename(layout: RoundLayout) {
		editingId = layout.id;
		editedName = layout.name;
		status = '';
		error = '';
		await tick();
		const input = region.querySelector<HTMLInputElement>('.rename input');
		input?.focus();
		input?.select();
	}

	function rename(layout: RoundLayout) {
		if (
			change(
				() => updateRoundLayout(layout.id, { name: editedName }),
				`Renamed to ${editedName.trim()}.`
			)
		)
			editingId = null;
	}

	function remove(layout: RoundLayout) {
		if (confirm(`Delete the “${layout.name}” layout?`))
			change(() => removeRoundLayout(layout.id), `Deleted ${layout.name}.`);
	}

	function apply(layout: RoundLayout) {
		if (applyRoundLayout(layout)) closePopup();
		else {
			status = '';
			error = 'Layout applied for this session. The browser could not save your settings.';
		}
	}

	function describePanels({ values }: RoundLayout) {
		const names = panelIds
			.filter((id) => values[id])
			.map((id) => `${panelNames[id]}${Number(values[id]) >= 3 ? ' (collapsed)' : ''}`);
		return names.join(' · ') || 'No panels';
	}
</script>

<section
	aria-label="Round layouts"
	class="layouts palette-plain"
	class:customScrollbar={settings.data.customScrollbar.value}
	bind:this={region}
>
	<form class="controls" on:submit|preventDefault={add}>
		<div class="name-field">
			<PanelField ariaLabel="New layout name" placeholder="Layout name" bind:value={newName} />
		</div>
		<Button icon="add" text="Save current layout" disabled={!newName.trim()} />
	</form>
	{#if error}<p role="alert">{error}</p>{:else if status}<p role="status">{status}</p>{/if}
	{#if layouts.length}<p>
			Moving or turning off a panel can stop its tools. Collapse it on its current side to keep it
			running.
		</p>{/if}
	<ul class="saved-layouts">
		{#each layouts as layout (layout.id)}
			<li class="layout palette-plain-secondary">
				{#if editingId === layout.id}
					<form class="controls rename" on:submit|preventDefault={() => rename(layout)}>
						<div class="name-field">
							<PanelField ariaLabel="Layout name" bind:value={editedName} />
						</div>
						<Button
							icon="check"
							ariaLabel="Save layout name"
							tooltip="save name"
							disabled={!editedName.trim()}
						/>
						<Button
							icon="delete"
							ariaLabel="Cancel rename"
							tooltip="cancel rename"
							on:click={(event) => {
								event.preventDefault();
								editingId = null;
							}}
						/>
					</form>
				{:else}
					<div class="layout-label">
						<strong>{layout.name}</strong>
						<p>{describePanels(layout)}</p>
					</div>
					<div class="controls">
						<Button
							icon="check"
							text="Apply"
							ariaLabel={`Apply ${layout.name} layout`}
							on:click={() => apply(layout)}
						/>
						<Button
							icon="save"
							ariaLabel={`Update ${layout.name} from current layout`}
							tooltip="update from current layout"
							on:click={() =>
								change(
									() => updateRoundLayout(layout.id, { capture: true }),
									`Updated ${layout.name}.`
								)}
						/>
						<Button
							icon="edit"
							ariaLabel={`Rename ${layout.name} layout`}
							tooltip="rename layout"
							on:click={() => startRename(layout)}
						/>
						<Button
							icon="trash"
							ariaLabel={`Delete ${layout.name} layout`}
							tooltip="delete layout"
							on:click={() => remove(layout)}
						/>
					</div>
				{/if}
			</li>
		{:else}
			<li class="empty">No saved layouts.</li>
		{/each}
	</ul>
</section>

<style>
	.layouts {
		width: min(calc(100vw - var(--padding-big)), 34em);
		max-height: calc(100vh - var(--padding-big));
		box-sizing: border-box;
		overflow: auto;
		padding: calc(var(--button-size) + var(--padding-big)) var(--padding-big) var(--padding-big);
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
	p,
	.empty {
		margin: 0;
		color: var(--text-weak);
		font-size: 0.85em;
		overflow-wrap: anywhere;
	}
	p[role='alert'] {
		color: var(--text-error);
	}
	.saved-layouts {
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--padding-small);
		list-style: none;
	}
	.layout,
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--padding-small);
		min-width: 0;
	}
	.layout {
		justify-content: space-between;
		padding: var(--padding);
		background: var(--this-background);
		border-radius: var(--border-radius);
	}
	.layout-label,
	.name-field {
		flex: 1 1 12ch;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.rename {
		flex: 1;
	}
	.controls :global(.element) {
		max-width: 100%;
	}
	.controls :global(button.top) {
		box-sizing: border-box;
		min-height: calc(var(--button-size) + var(--padding-big));
		max-width: 100%;
		height: auto;
		white-space: normal;
		overflow-wrap: anywhere;
	}
</style>
