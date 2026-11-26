<script lang="ts">
	import Button from '../Button.svelte';
	import PanelHeader from './PanelHeader.svelte';
	import PanelRow from './PanelRow.svelte';
	import PanelStatus from './PanelStatus.svelte';
	import { nodes, frozen } from '$lib/models/store';
	import { currentSpeech } from '$lib/models/timer';
	import { showArgument } from '$lib/models/argumentNavigation';
	import { addResponse, extendArguments } from '$lib/models/nodeDecorateAction';
	import {
		computeCoverage,
		documentSpeeches,
		nextSpeech,
		speechForTimer,
		type CoverageItem,
		type CoveragePage
	} from '$lib/models/coverage';
	import { settings } from '$lib/models/settings';
	import type { BoxId, FlowId } from '$lib/models/node';
	import { tick, onDestroy } from 'svelte';

	export let selectedFlowId: FlowId | null = null;
	export let clickTab: (id: FlowId) => void = () => undefined;

	let showDropped = true,
		showExtended = true;
	onDestroy(
		settings.subscribe(['coverageShowDropped', 'coverageShowExtended'], () => {
			showDropped = Boolean(settings.data.coverageShowDropped.value);
			showExtended = Boolean(settings.data.coverageShowExtended.value);
		})
	);
	$: visiblePages = coverage.pages.map((page) => ({
		...page,
		dropped: page.dropped.filter((item) => (item.extended ? showExtended : showDropped))
	}));

	// Follows the speech timer (CX and prep resolve to the next speech) until a speech is picked here.
	let pinned: string | null = null;
	let lastTimerSpeech: string | null = null;
	$: speeches = documentSpeeches($nodes);
	$: timerSpeech = $currentSpeech ? speechForTimer($currentSpeech.upcoming, speeches) : null;
	$: if (timerSpeech !== lastTimerSpeech) {
		lastTimerSpeech = timerSpeech;
		pinned = null;
	}
	$: speech =
		(pinned && speeches.includes(pinned) ? pinned : null) ??
		timerSpeech ??
		nextSpeech($nodes, speeches);
	$: coverage = speech ? computeCoverage($nodes, speech) : { speech: '', pages: [] };
	$: toAnswer = visiblePages.reduce((sum, page) => sum + page.toAnswer.length, 0);
	$: dropped = visiblePages.flatMap((page) => page.dropped.filter((item) => !item.extended));
	$: speechIndex = speech ? speeches.indexOf(speech) : -1;

	function palette(page: CoveragePage, offset: number) {
		// Column parity XOR invert decides the side, the same way Flow colors its columns.
		const primary = ((page.column - offset) % 2 === 0) !== page.invert;
		return primary ? 'accent' : 'accent-secondary';
	}
	// Keep the selected speech visible in the scrolling row without scrolling anything else.
	function centered(button: HTMLButtonElement, selected: boolean) {
		const update = (selected: boolean) => {
			const row = button.parentElement;
			if (selected && row)
				row.scrollLeft = button.offsetLeft - (row.clientWidth - button.offsetWidth) / 2;
		};
		update(selected);
		return { update };
	}
	function speechPalette(index: number) {
		return index % 2 === 0 ? 'accent' : 'accent-secondary';
	}

	function reveal(page: CoveragePage, id: BoxId) {
		if (selectedFlowId !== page.flowId) clickTab(page.flowId);
		showArgument(id);
	}
	async function respond(page: CoveragePage, item: CoverageItem) {
		if ($frozen) return;
		if (selectedFlowId !== page.flowId) clickTab(page.flowId);
		const id = addResponse(item.id);
		await tick();
		if (id) showArgument(id);
	}
	function extend(items: { page: CoveragePage; item: CoverageItem }[]) {
		if ($frozen || !items.length) return;
		const byPage = new Map<FlowId, BoxId[]>();
		for (const { page, item } of items)
			byPage.set(page.flowId, [...(byPage.get(page.flowId) ?? []), item.id]);
		for (const ids of byPage.values()) extendArguments(ids);
	}
	function label(item: CoverageItem) {
		return item.content || item.root || 'empty argument';
	}
	// Short lines like "ext" or "no" read better with the argument they answer underneath.
	function context(item: CoverageItem) {
		return item.root && item.content.length < 40 ? item.root : '';
	}
	$: allDropped = visiblePages.flatMap((page) =>
		page.dropped.filter((item) => !item.extended).map((item) => ({ page, item }))
	);
</script>

