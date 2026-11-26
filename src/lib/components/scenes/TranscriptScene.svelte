<script lang="ts">
	import { onMount } from 'svelte';
	import anime from 'animejs/lib/anime.es';
	import type { AnimeTimelineInstance } from 'animejs';
	import Icon from '../Icon.svelte';

	export let timeline: AnimeTimelineInstance;

	let wave: HTMLElement;
	let lines: HTMLElement;
	let flag: HTMLElement;

	const bars = [0, 1, 2, 3, 4, 5, 6];
	const listen = 7020;

	onMount(() => {
		timeline = anime.timeline({ loop: true, autoplay: false });
		const barEls = Array.from(wave.children);
		const lineEls = Array.from(lines.children);
		// the waveform keeps moving while the lines arrive
		timeline.add({
			targets: barEls,
			scaleY: [
				...Array.from({ length: listen / 260 }, (_, i) => ({
					value: () => anime.random(i % 2 ? 15 : 40, i % 2 ? 60 : 100) / 100,
					duration: 260
				})),
				{ value: 0.15, duration: 260 }
			],
			delay: anime.stagger(60, { from: 'center' }),
			easing: 'easeInOutSine'
		});
		timeline.add(
			{
				targets: lineEls,
				opacity: [0, 1],
				translateY: [10, 0],
				delay: anime.stagger(1300),
				duration: 400,
				easing: 'easeOutSine'
			},
			400
		);
		timeline.add(
			{
				targets: flag,
				scale: [0, 1],
				duration: 400,
				easing: 'easeOutBack'
			},
			3600
		);
		timeline.add(
			{
				targets: lineEls,
				opacity: [1, 0],
				duration: 400,
				easing: 'easeInSine'
			},
			listen
		);
		timeline.add({ targets: flag, scale: [1, 0], duration: 300, easing: 'easeInSine' }, listen);
		timeline.add({ duration: 600 });
	});
</script>

<div class="top">
	<div class="listen palette-accent">
		<Icon name="mic" size="var(--button-size)" />
		<div class="wave" bind:this={wave}>
			{#each bars as bar (bar)}
				<div class="bar" />
			{/each}
		</div>
	</div>
	<div class="lines" bind:this={lines}>
		<div class="line">
			<span class="when">1AR · 0:12</span>
			<span>costs are already falling</span>
		</div>
		<div class="line">
			<span class="when">1AR · 0:31</span>
			<span>access comes first</span>
		</div>
		<div class="line">
			<span class="when">
				1AR · 0:48
				<span class="flag palette-accent-secondary" bind:this={flag}>not in doc</span>
			</span>
			<span>they never answer frequency</span>
		</div>
	</div>
</div>

<style>
	.top {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--padding-big);
	}
	.listen {
		display: flex;
		align-items: center;
		gap: var(--padding);
		padding: var(--padding) var(--padding-big);
		border-radius: var(--border-radius);
		background: var(--this-background-indent);
		color: var(--this-text);
	}
	.wave {
		display: flex;
		align-items: center;
		gap: calc(var(--padding-small) * 0.75);
		height: calc(var(--button-size) * 1.5);
	}
	.bar {
		width: calc(var(--padding-small) * 0.75);
		height: 100%;
		border-radius: var(--border-radius-small);
		background: var(--this-color);
		transform: scaleY(0.15);
	}
	.lines {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
		width: 230px;
	}
	.line {
		display: flex;
		flex-direction: column;
		opacity: 0;
	}
	.when {
		font-size: 0.85em;
		color: var(--text-weak);
	}
	.flag {
		display: inline-block;
		margin-left: var(--padding-small);
		padding: 0 var(--padding-small);
		border-radius: var(--border-radius-small);
		background: var(--this-background-indent);
		color: var(--this-text);
		transform: scale(0);
		transform-origin: 0% 50%;
	}
</style>
