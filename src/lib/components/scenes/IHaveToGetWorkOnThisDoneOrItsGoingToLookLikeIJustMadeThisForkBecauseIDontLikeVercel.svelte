<script lang="ts">
	import { onMount } from 'svelte';
	import anime from 'animejs/lib/anime.es';

	export let timeline: anime.AnimeTimelineInstance;
	let cross: SVGGElement;
	onMount(() => {
		timeline = anime.timeline({
			loop: true,
			autoplay: false
		});
		// have the cross class go from size 0 to normal
		timeline.add({
			targets: cross,
			scale: [0, 1],
			duration: 1500,
			easing: 'easeInOutSine'
		});
		//wait a little bit
		timeline.add({
			duration: 4000
		});
		timeline.add({
			targets: cross,
			opacity: [1, 0],
			duration: 1000,
			easing: 'easeInOutSine'
		});
		timeline.add({
			duration: 1000
		});
		
	});
</script>

<div class="top">
	<svg viewBox="0 0 100 100">
		<g class="vercel">
			<circle cx="50" cy="50" r="40"/>
			<polygon points="50,30 70,65 30,65" fill="#FFFFFF" />
		</g>
		<g class="cross"
			bind:this={cross}
			fill="none" 
			stroke="var(--color-accent-secondary)" 
			stroke-width="5" 
			stroke-linecap="round" 
			stroke-linejoin="round"
		>
			<path d="M15 15 L85 85"/>
			<path d="M85 15 L15 85"/>
		</g>
		
	</svg>
</div>

<style>
	.top {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		color: var(--text);
	}
	svg {
		width: 80%;
		height: 80%;
	}
	g.cross {
		transform-origin: 50px 50px;
	}
</style>
