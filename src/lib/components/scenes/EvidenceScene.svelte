<script lang="ts">
	import { onMount } from 'svelte';
	import anime from 'animejs/lib/anime.es';
	import type { AnimeTimelineInstance } from 'animejs';
	import FakeBox from './FakeBox.svelte';

	export let timeline: AnimeTimelineInstance;

	let card: HTMLElement;
	let lines: HTMLElement;

	// widths of the evidence lines and which stretches are highlighted, in percent
	const evidence = [
		{ width: 92, mark: [8, 40] },
		{ width: 100, mark: [0, 0] },
		{ width: 86, mark: [30, 50] },
		{ width: 96, mark: [0, 24] },
		{ width: 58, mark: [0, 0] }
	];

	onMount(() => {
		timeline = anime.timeline({ loop: true, autoplay: false });
		const lineEls = Array.from(lines.children);
		const markEls = Array.from(lines.querySelectorAll('.mark'));
		timeline.add({
			targets: card,
			height: [0, () => card.scrollHeight],
			duration: 700,
			easing: 'easeInOutQuad'
		});
		timeline.add(
			{
				targets: lineEls,
				opacity: [0, 1],
				translateY: [6, 0],
				delay: anime.stagger(70),
				duration: 300,
				easing: 'easeOutSine'
			},
			'-=400'
		);
		timeline.add({
			targets: markEls,
			scaleX: [0, 1],
			delay: anime.stagger(250),
			duration: 450,
			easing: 'easeInOutSine'
		});
		timeline.add({ duration: 2500 });
		timeline.add({
			targets: card,
			height: 0,
			duration: 600,
			easing: 'easeInOutQuad'
		});
		timeline.add({ targets: lineEls, opacity: 0, duration: 300, easing: 'easeInSine' }, '-=600');
		timeline.add(
			{ targets: markEls, scaleX: [1, 0], duration: 300, easing: 'easeInSine' },
			'-=600'
		);
		timeline.add({ duration: 1200 });
	});
</script>

<div class="top palette-accent">
	<div class="stack">
		<FakeBox text="Costs aren’t high now" below />
		<div class="card" bind:this={card}>
			<div class="inner">
				<div class="cite"><strong>Lee ’24</strong> · Health Policy Review</div>
				<div class="lines" bind:this={lines}>
					{#each evidence as line}
						<div class="line" style="width: {line.width}%">
							{#if line.mark[1] > 0}
								<div class="mark-holder" style="left: {line.mark[0]}%; width: {line.mark[1]}%">
									<div class="mark" />
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.top {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		--column-width: 220px;
	}
	.stack {
		width: var(--column-width);
		min-height: 60%;
	}
	.card {
		height: 0;
		overflow: hidden;
	}
	.inner {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
		padding: var(--padding);
	}
	.cite {
		font-size: 0.85em;
		color: var(--this-text-weak);
	}
	.lines {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.line {
		position: relative;
		height: calc(var(--padding) * 1.25);
		border-radius: var(--border-radius-small);
		background: var(--background-indent);
		opacity: 0;
	}
	.mark-holder {
		position: absolute;
		top: 0;
		bottom: 0;
	}
	.mark {
		width: 100%;
		height: 100%;
		border-radius: var(--border-radius-small);
		background: var(--this-color);
		transform: scaleX(0);
		transform-origin: 0% 50%;
	}
</style>
