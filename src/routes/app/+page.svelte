<script lang="ts">
	import Flow from '$lib/components/Flow.svelte';
	import Title from '$lib/components/Title.svelte';
	import BoxControl from '$lib/components/BoxControl.svelte';
	import ButtonBar from '$lib/components/ButtonBar.svelte';
	import DownloadUpload from '$lib/components/DownloadUpload.svelte';
	import Message from '$lib/components/Message.svelte';
	import Settings from '$lib/components/Settings.svelte';
	import Share from '$lib/components/Share.svelte';
	import { dev } from '$app/environment';
	import { openPopup } from '$lib/models/popup';
	import type { FlowId, Nodes } from '$lib/models/node';
	import { onDestroy, onMount } from 'svelte';
	import { activeMouse, flowsChange, nodes, pendingAction } from '$lib/models/store';
	import { createKeyDownHandler } from '$lib/models/key';
	import Prelude from '$lib/components/Prelude.svelte';
	import { loadNodes, importSettingsJson } from '$lib/models/file';
	import { trackFileImported } from '$lib/models/telemetry';
	import Help from '$lib/components/Help.svelte';
	import { settings } from '$lib/models/settings';
	import PanelContainer from '$lib/components/PanelContainer.svelte';
	import { history } from '$lib/models/history';
	import { focusId, lastFocusIds, selectedFlowId } from '$lib/models/focus';
	import { isChangelogVersionCurrent } from '$lib/models/version';
	import { addNewFlow, deleteFlow, moveFlow, replaceNodes } from '$lib/models/nodeDecorateAction';
	import { getDebateStyleFlow, type DebateStyleFlow } from '$lib/models/debateStyle';

	$: unsavedChanges = $nodes.root.children.length > 0;

	onMount(() => {
		window.addEventListener(
			'dragover',
			function (e) {
				e.preventDefault();
			},
			false
		);
		window.addEventListener(
			'drop',
			function (e) {
				e.preventDefault();
			},
			false
		);
		// changes you made may not be saved
		window.addEventListener('beforeunload', function (e) {
			if (unsavedChanges && !dev) {
				let confirmationMessage = 'Are you sure you want to leave?';
				e.returnValue = confirmationMessage;
				return confirmationMessage;
			}
		});
	});

	let hasRightPanels = false;
	let panelSubUnsub = settings.subscribe(['tabsPanel', 'timersPanel', 'notesPanel'], () => {
		const leftVal = (k: string) => settings.data[k]?.value as number;
		const rightCount = [leftVal('tabsPanel'), leftVal('timersPanel'), leftVal('notesPanel')].filter(
			(v) => v === 2
		).length;
		hasRightPanels = rightCount > 0;
	});
	onDestroy(panelSubUnsub);

	function clickTab(id: FlowId) {
		blurFlow();
		$selectedFlowId = id;
		focusFlow();
	}
	function focusFlow() {
		if ($selectedFlowId == null) return;
		let lastFocus = $lastFocusIds[$selectedFlowId];
		if (lastFocus == null) {
			lastFocus = $selectedFlowId;
		}
		$focusId = lastFocus;
	}
	function blurFlow() {
		$focusId = null;
	}

	function addFlow(style: DebateStyleFlow) {
		blurFlow();
		let id = addNewFlow($nodes.root.children.length, style, switchSpeakers);
		if (id != null) {
			$selectedFlowId = id;
			focusFlow();
		}
	}

	async function deleteFlowAndFocus() {
		if ($selectedFlowId == null) return;

		blurFlow();

		let oldIndex = $nodes.root.children.indexOf($selectedFlowId);
		deleteFlow($selectedFlowId);

		let nextIndex;
		if (oldIndex == 0) {
			nextIndex = 0;
		} else {
			nextIndex = oldIndex - 1;
		}
		if ($nodes.root.children.length > 0) {
			$selectedFlowId = $nodes.root.children[nextIndex];
			focusFlow();
		} else {
			$selectedFlowId = null;
		}
	}

	function handleSort(e: { detail: { from: number; to: number } }) {
		let { from, to } = e.detail;
		if (from > to) {
			to += 1;
		}
		moveFlow($nodes.root.children[from], to);
	}

	function handleMouseMove(e: MouseEvent) {
		$activeMouse = true;
	}
	const keyDownHandler = createKeyDownHandler({
		control: {
			n: {
				handle: () => {
					const style = getDebateStyleFlow("primary");
					if (style == null) return;
					addFlow(style);
				},
				require: () => getDebateStyleFlow("primary") != null
			}
		},
		'control shift': {
			n: {
				handle: () => {
					const style = getDebateStyleFlow("secondary");
					if (style == null) return;
					addFlow(style);
				},
				require: () => getDebateStyleFlow("secondary") != null
			}
		},
		'commandControl shift': {
			z: {
				handle: () => {
					if ($selectedFlowId == null) return;
					history.redo($selectedFlowId, $pendingAction);
				},
				require: () => {
					if ($selectedFlowId == null) return false;
					return history.canRedo($selectedFlowId, $pendingAction);
				},
				stopRepeat: false,
				preventDefault: 'always'
			}
		},
		commandControl: {
			z: {
				handle: () => {
					if ($selectedFlowId == null) return;
					history.undo($selectedFlowId, $pendingAction);
				},
				require: () => {
					if ($selectedFlowId == null) return false;
					return history.canUndo($selectedFlowId, $pendingAction);
				},
				stopRepeat: false,
				preventDefault: 'always'
			}
		},
		'commandControl alt': {
			ArrowUp: {
				handle: () => {
					if ($selectedFlowId == null) return;
					let index =
						($nodes.root.children.indexOf($selectedFlowId) - 1) % $nodes.root.children.length;
					if (index < 0) {
						index = $nodes.root.children.length - 1;
					}
					clickTab($nodes.root.children[index]);
				},
				require: () => $nodes.root.children.length > 0,
				stopRepeat: false
			},
			ArrowDown: {
				handle: () => {
					if ($selectedFlowId == null) return;
					let index =
						($nodes.root.children.indexOf($selectedFlowId) + 1) % $nodes.root.children.length;
					clickTab($nodes.root.children[index]);
				},
				require: () => $nodes.root.children.length > 0,
				stopRepeat: false
			}
		}
	});
	function handleKeydown(e: KeyboardEvent) {
		$activeMouse = false;
		keyDownHandler(e);
	}

	function readUploadDragged(e: DragEvent) {
		e.preventDefault();
		let file = e?.dataTransfer?.files[0];
		if (file == undefined) {
			return;
		}

		let reader: FileReader = new FileReader();
		reader.onload = function (fileLoadedEvent) {
			let uploadData = fileLoadedEvent.target?.result;
			if (uploadData == undefined) return;
			handleUpload(uploadData.toString());
		};
		// check if can readAsText
		if (file.type == 'text/plain') {
			reader.readAsText(file, 'UTF-8');
		} else if (file.type == 'application/json') {
			reader.readAsText(file, 'UTF-8');
		} else {
			openPopup(Message, 'File Message', {
				message: 'Invalid file',
				error: true
			});
		}
	}
	function readUpload() {
		const fileInput = document.getElementById('uploadId') as HTMLInputElement;
		if (!fileInput?.files?.length) return;
		const file = fileInput.files[0];

		let reader: FileReader = new FileReader();
		reader.onload = function (fileLoadedEvent) {
			let uploadData = fileLoadedEvent.target?.result;
			if (uploadData == undefined) return;
			handleUpload(uploadData.toString());

			fileInput.value = ''; // allow for the same file to be reuploaded
		};
		reader.readAsText(file, 'UTF-8');
	}

	function preventDefault(e: { preventDefault: () => void }) {
		e.preventDefault();
	}

	async function handleUpload(data: string) {
		let dataObj = JSON.parse(data);
		if (dataObj["isSettings"]) {
			importSettingsJson(dataObj);
			return;
		}

		let newNodes: Nodes | null = null;
		try {
			newNodes = loadNodes(dataObj);
		} catch (e) {
			openPopup(Message, 'File Message', {
				message: 'Invalid file',
				error: true
			});
		}
		if (newNodes != null) {
			if (!unsavedChanges || confirm('Are you sure you want to overwrite your current flows?')) {
				replaceNodes(newNodes);
				$selectedFlowId = null;
				flowsChange();
				trackFileImported('json', newNodes.root.children.length);
			}
		}
	}

	let switchSpeakers = false;

	// Custom scrollbar/overflow logic
	onMount(() => { 
		document.body.classList.add("app");
	});

	onDestroy(() => {
		document.body.classList.remove("app");
		document.body.classList.remove("customScrollbar");
	});

	$: {
		if (settings.data.customScrollbar.value) {
			document.body.classList.add("customScrollbar");
		} else {
			document.body.classList.remove("customScrollbar");
		}
	}

	function fixScroll(event: Event) {
		const el = event.currentTarget as HTMLDivElement;
		if (el.scrollTop !== 0) {
			el.scrollTop = 0;
		}
	}

	// TODO:
	// add custom background color
	// add command K
	// add command f
	// add capitalization
