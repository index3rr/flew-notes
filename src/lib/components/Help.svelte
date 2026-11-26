<script lang="ts">
	import { openPopup } from '$lib/models/popup';
	import { panelIds, panelNames } from '$lib/models/panels';
	import { isChangelogVersionCurrent } from '$lib/models/version';
	import Shortcuts from './Shortcuts.svelte';
	import Button from './Button.svelte';
	import Changelog from './Changelog.svelte';
	import PanelMenu from './panels/PanelMenu.svelte';
	import { startTutorial, startPanelTutorial } from '$lib/models/tutorial';
	import { closeDocument } from '$lib/models/autoSave';
	import { tutorialStep } from '$lib/models/store';
	export let closePopup: () => void;
	let error = '';
	async function restartTutorial() {
		try {
			if (!(await closeDocument())) return;
			tutorialStep.set(0);
			startTutorial();
			closePopup();
		} catch (cause) {
			error = (cause as Error).message;
		}
	}
	function guides() {
		closePopup();
		openPopup(PanelMenu, 'Panel tutorials', {
			actions: panelIds.map((panel) => ({
				label: panelNames[panel],
				run: () => startPanelTutorial(panel)
			}))
		});
	}
	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			error = 'Could not copy. Please allow clipboard access.';
		}
	}
</script>

<div class="help palette-plain">
	<div class="help-actions">
		<Button icon="undo" text="start tutorial" on:click={restartTutorial} />
		<Button icon="screen" text="panel tutorials" on:click={guides} />
		<Button
			icon="keyboard"
			text="shortcuts"
			on:click={() => {
				closePopup();
				openPopup(Shortcuts, 'Shortcuts');
			}}
		/>
		<Button
			icon="delta"
			text="changelog"
			notification={!$isChangelogVersionCurrent}
			on:click={() => {
				closePopup();
				openPopup(Changelog, 'Changelog');
			}}
		/>
		<Button icon="home" text="home page" link="/" on:click={closePopup} />
		<Button
			icon="angleBrackets"
			text="source code"
			link="https://github.com/index3rr/flew-notes"
			target="_blank"
		/>
		<Button
			icon="copy"
			text="discord"
			tooltip="copy discord username"
			on:click={() => copy('indexerr')}
		/>
		<Button
			icon="copy"
			text="email"
			tooltip="copy email address"
			on:click={() => copy('striped_dibble_0j@icloud.com')}
		/>
	</div>
	<div class="feedback">
		<Button
			icon="open"
			text="report a bug or suggest a feature"
			link="https://github.com/index3rr/flew-notes/issues/new"
			target="_blank"
		/>
	</div>
	{#if error}<p role="alert">{error}</p>{/if}
</div>

<style>
	.help {
		width: min(calc(100vw - var(--padding-big)), 38em);
		max-height: calc(100vh - var(--padding-big));
		overflow-y: auto;
		box-sizing: border-box;
		padding: calc(var(--button-size) + var(--padding-big)) var(--padding-big) var(--padding-big);
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
	.help-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--padding);
	}
	.help-actions > :global(.element),
	.feedback > :global(.element) {
		width: 100%;
	}
	.help :global(button.top),
	.help :global(a.top) {
		box-sizing: border-box;
		width: 100%;
		justify-content: flex-start;
		min-height: calc(var(--button-size) + var(--padding-big));
		height: auto;
		white-space: normal;
		text-align: left;
		overflow-wrap: anywhere;
	}
	.help :global(button.top svg) {
		flex: 0 0 var(--button-size);
	}
	@media (max-width: 600px) {
		.help-actions {
			grid-template-columns: 1fr;
		}
	}
	.feedback {
		display: flex;
		background: var(--background-secondary);
		border-radius: var(--border-radius);
	}
	p {
		color: var(--text-error);
		font-size: 0.85em;
		margin: 0;
	}
</style>
