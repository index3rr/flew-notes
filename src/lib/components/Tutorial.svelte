<script lang="ts">
	import Walkthrough from './Walkthrough.svelte';
	import { tutorialStep } from '$lib/models/store';
	import { documentOpen } from '$lib/models/document';
	import { finishTutorial } from '$lib/models/tutorial';
	import { panelIds } from '$lib/models/panels';
	export let panel = false;
	const steps = [
		{
			title: 'Create a flow',
			text: 'Make a name and push the plus icon next to it to start a flow. It will be autosaved locally to your browser, but you can also save it to a file.'
		},
		{
			title: 'Add flow pages',
			text: "The buttons on the Tabs panel (below the flow's name) let you make pages, and the text field at the top of those pages lets you name them"
		},
		{
			title: 'Start flowing',
			text: 'On a flow page, use enter to add another argument, shift enter to add a response, and the arrow keys to navigate. You can also push the plus button at the top of the column to add a response not connected to anything.'
		},
		{
			title: 'Select boxes',
			text: 'Drag across several cells, shift click another cell with a cell selected, or control/command click a cell to add it or remove it from the selection. With cells selected, you can move them around the flow, and even into panels like the notes panel. You can also select multiple arguments and push shift enter to group those arguments with one or more responses.'
		},
		{
			title: 'Flow management',
			text: "Click the X next to a flow title to close it, don’t worry, it's autosaved! Here you can see the most recent flows you've used. Up to the 20 most recent will be saved by default, but you can change that number in settings. You can download, delete, and copy saves here, as well as linking a folder to store all your flows as a file. If you enable the flow library panel, you can drag flow pages from other flows directly into the flow you’re working on."
		},
		{
			title: 'Live collaboration',
			text: "Work on the same flow as your partner with live instant collaboration to make sure you don't miss anything in your speech and for quick and easy communication."
		},
		{
			title: 'Customize to your liking',
			text: `Settings has an enormous number of configurable options for flew, including ${panelIds.length} panels with their own tutorials and use cases like notes, SpeechDrop integration, and more`
		},
		{
			title: 'Use the tooltips',
			text: 'There are a lot of really useful tooltips to tell you how this program works which you can see by hovering over names and buttons.'
		}
	];
	$: index = Math.max(0, Math.min($tutorialStep, steps.length - 1));
</script>

<Walkthrough
	name="How to use Flew"
	title={steps[index].title}
	text={steps[index].text}
	{panel}
	{index}
	total={steps.length}
	back={() => tutorialStep.update((n) => Math.max(0, n - 1))}
	next={() => tutorialStep.update((n) => n + 1)}
	finish={finishTutorial}
	nextDisabledReason={index === 0 && !$documentOpen
		? 'create a flow with the plus beside its name'
		: null}
/>
