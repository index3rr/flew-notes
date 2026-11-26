<script lang="ts">
	import Walkthrough from '../Walkthrough.svelte';
	import { panelHelp } from '$lib/models/panelHelp';
	import { panelNames, type PanelId } from '$lib/models/panels';
	import { panelTutorialStep, finishPanelTutorial } from '$lib/models/tutorial';
	export let panel: PanelId;
	$: guide = panelHelp[panel];
	$: index = Math.min($panelTutorialStep, guide.steps.length - 1);
</script>

<Walkthrough
	panel
	name={'How to use ' + panelNames[panel]}
	title={guide.summary}
	text={guide.steps[index]}
	{index}
	total={guide.steps.length}
	ariaLabel={panelNames[panel] + ' tutorial'}
	back={() => panelTutorialStep.update((n) => Math.max(0, n - 1))}
	next={() => panelTutorialStep.update((n) => n + 1)}
	finish={finishPanelTutorial}
/>
