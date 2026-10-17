<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import FlowLibrarySetup from '$lib/components/FlowLibrarySetup.svelte';
	import { documentTitle } from '$lib/models/document';
	import {
		restoreLibrary,
		library,
		hasDiskFile,
		directFolderAccess
	} from '$lib/models/flowLibrary';
	import {
		saveStatus,
		dirty,
		maybeSaveNodes,
		saveNodes,
		saveDocument,
		openDocument,
		documentOpen,
		createDocument,
		closeDocument
	} from '$lib/models/autoSave';
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
	import { disconnectCardMirror } from '$lib/models/cardMirror';
	import { onDestroy, onMount } from 'svelte';
	import { activeMouse, nodes, pendingAction, frozen } from '$lib/models/store';
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
	import { addNewFlow, deleteFlow, moveFlow, importFlowPage } from '$lib/models/nodeDecorateAction';
	import { getDebateStyleFlow, type DebateStyleFlow } from '$lib/models/debateStyle';

	$: unsavedToDisk = $documentOpen && $library.connected && !$library.imported && !$hasDiskFile;
	$: closeLabel = unsavedToDisk ? 'Close without saving' : 'Close flow';
	$: unsavedChanges = $nodes.root.children.length > 0;
	let isOnline = true;
	let libraryBusy = false;
	let libraryError = '';
	let chooseFileInput: HTMLInputElement;
	function saveFlow() {
		if (!directFolderAccess || !$library.connected || $library.imported) {
			void saveNodes();
			openPopup(DownloadUpload, 'Save flow');
		} else void saveDocument($hasDiskFile);
	}

	async function toggleDocument() {
		if (libraryBusy) return;
		libraryBusy = true;
		libraryError = '';
		try {
			if ($documentOpen) await closeDocument();
			else await createDocument();
		} catch (error) {
			libraryError = (error as Error).message;
		} finally {
			libraryBusy = false;
		}
	}

	onMount(() => {
		libraryBusy = true;
		void restoreLibrary().finally(() => {
			libraryBusy = false;
		});
		const saveOnHide = () => {
			if (document.visibilityState === 'hidden') void saveNodes();
		};
		const saveOnExit = () => {
			void saveNodes();
		};
		window.addEventListener('pagehide', saveOnExit);
		document.addEventListener('visibilitychange', saveOnHide);
		return () => {
			window.removeEventListener('pagehide', saveOnExit);
			document.removeEventListener('visibilitychange', saveOnHide);
		};
	});
	onMount(() => {
		const updateOnlineStatus = () => (isOnline = navigator.onLine);
		updateOnlineStatus();
		window.addEventListener('online', updateOnlineStatus);
		window.addEventListener('offline', updateOnlineStatus);
		return () => {
			window.removeEventListener('online', updateOnlineStatus);
			window.removeEventListener('offline', updateOnlineStatus);
		};
	});

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
			void saveNodes();
			if ($dirty && !dev) {
				let confirmationMessage = 'Are you sure you want to leave?';
				e.returnValue = confirmationMessage;
				return confirmationMessage;
			}
		});
	});

	let hasRightPanels = false;
	let panelSubUnsub = settings.subscribe(
		[
			'tabsPanel',
			'timersPanel',
			'notesPanel',
			'starredPanel',
			'speechDropPanel',
			'libraryPanel',
			'transcriptPanel',
			'collaborationPanel',
			'cardMirrorPanel'
		],
		() => {
			const leftVal = (k: string) => settings.data[k]?.value as number;
			const rightCount = [
				leftVal('tabsPanel'),
				leftVal('timersPanel'),
				leftVal('notesPanel'),
				leftVal('starredPanel'),
				leftVal('speechDropPanel'),
				leftVal('libraryPanel'),
				leftVal('transcriptPanel'),
				leftVal('collaborationPanel'),
				leftVal('cardMirrorPanel')
			].filter((v) => v === 2 || v === 4).length;
			hasRightPanels = rightCount > 0;
		}
	);
	onDestroy(panelSubUnsub);
	onDestroy(disconnectCardMirror);
	let showFlowLibraryBar = true;
	onDestroy(
		settings.subscribe(['showFlowLibraryBar'], () => {
			showFlowLibraryBar = settings.data.showFlowLibraryBar.value as boolean;
		})
	);

	let showSaveButton = settings.data.showSaveButton.value as boolean;
	onDestroy(
		settings.subscribe(['showSaveButton'], (key) => {
			showSaveButton = settings.data[key].value as boolean;
		})
	);

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
		if (!$documentOpen || libraryBusy || $frozen) return;
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
					const style = getDebateStyleFlow('primary');
					if (style == null) return;
					addFlow(style);
				},
				require: () => $documentOpen && getDebateStyleFlow('primary') != null
			}
		},
		'control shift': {
			n: {
				handle: () => {
					const style = getDebateStyleFlow('secondary');
					if (style == null) return;
					addFlow(style);
				},
				require: () => $documentOpen && getDebateStyleFlow('secondary') != null
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
			s: {
				handle: () => {
					if ($library.imported) void saveNodes();
					else saveFlow();
				},
				require: () => $documentOpen && !$frozen && !libraryBusy,
				preventDefault: 'always'
			},
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
	function commitDocumentTitle() {
		if ($documentOpen && !$frozen && !libraryBusy) void saveNodes($nodes, true);
	}
	function handleDocumentTitleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter' || e.isComposing || e.repeat || libraryBusy || $frozen) return;
		e.preventDefault();
		e.stopPropagation();
		if ($documentOpen) commitDocumentTitle();
		else void toggleDocument();
	}

	function handleEditorInput(e: Event) {
		const target = e.target as HTMLElement;
		if (target.matches('.document-title') || target.closest('.flow, .title, .side-doc'))
			maybeSaveNodes();
	}
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
	function readUpload(event: Event, duplicate = false) {
		const fileInput = event.currentTarget as HTMLInputElement;
		if (!fileInput?.files?.length) return;
		const file = fileInput.files[0];

		let reader: FileReader = new FileReader();
		reader.onload = function (fileLoadedEvent) {
			let uploadData = fileLoadedEvent.target?.result;
			if (uploadData == undefined) return;
			void handleUpload(uploadData.toString(), duplicate).catch((error: Error) => {
				openPopup(Message, 'File Message', { message: error.message, error: true });
			});

			fileInput.value = ''; // allow for the same file to be reuploaded
		};
		reader.readAsText(file, 'UTF-8');
	}

	function preventDefault(e: { preventDefault: () => void }) {
		e.preventDefault();
	}

	function dropPage(event: DragEvent) {
		const raw = event.dataTransfer?.getData('application/x-flew-page');
		if (!raw || $frozen || !$documentOpen) return;
		event.preventDefault();
		try {
			const data = JSON.parse(raw);
			const source = loadNodes({ version: 1, nodes: data.nodes }, false);
			if (!source.root.children.includes(data.id)) throw new Error('Invalid page');
			let index = $nodes.root.children.length;
			const tabs = event.target instanceof Element ? event.target.closest('.tabs') : null;
			const targetRow =
				event.target instanceof Element
					? event.target.closest<HTMLElement>('.tabs li[data-index]')
					: null;
			if (targetRow) {
				const bounds = targetRow.getBoundingClientRect();
				index =
					Number(targetRow.dataset.index) +
					(event.clientY > bounds.top + bounds.height / 2 ? 1 : 0);
			} else if (tabs) {
				const rows = Array.from(tabs.querySelectorAll<HTMLElement>('li[data-index]'));
				const before = rows.find((row) => {
					const bounds = row.getBoundingClientRect();
					return event.clientY < bounds.top + bounds.height / 2;
				});
				if (before) index = Number(before.dataset.index);
			}
			const id = importFlowPage(source, data.id, index);
			if (id) clickTab(id);
		} catch (error) {
			libraryError = (error as Error).message;
		}
	}

	async function handleUpload(data: string, duplicate = false) {
		let dataObj;
		try {
			dataObj = JSON.parse(data);
		} catch {
			openPopup(Message, 'File Message', { message: 'Invalid file', error: true });
			return;
		}
		if (dataObj['isSettings']) {
			importSettingsJson(dataObj);
			return;
		}

		let newNodes: Nodes | null = null;
		try {
			newNodes = loadNodes(dataObj, false);
		} catch (e) {
			openPopup(Message, 'File Message', {
				message: 'Invalid file',
				error: true
			});
		}
		if (newNodes != null) {
			if (!unsavedChanges || confirm('Are you sure you want to overwrite your current flows?')) {
				await openDocument(data, { duplicate });
				trackFileImported('json', newNodes.root.children.length);
			}
		}
	}

	let switchSpeakers = false;

	// Custom scrollbar/overflow logic
	onMount(() => {
		document.body.classList.add('app');
	});

	onDestroy(() => {
		document.body.classList.remove('app');
		document.body.classList.remove('customScrollbar');
	});

	$: {
		if (settings.data.customScrollbar.value) {
			document.body.classList.add('customScrollbar');
		} else {
			document.body.classList.remove('customScrollbar');
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
	on:input={handleEditorInput}
	on:mousemove={handleMouseMove}
	on:dragenter={preventDefault}
	on:drop={readUploadDragged}
/>
<svelte:window on:drop|capture={dropPage} />

<main class:activeMouse class="palette-plain">
	<input id="uploadId" type="file" hidden on:change={readUpload} />
	<input
		bind:this={chooseFileInput}
		type="file"
		accept=".json,application/json"
		hidden
		on:change={(event) => readUpload(event, $library.connected && !$library.imported)}
	/>
	<div class="grid" class:showPrelude={!($nodes.root.children.length > 0)}>
		<div class="sidebar">
			<div class="header">
				<ButtonBar
					wrap
					buttons={[
						{
							icon: 'link',
							ariaLabel: 'Help',
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
						...(showSaveButton
							? [
									{
										icon: !$documentOpen
											? 'open'
											: $library.connected && !$library.imported
											? 'save'
											: 'file',
										ariaLabel: $documentOpen ? 'Save flow' : 'Choose file',
										tutorialHighlight: 3,
										tooltip: !$documentOpen
											? 'Choose file'
											: $library.connected && !$library.imported
											? $hasDiskFile
												? 'Save a copy'
												: 'Save as…'
											: 'File',
										shortcut: $documentOpen ? ['commandControl', 's'] : null,
										disabled: $frozen || libraryBusy,
										onclick: () => {
											if ($documentOpen) saveFlow();
											else chooseFileInput.click();
										}
									}
							  ]
							: []),
						{
							icon: isOnline ? 'people' : 'offline',
							onclick: () => {
								if (isOnline) openPopup(Share, 'Share');
							},
							disabled: !isOnline,
							disabledReason: 'sharing is disabled while offline',
							tooltip: 'share',
							tutorialHighlight: 4
						}
					]}
				/>
			</div>
			<div class="document-heading">
				<div class="document-name">
					<input
						class="document-title"
						aria-label="Flow document title"
						placeholder="new flow"
						title={$documentTitle || 'new flow'}
						disabled={$frozen}
						bind:value={$documentTitle}
						on:keydown={handleDocumentTitleKeydown}
						on:blur={commitDocumentTitle}
					/>
				</div>
				<Button
					icon={$documentOpen ? (unsavedToDisk ? 'undo' : 'delete') : 'add'}
					ariaLabel={$documentOpen ? closeLabel : 'New flow'}
					tooltip={$documentOpen ? closeLabel : 'New flow'}
					disabled={libraryBusy || $frozen}
					disabledReason="library is busy"
					tutorialHighlight={5}
					on:click={toggleDocument}
				/>
			</div>
			<p
				class="save-status"
				class:unsaved-to-disk={unsavedToDisk}
				class:disk-save={$documentOpen && $hasDiskFile}
				class:save-error={!unsavedToDisk &&
					$saveStatus &&
					$saveStatus !== 'Unsaved changes' &&
					$saveStatus !== 'Saving…' &&
					$saveStatus !== 'Autosaving…' &&
					!$saveStatus.startsWith('Saved')}
				role="status"
			>
				{unsavedToDisk &&
				(!$saveStatus ||
					$saveStatus === 'Unsaved changes' ||
					$saveStatus.startsWith('Not saved to disk'))
					? 'Not saved to disk'
					: $saveStatus}
			</p>
			{#if libraryError && $nodes.root.children.length}<p role="alert">{libraryError}</p>{/if}
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
					<div
						class="flow"
						class:customScrollbar={settings.data.customScrollbar.value}
						on:scroll={fixScroll}
					>
						<Flow on:focusFlow={focusFlow} flowId={$selectedFlowId} />
					</div>
				{/key}
			{/if}
		{:else}
			<div class="prelude">
				{#if showFlowLibraryBar}
					<FlowLibrarySetup bind:busy={libraryBusy} bind:error={libraryError} />
				{/if}
				{#if !showFlowLibraryBar && libraryError}<p role="alert">{libraryError}</p>{/if}
				<div class="prelude-content">
					<Prelude bind:busy={libraryBusy} bind:error={libraryError} />
				</div>
			</div>
		{/if}
		{#if hasRightPanels}
			<div class="right-sidebar">
				<PanelContainer
					side="right"
					selectedFlowId={$selectedFlowId}
					{clickTab}
					{addFlow}
					{handleSort}
					bind:switchSpeakers
				/>
			</div>
		{/if}
	</div>
</main>

<style>
	:global(body.app) {
		overflow-x: clip;
		overflow-y: clip;
	}
	.grid {
		display: grid;
		gap: var(--gap);
		grid-template-areas:
			'sidebar title box-control'
			'sidebar flow flow';
		grid-template-columns: var(--sidebar-width) minmax(0, 1fr) auto;
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
		grid-template-columns: var(--sidebar-width) minmax(0, 1fr) auto var(--panel-width);
	}
	.grid.showPrelude {
		grid-template-areas: 'sidebar prelude';
		grid-template-columns: var(--sidebar-width) auto;
	}
	.grid.showPrelude:has(.right-sidebar) {
		grid-template-areas: 'sidebar prelude right-sidebar';
		grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--panel-width);
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
		display: flex;
		flex-direction: column;
	}
	.document-heading {
		display: flex;
		align-items: center;
	}
	.document-name {
		display: flex;
		align-items: center;
		gap: var(--padding-small);
		flex: 1;
		min-width: 0;
	}

	.document-title {
		min-width: 0;
		flex: 1;
		font: inherit;
		font-size: 1.2em;
		color: var(--text);
		background: none;
		border: none;
		padding: var(--padding) 0;
		width: 100%;
		box-sizing: border-box;
	}
	.document-title::placeholder {
		color: var(--text-weak);
	}
	.save-status {
		display: none;
		font-size: 0.8em;
		color: var(--text-weak);
		margin: 0;
		padding: 0 var(--padding);
		overflow-wrap: anywhere;
	}
	.save-status.save-error,
	.save-status.unsaved-to-disk,
	.save-status.disk-save {
		display: block;
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
	.prelude-content {
		display: flex;
		flex-direction: column;
		gap: var(--padding-big);
		flex: 1;
		min-height: 0;
		overflow: auto;
		position: relative;
	}
	.prelude {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		position: relative;
		width: calc(100vw - var(--sidebar-width) - var(--gap) * 3);
		height: var(--main-height);
		grid-area: prelude;
	}
	.grid.showPrelude:has(.right-sidebar) .prelude {
		width: auto;
	}
</style>
