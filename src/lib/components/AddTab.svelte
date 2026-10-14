<script lang="ts">
	import Button from './Button.svelte';
	import TutorialHighlight from './TutorialHighlight.svelte';
	import {
		getDebateStyleFlow,
		getAllDebateStyleFlows,
		type DebateStyleFlow
	} from '$lib/models/debateStyle';
	import { settings } from '$lib/models/settings';
	import { onDestroy } from 'svelte';

	export let addFlow: (type: DebateStyleFlow) => void;
	export let switchSpeakers: boolean;
	export let disabled = false;

	let primaryFlow: DebateStyleFlow | null;
	let secondaryFlow: DebateStyleFlow | null;
	let templates: DebateStyleFlow[];
	let hasSwitch: boolean;

	onDestroy(
		settings.subscribe(['any'], (key: string) => {
			// This could be a specific subscribe, but it doesn't hurt performance much to subscribe to all and is easier
			templates = getAllDebateStyleFlows();
			primaryFlow = getDebateStyleFlow('primary');
			secondaryFlow = getDebateStyleFlow('secondary');
			if (primaryFlow != null) {
				hasSwitch = primaryFlow.columnsSwitch != null;
			}
		})
	);

	function flipPairs(arr: DebateStyleFlow[]) {
		// produce new array where [0,1,2,3] => [1,0,3,2]
		const result = [];
		for (let i = 0; i < arr.length; i += 2) {
			if (arr[i + 1]) {
				result.push(arr[i + 1]);
				result.push(arr[i]);
			} else {
				result.push(arr[i]);
			}
		}
		return result;
	}

	$: flippedTemplates = flipPairs(templates);

	$: currentStyleTemplates = hasSwitch && switchSpeakers ? flippedTemplates : templates;
</script>

<div class="addTab" class:hasSwitch class:switch={switchSpeakers}>
	<div class="buttons">
		{#each currentStyleTemplates as flow, index}
			{#if index === 0 || index === 1}
				<TutorialHighlight step={6 + index}>
					<!-- Page controls follow the New flow button in the tutorial. -->
					<!-- index % 2 === (switchSpeakers ? 1 : 0) can be used instead of !flow.invert for mandatory flip-flop colors -->
					<Button
						{disabled}
						disabledReason="create a flow first"
						text={flow.name}
						palette={disabled ? null : !flow.invert ? 'accent' : 'accent-secondary'}
						icon="add"
						on:click={() => addFlow(flow)}
						tooltip={`create new ${flow.name} flow`}
						shortcut={index === 0
							? ['control', 'n']
							: index === 1
							? ['control', 'shift', 'n']
							: null}
					/>
				</TutorialHighlight>
			{/if}
			{#if index > 1}
				<!-- Only use the first two buttons in the tutorial -->
				<Button
					{disabled}
					disabledReason="create a flow first"
					text={flow.name}
					palette={disabled ? null : !flow.invert ? 'accent' : 'accent-secondary'}
					icon="add"
					on:click={() => addFlow(flow)}
					tooltip={`create new ${flow.name} flow`}
				/>
			{/if}
		{/each}
	</div>
	{#if primaryFlow != null && secondaryFlow != null && hasSwitch}
		<div class="switch">
			<Button
				{disabled}
				disabledReason="create a flow first"
				text={'first'}
				icon="arrowLeft"
				palette={switchSpeakers ? 'accent-secondary' : 'accent'}
				tooltip={switchSpeakers
					? `set ${primaryFlow.name} to first speaker`
					: `set ${secondaryFlow.name} to first speaker`}
				on:click={() => (switchSpeakers = !switchSpeakers)}
			/>
		</div>
	{/if}
</div>

<style>
	.buttons {
		display: flex;
		position: relative;
		flex-wrap: wrap;
		align-items: stretch;
		flex-direction: row;
		gap: var(--padding);
	}
	.hasSwitch .buttons {
		flex-direction: column;
	}
	.addTab.hasSwitch {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
	}
</style>
