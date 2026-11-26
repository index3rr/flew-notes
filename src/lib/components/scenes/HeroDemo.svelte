<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '../Icon.svelte';
	import DemoCell from './DemoCell.svelte';
	import type { DemoNode } from './DemoCell.svelte';

	// A themed mock of the app that flows a few speeches of a round on a loop.
	const columns = ['1AC', '1NC', '2AC', 'Block', '1AR'];
	const speechOf: Record<string, string> = { n: '1NC', r: '2AC', b: 'Block' };
	const flow: DemoNode[] = [
		{
			id: 'a1',
			text: 'Health costs are rising',
			children: [
				{
					id: 'n1',
					text: 'Costs are falling now',
					children: [
						{
							id: 'r1',
							text: 'Their card is from 2019',
							children: [{ id: 'b1', text: 'New data agrees' }]
						}
					]
				}
			]
		},
		{
			id: 'a2',
			text: 'Rural hospitals are closing',
			children: [
				{ id: 'n2', text: 'Closures are mergers' },
				{
					id: 'n3',
					text: 'Turn: wait times rise',
					children: [{ id: 'r2', text: 'Wait times fall' }]
				}
			]
		},
		{
			id: 'a3',
			text: 'Plan: single payer',
			children: [
				{
					id: 'n4',
					text: 'States CP solves',
					children: [{ id: 'r3', text: 'Perm: do both' }]
				}
			]
		}
	];
	const order = ['n1', 'n2', 'n3', 'n4', 'r1', 'r2', 'r3', 'b1'];
	const textOf: Record<string, string> = {};
	const collect = (nodes: DemoNode[]) =>
		nodes.forEach((node) => {
			textOf[node.id] = node.text;
			collect(node.children ?? []);
		});
	collect(flow);

	const tabs = [
		{ name: 'Aff case', side: 'accent', active: true },
		{ name: 'Costs DA', side: 'accent-secondary' },
		{ name: 'States CP', side: 'accent-secondary' },
		{ name: 'Topicality', side: 'accent-secondary' }
	];
	const tools = ['undo', 'redo', 'addDown', 'addRight', 'star', 'cross'];
	const speechLength = 8 * 60;

	let typed: Record<string, string> = {};
	let focusId: string | undefined;
	let speech = '1NC';
	let clock = speechLength;
	$: time = `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, '0')}`;
	$: speechIndex = columns.indexOf(speech);

	let element: HTMLElement;
	let visible = false;
	let running = true;

	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
	// waits that also hold the loop while the demo is scrolled out of view
	async function wait(ms: number) {
		await sleep(ms);
		while (running && !visible) await sleep(200);
	}

	async function play() {
		while (running) {
			typed = {};
			focusId = undefined;
			speech = '1NC';
			clock = speechLength;
			await wait(900);
			for (const id of order) {
				const next = speechOf[id[0]];
				if (next != speech) {
					focusId = undefined;
					await wait(700);
					speech = next;
					clock = speechLength;
				}
				focusId = id;
				typed = { ...typed, [id]: '' };
				for (const char of textOf[id]) {
					if (!running) return;
					typed = { ...typed, [id]: typed[id] + char };
					clock = Math.max(0, clock - 1);
					await wait(char == ' ' ? 90 : 45 + Math.random() * 45);
				}
				await wait(450);
			}
			focusId = undefined;
			await wait(3500);
		}
	}

	onMount(() => {
		const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
		observer.observe(element);
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			typed = { ...textOf };
			speech = '2AC';
			clock = 287;
		} else {
			play();
		}
		return () => {
			running = false;
			observer.disconnect();
		};
	});
</script>

