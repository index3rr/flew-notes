<script lang="ts">
	import { onDestroy } from 'svelte';
	import Button from './Button.svelte';
	import Setting from './Setting.svelte';
	import { settings, SETTINGS_VERSION, type Setting as SettingData } from '$lib/models/settings';
	import { completeSetup, setupPending } from '$lib/models/tutorial';
	import { panelHelp } from '$lib/models/panelHelp';
	import { flushSettingChanges } from '$lib/models/telemetry';
	export let closePopup: () => void;
	if (settings.data.colorTheme.value === 0)
		settings.setValue('colorTheme', matchMedia('(prefers-color-scheme: dark)').matches ? 2 : 1);
	let error = '';
	let input: HTMLInputElement;
	const choices: { key: string; enabledPosition: number; setting: SettingData }[] = [
		{
			key: 'timersPanel',
			enabledPosition: 3,
			setting: {
				name: 'Timers panel',
				type: 'toggle',
				auto: true,
				value: Number(settings.data.timersPanel.value) !== 0,
				info: panelHelp.timersPanel.summary
			}
		},
		{
			key: 'notesPanel',
			enabledPosition: 2,
			setting: {
				name: 'Notes panel',
				type: 'toggle',
				auto: false,
				value: Number(settings.data.notesPanel.value) !== 0,
				info: panelHelp.notesPanel.summary
			}
		},
		{
			key: 'speechDropPanel',
			enabledPosition: 2,
			setting: {
				name: 'SpeechDrop panel',
				type: 'toggle',
				auto: false,
				value: Number(settings.data.speechDropPanel.value) !== 0,
				info: panelHelp.speechDropPanel.summary
			}
		}
	];
	const theme: SettingData = {
		name: 'Color theme',
		type: 'radio',
		auto: 0,
		value: settings.data.colorTheme.value === 2 ? 1 : 0,
		detail: { options: ['Light', 'Dark'] }
	};
	let customScrollbar = false;
	let debateStyle = settings.data.debateStyle.value;
	onDestroy(
		settings.subscribe(
			[
				'debateStyle',
				'LDSubstyle',
				'timersPanel',
				'notesPanel',
				'speechDropPanel',
				'colorTheme',
				'customScrollbar',
				'telemetry'
			],
			() => {
				debateStyle = settings.data.debateStyle.value;
				for (const choice of choices)
					choice.setting.value = Number(settings.data[choice.key].value) !== 0;
				theme.value = settings.data.colorTheme.value === 2 ? 1 : 0;
				customScrollbar = Boolean(settings.data.customScrollbar.value);
				settings.saveToLocalStorage();
			}
		)
	);
	onDestroy(() => {
		if ($setupPending) completeSetup(false, 'dismissed');
		flushSettingChanges();
	});
	function finish(tutorial: boolean) {
		completeSetup(tutorial, tutorial ? 'completed' : 'skipped');
		closePopup();
	}
	async function importSettings() {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const data: unknown = JSON.parse(await file.text());
			if (!data || typeof data !== 'object' || Array.isArray(data))
				throw new Error('Choose a Flew settings file.');
			const saved = data as Record<string, unknown>;
			if (
				saved.isSettings !== true ||
				!saved.settings ||
				typeof saved.settings !== 'object' ||
				Array.isArray(saved.settings)
			)
				throw new Error('Choose a Flew settings file.');
			if (typeof saved.version === 'number' && saved.version > SETTINGS_VERSION)
				throw new Error('Update Flew before importing these settings.');
			settings.parseJsonToSettings(data);
			completeSetup(false, 'imported');
			closePopup();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not import settings.';
		}
	}
</script>

<section class="onboarding palette-plain" class:customScrollbar aria-label="Set up Flew">
	<Setting key="debateStyle" setting={settings.data.debateStyle} />
	{#if debateStyle === 2}<Setting key="LDSubstyle" setting={settings.data.LDSubstyle} />{/if}
	{#each choices as choice}
		<Setting
			key={choice.key}
			setting={choice.setting}
			onValueChange={(enabled) =>
				settings.setValue(
					choice.key,
					enabled ? Number(settings.data[choice.key].value) || choice.enabledPosition : 0
				)}
		/>
	{/each}
	<Setting
		key="colorTheme"
		setting={theme}
		onValueChange={(value) => settings.setValue('colorTheme', Number(value) + 1)}
	/>
	<Setting key="telemetry" setting={settings.data.telemetry} />
	{#if error}<p role="alert">{error}</p>{/if}
	<input
		bind:this={input}
		type="file"
		accept=".json,application/json"
		aria-label="Import onboarding settings"
		hidden
		on:change={importSettings}
	/>
	<div class="actions">
		<Button icon="arrowRight" text="start tutorial" on:click={() => finish(true)} />
		<Button icon="check" text="skip tutorial" on:click={() => finish(false)} />
		<Button icon="upload" text="import settings and skip tutorial" on:click={() => input.click()} />
	</div>
</section>

<style>
	.onboarding {
		width: min(calc(100vw - var(--padding-big)), 38em);
		max-height: calc(100vh - var(--padding-big));
		padding: calc(var(--button-size) + var(--padding-big)) var(--padding) var(--padding);
		overflow: auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--padding-small);
	}
	.onboarding :global(p.info) {
		opacity: 1;
	}
	.actions :global(button.top) {
		box-sizing: border-box;
		max-width: 100%;
		height: auto;
		min-height: calc(var(--button-size) + var(--padding) * 2);
		white-space: normal;
		overflow-wrap: anywhere;
	}
	p {
		padding-inline: var(--padding);
		color: var(--text-error);
		font-size: 0.85em;
	}
</style>
