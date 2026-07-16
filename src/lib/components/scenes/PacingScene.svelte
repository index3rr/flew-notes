<script lang="ts">
	import { onMount } from 'svelte';
	import anime from 'animejs/lib/anime.es';
	import FakeBox from './FakeBox.svelte';
	import FakeTimer from './FakeTimer.svelte';

	export let timeline: anime.AnimeTimelineInstance;

	let boxes: HTMLElement;
	let speechDisplay = '0:15';
	let pacingDisplay = '0:05';

	const boxDuration = 5000;
	const totalDuration = 15000;

	function formatTime(sec: number): string {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	onMount(() => {
		timeline = anime.timeline({
			loop: true,
			autoplay: false
		});

		const boxEls = Array.from(boxes.children);

		// box 0 focused: 0–5s
		timeline.add({
			targets: boxEls[0],
			scale: [1, 1.03],
			opacity: [0.7, 1],
			duration: 400,
			easing: 'easeInOutSine'
		});
		timeline.add({ duration: 4600 });

		// transition to box 1: 5s
		timeline.add({
			targets: boxEls[0],
			scale: [1.03, 1],
			opacity: [1, 0.7],
			duration: 400,
			easing: 'easeInOutSine'
		});
		timeline.add({
			targets: boxEls[1],
			scale: [1, 1.03],
			opacity: [0.7, 1],
			duration: 400,
			easing: 'easeInOutSine'
		}, '-=400');
		timeline.add({ duration: 4600 });

		// transition to box 2: 10s
		timeline.add({
			targets: boxEls[1],
			scale: [1.03, 1],
			opacity: [1, 0.7],
			duration: 400,
			easing: 'easeInOutSine'
		});
		timeline.add({
			targets: boxEls[2],
			scale: [1, 1.03],
			opacity: [0.7, 1],
			duration: 400,
			easing: 'easeInOutSine'
		}, '-=400');
		timeline.add({ duration: 4600 });

		// reset
		timeline.add({
			targets: boxEls[2],
			scale: [1.03, 1],
			opacity: [1, 0.7],
			duration: 400,
			easing: 'easeInOutSine'
		});
		timeline.add({ duration: 300 });

		// timer animations — added last, pinned to position 0
		timeline.add({
			targets: { _: 0 },
			_: 1,
			duration: totalDuration,
			easing: 'linear',
			update: function (a) {
				const remaining = Math.max(0, Math.ceil(15 - a.currentTime / 1000));
				speechDisplay = formatTime(remaining);
			}
		}, 0);
		timeline.add({
			targets: { _: 0 },
			_: 1,
			duration: totalDuration,
			easing: 'linear',
			update: function (a) {
				const remaining = Math.max(0, Math.ceil((boxDuration - (a.currentTime % boxDuration)) / 1000));
				pacingDisplay = formatTime(remaining);
			}
		}, 0);
	});
</script>

<div class="top palette-accent">
	<div class="speech-timer">
		<FakeTimer time={speechDisplay} palette="accent" />
	</div>
	<div class="boxes" bind:this={boxes}>
		<div class="box-wrap">
			<FakeBox text="Excel isn't meant for flowing" />
		</div>
		<div class="box-wrap">
			<FakeBox text="! So you can't do this" />
		</div>
		<div class="box-wrap">
			<FakeBox text="Flew notes solves." />
		</div>
	</div>
	<div class="pacing palette-accent-secondary">
		<FakeTimer time={pacingDisplay} palette="accent-secondary" />
	</div>
</div>

<style>
	.top {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--padding);
		padding: var(--padding);
		box-sizing: border-box;
		--column-width: 150px;
	}

	.speech-timer {
		width: var(--column-width);
	}

	.boxes {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.box-wrap {
		transform-origin: center center;
	}

	.pacing {
		width: var(--column-width);
	}
</style>