</script>

<svelte:body
	on:keydown={handleKeydown}
	on:mousemove={handleMouseMove}
	on:dragenter={preventDefault}
	on:drop={readUploadDragged}
/>
<main class:activeMouse class="palette-plain">
	<input id="uploadId" type="file" hidden on:change={readUpload} />
	<div class="grid" class:showPrelude={!($nodes.root.children.length > 0)}>
		<div class="sidebar">
			<div class="header">
				<ButtonBar
					resize
					buttons={[
						{
							icon: 'link',
							onclick: () => openPopup(Help, 'Help'),
							tooltip: $isChangelogVersionCurrent ? 'help' : 'new updates',
							tutorialHighlight: 1,
							notification: !$isChangelogVersionCurrent
						},
						{
							icon: 'gear',
							onclick: () => openPopup(Settings, 'Settings'),
							tooltip: 'settings',
							tutorialHighlight: 2
						},
						{
							icon: 'file',
							onclick: () => openPopup(DownloadUpload, 'File'),
							tooltip: 'file',
							tutorialHighlight: 3
						},
						{
							icon: 'people',
							onclick: () => openPopup(Share, 'Share'),
							tooltip: 'share',
							tutorialHighlight: 4
						},
					]}
				/>
			</div>
		<PanelContainer
			side="left"
			selectedFlowId={$selectedFlowId}
			{clickTab}
			{addFlow}
			{handleSort}
			bind:switchSpeakers
		/>
		</div>
		{#if $nodes.root.children.length > 0}
			{#if $selectedFlowId != null && $nodes[$selectedFlowId]}
				{#key $selectedFlowId}
					<div class="title">
						<Title flowId={$selectedFlowId} deleteSelf={() => deleteFlowAndFocus()} />
					</div>
					<div class="box-control">
						<BoxControl flowId={$selectedFlowId} />
					</div>
					<div class="flow" class:customScrollbar={settings.data.customScrollbar.value} on:scroll={fixScroll}>
						<Flow on:focusFlow={focusFlow} flowId={$selectedFlowId} />
					</div>
				{/key}
			{/if}
			{#if hasRightPanels}
				<div class="right-sidebar">
					<PanelContainer side="right" />
				</div>
			{/if}
		{:else}
			<div class="prelude">
				<Prelude />
			</div>
		{/if}
	</div>
</main>

<style>
	:global(body.app) {
		overflow-x: auto;
		overflow-y: clip;
	}
	.grid {
		display: grid;
		gap: var(--gap);
		grid-template-areas:
			'sidebar title box-control'
			'sidebar flow flow';
		grid-template-columns: var(--sidebar-width) 1fr auto;
		padding: var(--main-margin);
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		position: relative;
	}
	.grid:has(.right-sidebar) {
		grid-template-areas:
			'sidebar title box-control right-sidebar'
			'sidebar flow flow right-sidebar';
		grid-template-columns: var(--sidebar-width) 1fr auto var(--panel-width);
	}
	.grid.showPrelude {
		grid-template-areas: 'sidebar prelude';
		grid-template-columns: var(--sidebar-width) auto;
	}

	.sidebar {
		background: var(--background);
		width: 100%;
		height: var(--main-height);
		border-radius: var(--border-radius);
		padding: var(--padding);
		grid-area: sidebar;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
	}
	.header {
		height: auto;
		padding-bottom: var(--padding);
		flex-shrink: 0;
	}
	.right-sidebar {
		background: var(--background);
		width: 100%;
		height: var(--main-height);
		border-radius: var(--border-radius);
		padding: var(--padding);
		grid-area: right-sidebar;
		box-sizing: border-box;
	}

	.title {
		background: var(--background);
		border-radius: var(--border-radius);
		width: 100%;
		grid-area: title;
		height: var(--title-height);
	}
	.box-control {
		background: var(--background);
		border-radius: var(--border-radius);
		width: 100%;
		grid-area: box-control;
		height: var(--title-height);
	}
	.flow {
		width: 100%;
		overflow-x: auto;
		overflow-y: clip;
		background: var(--background);
		z-index: 0;
		border-radius: var(--border-radius);
		grid-area: flow;
		height: var(--view-height);
	}
	.prelude {
		position: relative;
		width: calc(100vw - var(--sidebar-width) - var(--gap) * 3);
		height: var(--main-height);
		grid-area: prelude;
	}
</style>