<div class="demo" bind:this={element} role="img" aria-label="Flew Notes flowing a policy round">
	<div class="sidebar" aria-hidden="true">
		<div class="card head">
			<div class="icons">
				<Icon name="home" size="var(--button-size)" />
				<Icon name="settings" size="var(--button-size)" />
				<Icon name="people" size="var(--button-size)" />
				<Icon name="download" size="var(--button-size)" />
			</div>
			<div class="document">Semis vs. Lincoln</div>
		</div>
		<div class="card tabs">
			<div class="name">Tabs</div>
			{#each tabs as tab}
				<div class={`tab palette-${tab.side}`} class:active={tab.active}>{tab.name}</div>
			{/each}
		</div>
		<div class="card timers">
			<div class="name">Timers</div>
			<div class="speech palette-{speechIndex % 2 ? 'accent-secondary' : 'accent'}">
				<span class="speech-name">{speech}</span>
				<span class="time">{time}</span>
			</div>
			<div class="prep palette-accent">
				<span>Aff prep</span><span>8:00</span>
			</div>
			<div class="prep palette-accent-secondary">
				<span>Neg prep</span><span>6:31</span>
			</div>
		</div>
	</div>
	<div class="card title" aria-hidden="true">Aff case</div>
	<div class="card tools" aria-hidden="true">
		{#each tools as tool}
			<Icon name={tool} size="var(--button-size)" />
		{/each}
	</div>
	<div class="card flow" aria-hidden="true">
		<div class="viewer" style={`--column-count: ${columns.length}`}>
			<div class="columns">
				{#each columns as column, index}
					<div class={`column palette-${index % 2 ? 'plain-secondary' : 'plain'}`}>
						<div class={`header palette-${index % 2 ? 'accent-secondary' : 'accent'}`}>
							{column}
						</div>
					</div>
				{/each}
			</div>
			<div class="boxes">
				{#each flow as node, index (node.id)}
					<DemoCell {node} last={index == flow.length - 1} {typed} {focusId} />
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.demo {
		display: grid;
		grid-template-areas:
			'sidebar title tools'
			'sidebar flow flow';
		grid-template-columns: var(--sidebar-width) minmax(0, 1fr) auto;
		grid-template-rows: var(--title-height) 1fr;
		gap: var(--gap);
		height: 30rem;
		user-select: none;
		pointer-events: none;
	}
	.card {
		box-sizing: border-box;
		border-radius: var(--border-radius);
		background: var(--background);
		padding: var(--padding);
		color: var(--text);
	}
	.sidebar {
		grid-area: sidebar;
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		min-height: 0;
	}
	.icons {
		display: flex;
		gap: var(--padding);
		padding: var(--padding);
	}
	.icons :global(svg),
	.tools :global(svg) {
		margin: 0;
	}
	.document {
		padding: var(--padding);
		font-size: 1.2em;
	}
	.tabs {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		min-height: 0;
		overflow: hidden;
	}
	.name {
		padding: var(--padding);
		color: var(--text-weak);
	}
	.tab {
		padding: var(--padding);
		border-radius: var(--border-radius);
		color: var(--this-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tab.active {
		background: var(--this-background-active);
	}
	.timers {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
	}
	.speech {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0 var(--padding);
		color: var(--this-text);
	}
	.speech-name {
		color: var(--this-text-weak);
	}
	.time {
		font-size: 1.6em;
		font-variant-numeric: tabular-nums;
	}
	.prep {
		display: flex;
		justify-content: space-between;
		gap: var(--padding);
		padding: 0 var(--padding);
		font-size: 0.85em;
		color: var(--this-text-weak);
	}
	.prep:last-child {
		padding-bottom: var(--padding);
	}
	.title {
		grid-area: title;
		display: flex;
		align-items: center;
		padding: 0 var(--padding-big);
		font-size: 1.2em;
	}
	.tools {
		grid-area: tools;
		display: flex;
		align-items: center;
		gap: var(--padding-big);
		padding: 0 var(--padding-big);
	}
	.flow {
		grid-area: flow;
		padding: 0;
		overflow: hidden;
		min-height: 0;
	}
	.viewer {
		position: relative;
		width: calc(var(--column-width) * var(--column-count));
		height: 100%;
		margin: 0 auto;
	}
	.columns {
		position: absolute;
		inset: 0;
		display: flex;
	}
	.column {
		width: var(--column-width);
		height: 100%;
		border-radius: var(--border-radius);
		background: var(--this-background);
	}
	.header {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 2.4em;
		color: var(--this-text);
	}
	.boxes {
		position: relative;
		padding-top: calc(2.4em + var(--padding));
	}
	@media (max-width: 800px) {
		.demo {
			grid-template-areas:
				'title'
				'flow';
			grid-template-columns: minmax(0, 1fr);
			height: 26rem;
		}
		.sidebar,
		.tools {
			display: none;
		}
		.viewer {
			margin: 0;
		}
	}
</style>
