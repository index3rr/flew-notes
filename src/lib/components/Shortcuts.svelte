<script lang="ts">
	import Shortcut from './Shortcut.svelte';
	import { settings } from '$lib/models/settings';

	type ShortcutEntry = {
		keys: string[];
		description: string;
		note?: string;
	};

	type ShortcutGroup = {
		name: string;
		context: string;
		shortcuts: ShortcutEntry[];
	};

	const groups: ShortcutGroup[] = [
		{
			name: 'Global',
			context: 'Inside an open flow document',
			shortcuts: [
				{
					keys: ['control', 'n'],
					description: 'Add primary flow page'
				},
				{
					keys: ['control', 'shift', 'n'],
					description: 'Add secondary flow page'
				},
				{ keys: ['commandControl', 'z'], description: 'Undo' },
				{ keys: ['commandControl', 'shift', 'z'], description: 'Redo' },
				{ keys: ['commandControl', 's'], description: 'Save flow' },
				{
					keys: ['commandControl', 'option', 'up'],
					description: 'Switch to previous tab',
					note: 'Wraps around the open flow pages'
				},
				{
					keys: ['commandControl', 'option', 'down'],
					description: 'Switch to next tab',
					note: 'Wraps around the open flow pages'
				}
			]
		},
		{
			name: 'Navigation',
			context: 'When a cell is focused',
			shortcuts: [
				{ keys: ['up'], description: 'Focus cell above' },
				{ keys: ['down'], description: 'Focus cell below' },
				{ keys: ['left'], description: 'Move to parent cell' },
				{ keys: ['right'], description: 'Move to first child / response' },
				{
					keys: ['tab'],
					description: 'Focus next sibling cell'
				},
				{ keys: ['shift', 'tab'], description: 'Focus previous sibling cell' }
			]
		},
		{
			name: 'Selection',
			context: 'Within one flow page',
			shortcuts: [
				{
					keys: ['shift', 'up'],
					description: 'Select through the cell above'
				},
				{
					keys: ['shift', 'down'],
					description: 'Select through the cell below'
				},
				{
					keys: ['shift', 'left'],
					description: 'Select through the parent cell'
				},
				{
					keys: ['shift', 'right'],
					description: 'Select through the first response'
				},
				{
					keys: ['shift', 'click'],
					description: 'Select a range of cells'
				}
			]
		},
		{
			name: 'Cell Creation',
			context: 'When a cell is focused',
			shortcuts: [
				{
					keys: ['return'],
					description: 'Focus or add cell below'
				},
				{ keys: ['shift', 'return'], description: 'Add response (child cell)' },
				{
					keys: ['option', 'return'],
					description: 'Focus or add cell above'
				},
				{
					keys: ['option', 'shift', 'return'],
					description: 'Add a response to the next parent argument'
				}
			]
		},
		{
			name: 'Cell Manipulation',
			context: 'When a cell is focused',
			shortcuts: [
				{
					keys: ['commandControl', 'b'],
					description: 'Toggle bold'
				},
				{
					keys: ['control', 'shift', 'x'],
					description: 'Toggle crossed out'
				},
				{
					keys: ['commandControl', 'shift', 's'],
					description: 'Toggle starred argument'
				},
				{
					keys: ['control', 'l'],
					description: 'Fold / collapse cell'
				},
				{
					keys: ['commandControl', 'e'],
					description: 'Extend cell'
				},
				{
					keys: ['backspace'],
					description: 'Delete empty cell or extension'
				},
				{
					keys: ['commandControl', 'backspace'],
					description: 'Delete cell and its responses'
				}
			]
		},
		{
			name: 'Clipboard',
			context: 'When a cell is focused',
			shortcuts: [
				{
					keys: ['commandControl', 'c'],
					description: 'Copy cell or selected cells, including responses'
				},
				{
					keys: ['commandControl', 'x'],
					description: 'Cut cell or selected cells, including responses'
				},
				{
					keys: ['commandControl', 'v'],
					description: 'Paste copied cells and their responses',
					note: 'If the cell you paste into is not empty, the pasted cells become its children.'
				}
			]
		},
		{
			name: 'Flow page title',
			context: 'When editing a page title',
			shortcuts: [
				{ keys: ['return'], description: 'Move focus to first cell' },
				{ keys: ['down'], description: 'Move focus to first cell' },
				{ keys: ['right'], description: 'Move focus to first cell' }
			]
		},
		{
			name: 'Document title',
			context: 'The title in the sidebar',
			shortcuts: [
				{
					keys: ['return'],
					description: 'Create a document or commit its title'
				}
			]
		},
		{
			name: 'Timers',
			context: 'When editing a paused timer',
			shortcuts: [
				{ keys: ['up'], description: 'Increase the focused minutes or seconds field' },
				{ keys: ['down'], description: 'Decrease the focused minutes or seconds field' },
				{ keys: ['right'], description: 'Move from minutes to seconds' },
				{ keys: ['left'], description: 'Move from seconds to minutes' }
			]
		}
	];

	let groupHeaderElements: HTMLElement[] = new Array(groups.length);

	function scrollToGroup(index: number) {
		groupHeaderElements[index]?.scrollIntoView();
	}
