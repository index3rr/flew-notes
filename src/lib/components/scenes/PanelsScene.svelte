<script lang="ts">
	import { onMount } from 'svelte';
	import anime from 'animejs/lib/anime.es';
	import type { AnimeTimelineInstance } from 'animejs';
	import Icon from '../Icon.svelte';

	export let timeline: AnimeTimelineInstance;

	let tabs: HTMLElement;
	let timer: HTMLElement;
	let timerFull: HTMLElement;
	let timerIcon: HTMLElement;
	let notes: HTMLElement;
	let flow: HTMLElement;

	const move = { duration: 900, easing: 'easeInOutCubic' };

	onMount(() => {
		timeline = anime.timeline({ loop: true, autoplay: false });
		// Notes moves to its own column on the right, and the flow makes room
		timeline.add({ targets: notes, left: '76%', top: '0%', height: '100%', ...move });
		timeline.add({ targets: flow, width: '46%', ...move }, '-=900');
		timeline.add({ targets: tabs, height: '76%', ...move }, '-=800');
		timeline.add({ targets: timer, top: '79%', height: '21%', ...move }, '-=900');
		timeline.add({ duration: 800 });
		// the timer collapses into the tray
		timeline.add({ targets: timerFull, opacity: 0, duration: 250, easing: 'easeInSine' });
		timeline.add({ targets: timer, top: '88%', height: '12%', width: '12%', ...move }, '-=100');
		timeline.add({ targets: tabs, height: '85%', ...move }, '-=900');
		timeline.add({ targets: timerIcon, opacity: 1, duration: 250, easing: 'easeOutSine' }, '-=300');
		timeline.add({ duration: 2000 });
		// and everything goes back
		timeline.add({ targets: timerIcon, opacity: 0, duration: 250, easing: 'easeInSine' });
		timeline.add({ targets: timer, top: '49%', height: '18%', width: '24%', ...move });
		timeline.add({ targets: tabs, height: '46%', ...move }, '-=900');
		timeline.add({ targets: notes, left: '0%', top: '70%', height: '30%', ...move }, '-=900');
		timeline.add({ targets: flow, width: '73%', ...move }, '-=800');
		timeline.add({ targets: timerFull, opacity: 1, duration: 250, easing: 'easeOutSine' }, '-=300');
		timeline.add({ duration: 1500 });
	});
</script>

<div class="top">
	<div class="screen">
		<div class="area">
			<div class="card tabs" bind:this={tabs}>
				<div class="name">Tabs</div>
				<div class="pill palette-accent" />
				<div class="pill palette-accent-secondary" />
				<div class="pill palette-accent" />
			</div>
			<div class="card timer" bind:this={timer}>
				<div class="full" bind:this={timerFull}>
					<div class="name">Timer</div>
					<div class="time palette-accent">2:41</div>
				</div>
				<div class="icon" bind:this={timerIcon}>
					<Icon name="clock" size="var(--button-size)" />
				</div>
			</div>
			<div class="card notes" bind:this={notes}>
				<div class="name">Notes</div>
				<div class="text" />
				<div class="text" />
				<div class="text short" />
			</div>
			<div class="card flow" bind:this={flow}>
				<div class="column palette-accent">
					<div class="cell" />
					<div class="cell" />
					<div class="cell" />
				</div>
				<div class="column palette-accent-secondary">
					<div class="cell" />
					<div class="cell gap" />
					<div class="cell" />
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
	}
	.screen {
		position: relative;
		width: 80%;
		height: 70%;
		border-radius: var(--border-radius);
		background: var(--background-back);
	}
	/* card positions are percentages of this area */
	.area {
		position: absolute;
		inset: var(--padding);
	}
	.card {
		position: absolute;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		padding: var(--padding-small);
		overflow: hidden;
		border-radius: var(--border-radius-small);
		background: var(--background);
	}
	.tabs {
		left: 0%;
		top: 0%;
		width: 24%;
		height: 46%;
	}
	.timer {
		left: 0%;
		top: 49%;
		width: 24%;
		height: 18%;
	}
	.notes {
		left: 0%;
		top: 70%;
		width: 24%;
		height: 30%;
	}
	.flow {
		left: 27%;
		top: 0%;
		width: 73%;
		height: 100%;
		flex-direction: row;
		gap: var(--padding-small);
		padding: var(--padding);
	}
	.name {
		font-size: 0.65em;
		line-height: 1.2;
		color: var(--text-weak);
		white-space: nowrap;
	}
	.pill {
		flex-shrink: 0;
		height: var(--padding);
		border-radius: var(--border-radius-small);
		background: var(--this-background-indent);
	}
	.full {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.time {
		font-size: 0.8em;
		color: var(--this-text);
	}
	.icon {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-weak);
		opacity: 0;
	}
	.text {
		flex-shrink: 0;
		height: var(--padding-small);
		border-radius: var(--border-radius-small);
		background: var(--background-active);
	}
	.text.short {
		width: 60%;
	}
	.column {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--padding);
	}
	.cell {
		display: flex;
		flex-direction: column;
		gap: calc(var(--padding-small) / 2);
	}
	.cell::before {
		content: '';
		width: 70%;
		height: calc(var(--padding-small) * 0.75);
		border-radius: var(--border-radius-small);
		background: var(--this-background-indent);
	}
	.cell::after {
		content: '';
		height: calc(var(--line-width) / 3);
		border-radius: var(--border-radius-small);
		background: var(--this-color-fade);
	}
	.cell.gap {
		visibility: hidden;
	}
</style>