<section class="coverage-panel" aria-label="Coverage">
	<PanelHeader
		name="Coverage"
		detail={speech && speechIndex > 0
			? `${speech} · ${toAnswer} open${dropped.length ? ` · ${dropped.length} dropped` : ''}`
			: null}
		tooltip="what the selected speech still has to answer, and what the other side dropped"
		actions={[
			{
				label: 'Extend all dropped arguments',
				disabled: !allDropped.length || $frozen,
				run: () => extend(allDropped)
			}
		]}
	/>
	{#if speeches.length > 1}
		<div class="speeches panel-leading" class:customScrollbar={settings.data.customScrollbar.value}>
			{#each speeches as name, index}
				<button
					class={`speech palette-${speechPalette(index)}`}
					class:selected={name === speech}
					aria-pressed={name === speech}
					use:centered={name === speech}
					on:mousedown|preventDefault
					on:click={() => (pinned = name === timerSpeech ? null : name)}>{name}</button
				>
			{/each}
		</div>
	{/if}
	<div class="pages" class:customScrollbar={settings.data.customScrollbar.value}>
		{#if !speech || speechIndex < 1}
			<PanelStatus>Pick a speech to see what it has to answer.</PanelStatus>
		{:else if coverage.pages.length === 0}
			<PanelStatus>Nothing to answer before {speech} yet.</PanelStatus>
		{/if}
		{#each visiblePages as page (page.flowId)}
			<div class="page">
				<PanelRow
					palette={palette(page, 0)}
					selected={selectedFlowId === page.flowId}
					on:click={() => clickTab(page.flowId)}
				>
					<span class="page-name">{page.name || 'no name'}</span>
					<span class="count"
						>{page.toAnswer.length ? `${page.toAnswer.length} open` : 'all answered'}{page.dropped
							.length
							? ` · ${page.dropped.length} dropped`
							: ''}</span
					>
				</PanelRow>
				{#each page.toAnswer as item (item.id)}
					<PanelRow
						palette={palette(page, 1)}
						title="show this argument"
						on:click={() => reveal(page, item.id)}
					>
						{label(item)}{#if context(item)}<span class="context">{context(item)}</span>{/if}
						<svelte:fragment slot="actions">
							<Button
								icon="addRight"
								palette={palette(page, 1)}
								ariaLabel="Answer"
								tooltip="add a response in {speech}"
								disabled={$frozen}
								disabledReason="Wait for synchronization"
								on:click={() => respond(page, item)}
							/>
						</svelte:fragment>
					</PanelRow>
				{/each}
				{#each page.dropped as item (item.id)}
					<PanelRow
						palette={palette(page, 2)}
						weak={item.extended}
						title={item.extended ? 'extended in this speech' : 'the other side dropped this'}
						on:click={() => reveal(page, item.id)}
					>
						<span class="tag">{item.extended ? 'extended' : 'dropped'}</span>{label(
							item
						)}{#if context(item)}<span class="context">{context(item)}</span>{/if}
						<svelte:fragment slot="actions">
							{#if !item.extended}<Button
									icon="arrowRightThroughCircle"
									palette={palette(page, 2)}
									ariaLabel="Extend"
									tooltip="extend into {speech}"
									disabled={$frozen}
									disabledReason="Wait for synchronization"
									on:click={() => extend([{ page, item }])}
								/>{/if}
						</svelte:fragment>
					</PanelRow>
				{/each}
			</div>
		{/each}
	</div>
</section>

<style>
	.coverage-panel {
		display: flex;
		flex-direction: column;
		gap: var(--padding-small);
		min-height: 0;
		flex: 1;
	}
	.speeches {
		position: relative;
		display: flex;
		flex-shrink: 0;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.speeches::-webkit-scrollbar {
		display: none;
	}
	.speech {
		flex-shrink: 0;
		border: none;
		background: none;
		border-radius: var(--border-radius);
		color: var(--this-text);
		font: inherit;
		font-weight: var(--font-weight);
		padding: var(--padding);
		white-space: nowrap;
		transition: background var(--transition-speed);
	}
	.speech:hover {
		background: var(--this-background-indent);
	}
	.speech:active,
	.speech.selected {
		transition: none;
		background: var(--this-background-active);
	}
	.pages {
		display: flex;
		flex-direction: column;
		gap: var(--padding);
		overflow-y: auto;
		min-height: 0;
	}
	.page {
		display: flex;
		flex-direction: column;
	}
	.page-name {
		font-weight: var(--font-weight-bold);
	}
	.count,
	.context,
	.tag {
		color: var(--this-text-weak);
		font-size: 0.85em;
	}
	.count {
		padding-left: var(--padding);
	}
	.context {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tag {
		padding-right: var(--padding);
	}
</style>