</script>

<div class="top palette-plain">
	<div class="outline">
		<div class="outlineScroll" class:customScrollbar={settings.data.customScrollbar.value}>
			<ul>
				{#each groups as group, i}
					<li>
						<button on:click={() => scrollToGroup(i)}>
							{group.name}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	</div>
	<div class="content" class:customScrollbar={settings.data.customScrollbar.value}>
		<ul class="shortcut-list">
			{#each groups as group, i}
				<li class="group-header" bind:this={groupHeaderElements[i]}>
					<h1>{group.name}</h1>
					<p class="context">{group.context}</p>
				</li>
				{#each group.shortcuts as shortcut}
					<li class="shortcut-row">
						<div class="keys">
							<Shortcut keys={shortcut.keys} />
						</div>
						<div class="label">
							<span class="description">{shortcut.description}</span>
							{#if shortcut.note}
								<span class="note">{shortcut.note}</span>
							{/if}
						</div>
					</li>
				{/each}
			{/each}
		</ul>
	</div>
</div>

<style>
	.top {
		width: min(calc(100vw - var(--padding) * 2), 700px);
		height: min(calc(100vh - var(--padding) * 2), 600px);
		display: grid;
		grid-template-columns: calc(max(130px, 20%) + var(--padding-big)) 1fr;
	}

	.outline {
		width: 100%;
		padding-top: calc(var(--button-size) + var(--padding) * 2);
		box-sizing: border-box;
		background-color: var(--background-secondary);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.outlineScroll {
		overflow: auto;
		height: 100%;
		padding: 0 var(--padding);
	}

	.outlineScroll ul {
		padding-bottom: 50vh;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.outline button {
		border: none;
		background: none;
		display: block;
		width: 100%;
		text-align: left;
		border-radius: var(--border-radius);
		color: var(--this-text);
		padding: var(--padding);
		overflow-wrap: break-word;
		transition: background var(--transition-speed);
		font-weight: var(--font-weight-bold);
		margin-top: var(--padding);
		cursor: pointer;
	}

	.outline button:hover {
		background-color: var(--this-background-indent);
	}

	.outline button:active {
		transition: none;
		background-color: var(--this-background-active);
	}

	.content {
		box-sizing: border-box;
		width: 100%;
		padding-top: calc(var(--button-size) + var(--padding));
		overflow: auto;
		scroll-behavior: smooth;
		height: inherit;
	}

	.shortcut-list {
		list-style: none;
		margin: 0;
		padding: 0 var(--padding-big);
		padding-bottom: 50vh;
		display: flex;
		flex-direction: column;
	}

	.group-header {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		gap: var(--padding);
		padding: calc(var(--padding-big) * 1.5) 0 var(--padding) 0;
	}

	.group-header:first-child {
		padding-top: var(--padding-big);
	}

	.group-header h1 {
		font-weight: var(--font-weight-bold);
		margin: 0;
	}

	.group-header p.context {
		color: var(--this-text-weak);
		margin: 0;
		font-size: 0.85em;
	}

	.shortcut-row {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: var(--padding-big);
		padding: var(--padding) 0;
	}

	.keys {
		min-width: 9rem;
		flex-shrink: 0;
	}

	.label {
		display: flex;
		flex-direction: column;
		gap: 0.2em;
	}

	.description {
		font-size: 0.9em;
	}

	.note {
		font-size: 0.8em;
		color: var(--this-text-weak);
	}

	@media (max-width: 600px) {
		.top {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}

		.outline {
			padding-top: calc(var(--button-size) + var(--padding) * 2);
			height: auto;
		}

		.outlineScroll {
			height: auto;
			max-height: 8rem;
		}

		.outlineScroll ul {
			display: flex;
			flex-direction: row;
			flex-wrap: wrap;
			gap: var(--padding-small);
			padding: var(--padding);
		}

		.outline button {
			margin-top: 0;
			width: auto;
		}
	}
</style>
