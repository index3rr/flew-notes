<script lang="ts">
	import { onMount } from 'svelte';
	import anime from 'animejs/lib/anime.es';
	import type { AnimeTimelineInstance } from 'animejs';
	import FakeBox from './FakeBox.svelte';
	import Icon from '../Icon.svelte';

	export let timeline: AnimeTimelineInstance;

	let doc: HTMLElement;
	let flow: HTMLElement;

	const tags = ['Costs are rising', 'Hurts the economy', 'Turns the case'];

	onMount(() => {
		timeline = anime.timeline({ loop: true, autoplay: false });
		const glowEls = Array.from(doc.querySelectorAll('.glow'));
		const boxEls = Array.from(flow.children);
		glowEls.forEach((glow, i) => {
			timeline.add({
				targets: glow,
				opacity: [0, 1],
				duration: 250,
				easing: 'easeOutSine'
			});
			timeline.add(
				{
					targets: boxEls[i],
					opacity: [0, 1],
					translateX: [-24, 0],
					duration: 450,
					easing: 'easeOutCubic'
				},
				'-=100'
			);
			timeline.add(
				{
					targets: glow,
					opacity: 0,
					duration: 300,
					easing: 'easeInSine'
				},
				'-=150'
			);
		});
		timeline.add({ duration: 2500 });
		timeline.add({ targets: boxEls, opacity: 0, duration: 400, easing: 'easeInSine' });
		timeline.add({ duration: 800 });
	});
</script>

<div class="top">
	<div class="doc" bind:this={doc}>
		<div class="file"><Icon name="file" size="var(--button-size)" />1NC.docx</div>
		<div class="block">Costs DA</div>
		{#each tags as tag}
			<div class="tag palette-accent-secondary">
				<div class="glow" />
				{tag}
			</div>
			<div class="text" />
			<div class="text short" />
		{/each}
	</div>
	<div class="flow palette-accent-secondary" bind:this={flow}>
		{#each tags as tag}
			<div class="box"><FakeBox text={tag} below /></div>
		{/each}
	</div>
</div>

<style>
	.top {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--padding-big);
		--column-width: 125px;
	}
	.doc {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		width: 130px;
		box-sizing: border-box;
		padding: var(--padding);
		border-radius: var(--border-radius);
		background: var(--background-indent);
		font-size: 0.8em;
		isolation: isolate;
	}
	.file {
		display: flex;
		align-items: center;
		gap: var(--padding-small);
		color: var(--text-weak);
		padding-bottom: var(--padding-small);
	}
	.file :global(svg) {
		margin: 0;
	}
	.block {
		font-weight: var(--font-weight-bold);
		color: var(--text);
	}
	.tag {
		position: relative;
		margin: 0 calc(var(--padding-small) * -1);
		padding: 0 var(--padding-small);
		border-radius: var(--border-radius-small);
		color: var(--this-text);
		font-weight: var(--font-weight-bold);
	}
	.glow {
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: inherit;
		background: var(--this-background-active);
		opacity: 0;
	}
	.text {
		height: calc(var(--padding) * 0.75);
		border-radius: var(--border-radius-small);
		background: var(--background-active);
	}
	.text.short {
		width: 70%;
		margin-bottom: var(--padding-small);
	}
	.flow {
		display: flex;
		flex-direction: column;
		width: var(--column-width);
	}
	.box {
		opacity: 0;
	}
</style>
