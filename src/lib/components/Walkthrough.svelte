<script lang="ts">
	import { onDestroy } from 'svelte';
	import { settings } from '$lib/models/settings';
	import Button from './Button.svelte';
	import TutorialText from './TutorialText.svelte';
	import PanelHeader from './panels/PanelHeader.svelte';
	export let name: string;
	export let title: string;
	export let text = '';
	export let index: number;
	export let total: number;
	export let panel = false;
	export let ariaLabel = 'Getting started';
	export let nextDisabledReason: string | null = null;
	export let back: () => void;
	export let next: () => void;
	export let finish: (completed: boolean) => void;
	let customScrollbar = false;
	onDestroy(
		settings.subscribe(
			['customScrollbar'],
			() => (customScrollbar = Boolean(settings.data.customScrollbar.value))
		)
	);
</script>

<section class="tutorial" class:panel class:customScrollbar aria-label={ariaLabel}>
	<PanelHeader {name} detail={`${index + 1}/${total}`}>
		<Button
			icon="delete"
			ariaLabel="End tutorial"
			tooltip="end tutorial"
			on:click={() => finish(false)}
		/>
	</PanelHeader>
	<h1>{title}</h1>
	{#if text}<p><TutorialText {text} /></p>{/if}
	<slot />
	<div class="progress" aria-label={`Tutorial step ${index + 1} of ${total}`}>
		{#each [...Array(total).keys()] as i}<span class:current={i === index} />{/each}
	</div>
	<div class="tutorial-actions">
		<Button
			icon="arrowLeft"
			text="back"
			tooltip="previous tutorial step"
			disabled={index === 0}
			disabledReason="first step"
			on:click={back}
		/>
		{#if index < total - 1}
			<Button
				icon="arrowRight"
				text="next"
				tooltip="next tutorial step"
				disabled={nextDisabledReason !== null}
				disabledReason={nextDisabledReason ?? ''}
				on:click={next}
			/>
		{:else}
			<Button icon="check" text="finish" tooltip="finish tutorial" on:click={() => finish(true)} />
		{/if}
	</div>
</section>

<style>
	.tutorial {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: var(--padding-big);
		padding: var(--padding-big);
		background: var(--background);
		border-radius: var(--border-radius);
	}
	.tutorial.panel {
		background: none;
		padding: 0;
	}
	h1 {
		font-size: 1.6em;
		max-width: 25ch;
	}
	.panel h1 {
		font-size: 1.2em;
	}
	p {
		margin: 0;
		max-width: 55ch;
		line-height: 1.7;
	}
	.panel p {
		line-height: 1.6;
	}
	.tutorial-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--padding);
	}
	.progress {
		display: flex;
		gap: var(--padding-small);
		margin-top: auto;
	}
	.progress span {
		height: var(--line-width);
		flex: 1;
		border-radius: var(--border-radius-small);
		background: var(--background-indent);
	}
	.progress .current {
		background: var(--color-accent);
	}
</style>
