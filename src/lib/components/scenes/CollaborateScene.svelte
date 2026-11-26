<script lang="ts">
	import { onMount } from 'svelte';
	import anime from 'animejs/lib/anime.es';
	import type { AnimeTimelineInstance } from 'animejs';
	import FakeBox from './FakeBox.svelte';
	import Icon from '../Icon.svelte';

	export let timeline: AnimeTimelineInstance;

	let yours: HTMLElement;
	let theirs: HTMLElement;
	let message: HTMLElement;
	let link: HTMLElement;
	let target: HTMLElement;

	onMount(() => {
		timeline = anime.timeline({ loop: true, autoplay: false });
		// your new cell shows up on your partner's screen a moment later
		timeline.add({ targets: yours, scale: [0, 1], duration: 450, easing: 'easeOutBack' });
		timeline.add({ targets: theirs, scale: [0, 1], duration: 450, easing: 'easeOutBack' }, '+=350');
		timeline.add({
			targets: message,
			opacity: [0, 1],
			translateY: [16, 0],
			duration: 500,
			easing: 'easeOutBack',
			delay: 600
		});
		timeline.add({
			targets: link,
			scale: [{ value: 0.92 }, { value: 1 }],
			duration: 300,
			easing: 'easeInOutSine',
			delay: 700
		});
		timeline.add({ targets: target, opacity: [0, 1], duration: 350, easing: 'easeOutSine' });
		timeline.add({ duration: 2400 });
		// reset
		timeline.add({ targets: [message, target], opacity: 0, duration: 400, easing: 'easeInSine' });
		timeline.add(
			{ targets: [yours, theirs], scale: [1, 0], duration: 400, easing: 'easeInSine' },
			'-=400'
		);
		timeline.add({ duration: 700 });
	});
</script>

<div class="top">
	<div class="windows">
		<div class="window palette-accent">
			<div class="who">You</div>
			<div class="cell">
				<div class="highlight" bind:this={target} />
				<FakeBox text="Access first" below />
			</div>
			<FakeBox text="Costs falling" />
			<div class="new" bind:this={yours}><FakeBox text="Plan solves" below /></div>
		</div>
		<div class="window palette-accent">
			<div class="who">Partner</div>
			<FakeBox text="Access first" below />
			<FakeBox text="Costs falling" />
			<div class="new" bind:this={theirs}><FakeBox text="Plan solves" below /></div>
		</div>
	</div>
	<div class="message" bind:this={message}>
		<Icon name="people" size="var(--button-size)" />
		<span>extend</span>
		<span class="link palette-accent" bind:this={link}>
			<Icon name="arrowRight" size="var(--button-size)" />Access first
		</span>
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
		gap: var(--padding);
		--column-width: 130px;
	}
	.windows {
		display: flex;
		gap: var(--padding);
	}
	.window {
		display: flex;
		flex-direction: column;
		padding: var(--padding) 0;
		border-radius: var(--border-radius);
		background: var(--background-back);
	}
	.who {
		padding: 0 var(--padding) var(--padding);
		font-size: 0.85em;
		color: var(--text-weak);
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
	.new {
		transform: scale(0);
		transform-origin: 50% 0%;
	}
	.message {
		display: flex;
		align-items: center;
		gap: var(--padding-small);
		padding: var(--padding);
		border-radius: var(--border-radius);
		background: var(--background-indent);
		color: var(--text);
		opacity: 0;
	}
	.message > :global(svg) {
		margin: 0;
		color: var(--text-weak);
	}
	.link {
		display: flex;
		align-items: center;
		gap: var(--padding-small);
		padding: 0 var(--padding-small);
		border-radius: var(--border-radius-small);
		background: var(--this-background-indent);
		color: var(--this-text);
	}
</style>
