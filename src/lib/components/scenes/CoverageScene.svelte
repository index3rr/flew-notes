<script lang="ts">
	import { onMount } from 'svelte';
	import anime from 'animejs/lib/anime.es';
	import type { AnimeTimelineInstance } from 'animejs';
	import FakeBox from './FakeBox.svelte';
	import Icon from '../Icon.svelte';

	export let timeline: AnimeTimelineInstance;

	let open: HTMLElement;
	let covered: HTMLElement;
	let dropped: HTMLElement;
	let answer: HTMLElement;

	onMount(() => {
		timeline = anime.timeline({ loop: true, autoplay: false });
		// the unanswered argument pulses twice, then gets its response
		timeline.add({
			targets: dropped,
			opacity: [{ value: 1 }, { value: 0.3 }, { value: 1 }],
			duration: 1600,
			easing: 'easeInOutSine'
		});
		timeline.add({
			targets: answer,
			scale: [0, 1],
			duration: 500,
			easing: 'easeOutBack'
		});
		timeline.add({ targets: dropped, opacity: 0, duration: 400, easing: 'easeInOutSine' }, '-=200');
		timeline.add(
			{ targets: open, opacity: [1, 0], translateY: [0, -8], duration: 300, easing: 'easeInSine' },
			'-=600'
		);
		timeline.add(
			{
				targets: covered,
				opacity: [0, 1],
				translateY: [8, 0],
				duration: 300,
				easing: 'easeOutSine'
			},
			'-=300'
		);
		timeline.add({ duration: 2500 });
		// reset
		timeline.add({ targets: answer, scale: [1, 0], duration: 400, easing: 'easeInSine' });
		timeline.add(
			{ targets: covered, opacity: [1, 0], duration: 300, easing: 'easeInSine' },
			'-=400'
		);
		timeline.add(
			{ targets: open, opacity: [0, 1], translateY: [8, 0], duration: 300, easing: 'easeOutSine' },
			'-=100'
		);
		timeline.add({ duration: 1200 });
	});
</script>

<div class="top">
	<div class="status">
		<span class="chip palette-accent-secondary" bind:this={open}>
			<Icon name="checklist" size="var(--button-size)" />1 open
		</span>
		<span class="chip palette-accent-secondary covered" bind:this={covered}>
			<Icon name="check" size="var(--button-size)" />all answered
		</span>
	</div>
	<div class="grid">
		<div class="palette-accent"><FakeBox text="Costs falling" /></div>
		<div class="palette-accent-secondary"><FakeBox text="Not fast enough" below /></div>

		<div class="palette-accent cell">
			<div class="highlight" bind:this={dropped} />
			<FakeBox text="Access first" />
		</div>
		<div class="palette-accent-secondary answer" bind:this={answer}>
			<FakeBox text="Access is fine" below />
		</div>

		<div class="palette-accent"><FakeBox text="Solves rural" below /></div>
		<div class="palette-accent-secondary"><FakeBox text="No hospitals" below /></div>
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
		--column-width: 130px;
	}
	.status {
		display: grid;
		justify-items: center;
	}
	.chip {
		grid-area: 1 / 1;
		display: flex;
		align-items: center;
		gap: var(--padding-small);
		padding: var(--padding-small) var(--padding);
		border-radius: var(--border-radius);
		background: var(--this-background-indent);
		color: var(--this-text);
	}
	.covered {
		opacity: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: var(--column-width) var(--column-width);
		row-gap: var(--padding);
	}
	.cell {
		position: relative;
	}
	.highlight {
		position: absolute;
		inset: 0;
		border-radius: var(--border-radius-small);
		background: var(--this-background-indent);
		opacity: 0;
	}
	.answer {
		transform-origin: 0% 50%;
		transform: scale(0);
	}
</style>
