<script lang="ts">
	import { onMount } from 'svelte';
	import type { ComponentType } from 'svelte';
	import type { AnimeTimelineInstance } from 'animejs';

	export let title: string;
	export let detail: string;
	export let component: ComponentType;
	// visual above the text, for the grid of smaller features
	export let compact = false;
	// milliseconds into the scene to hold on when the viewer prefers reduced motion
	export let still: number | undefined = undefined;
	let timeline: AnimeTimelineInstance | undefined;

	let element: HTMLElement;
	let show = false;
	let started: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) show = true;
				clearTimeout(started);
				if (!timeline) return;
				if (reducedMotion.matches) {
					timeline.pause();
					timeline.seek(still ?? timeline.duration / 2);
				} else if (entry.isIntersecting) {
					// a short beat so the card has settled before the scene moves
					started = setTimeout(() => timeline?.play(), 300);
				} else {
					timeline.pause();
				}
			},
			// reveal as soon as the top of the card is comfortably on screen
			{ rootMargin: '0px 0px -10% 0px', threshold: 0 }
		);
		observer.observe(element);
		return () => {
			clearTimeout(started);
			observer.disconnect();
			timeline?.pause();
		};
	});
</script>

<div class="top" class:compact bind:this={element} class:show>
	<div class="visualWrapper">
		<div class="visual">
			<svelte:component this={component} bind:timeline />
		</div>
	</div>
	<div class="text">
		<h2>{title}</h2>
		<p>{detail}</p>
	</div>
</div>

<style>
	.top {
		display: grid;
		grid-template-columns: var(--height) 1fr;
		gap: var(--padding);
		min-height: var(--height);
		--height: 320px;
		opacity: 0;
		transform: translateY(50px);
		transition: opacity 0.5s ease-in-out, transform 0.5s ease-in-out;
		overflow: hidden;
	}
	.top.show {
		opacity: 1;
		transform: translateY(0);
	}
	.top:nth-child(odd) {
		grid-template-columns: 1fr var(--height);
	}
	.top:nth-child(odd) > .visualWrapper {
		order: 2;
	}
	.top > div {
		background: var(--background);
		border-radius: var(--border-radius);
		box-sizing: border-box;
	}
	.visualWrapper {
		flex-basis: var(--height);
		width: var(--height);
		display: flex;
		align-items: center;
		justify-content: center;
		height: auto;
	}
	.visual {
		height: var(--height);
		width: var(--height);
		box-sizing: border-box;
		transition: box-shadow var(--transition-speed) ease-in-out;
	}

	.text {
		padding: 3rem;
		width: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2rem;
		height: auto;
	}
	h2 {
		margin: 0;
		font-size: 2.5rem;
		font-weight: var(--font-weight-bold);
	}
	p {
		margin: 0;
		font-size: 1.25rem;
		line-height: 2;
	}
	/* compact cards stack the visual above the text, and keep doing so at every width */
	.top.compact,
	.top.compact:nth-child(odd) {
		grid-template-columns: 100%;
		grid-template-rows: var(--height) 1fr;
	}
	.compact > .visualWrapper,
	.compact:nth-child(odd) > .visualWrapper {
		width: 100%;
		order: 0;
	}
	.compact .text {
		padding: 2rem;
		gap: 1rem;
		justify-content: flex-start;
	}
	.compact h2 {
		font-size: 1.75rem;
	}
	.compact p {
		font-size: 1.1rem;
		line-height: 1.8;
	}
	@media (prefers-reduced-motion: reduce) {
		.top {
			transform: none;
			transition: opacity 0.5s ease-in-out;
		}
	}
	@media (max-width: 800px) {
		h2 {
			font-size: 1.5rem;
		}
		p {
			font-size: 1rem;
		}
		.top,
		.top:nth-child(odd) {
			grid-template-columns: 100%;
			grid-template-rows: var(--height) 1fr;

			height: auto;
			width: 100%;
		}

		.visualWrapper,
		.top:nth-child(odd) > .visualWrapper {
			width: 100%;
			order: 0;
		}
	}
</style>
