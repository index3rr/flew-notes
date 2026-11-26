<script lang="ts">
	import Tutorial from '$lib/components/Tutorial.svelte';
	import Onboarding from '$lib/components/Onboarding.svelte';
	import PanelGuide from '$lib/components/panels/PanelGuide.svelte';
	import {
		showTutorial,
		panelTutorial,
		tutorialDocked,
		setupPending,
		highlightTutorial
	} from '$lib/models/tutorial';
	import { tutorialStep } from '$lib/models/store';
	import { readPageDrag } from '$lib/models/panelDrag';
	import AddTab from '$lib/components/AddTab.svelte';
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
	import { disconnectCardMirror, acceptCardMirrorLink } from '$lib/models/cardMirror';
	import { onDestroy, onMount } from 'svelte';
	import { activeMouse, nodes, pendingAction, frozen } from '$lib/models/store';
	import { createKeyDownHandler } from '$lib/models/key';
	import Prelude from '$lib/components/Prelude.svelte';
	import { loadNodes, importSettingsJson } from '$lib/models/file';
	import { trackFileImported } from '$lib/models/telemetry';
	import Help from '$lib/components/Help.svelte';
	import { settings } from '$lib/models/settings';
	import PanelContainer from '$lib/components/PanelContainer.svelte';
	import { panelIds, panelSide } from '$lib/models/panels';
	import { history } from '$lib/models/history';
	import { focusId, lastFocusIds, selectedFlowId } from '$lib/models/focus';
	import { isChangelogVersionCurrent } from '$lib/models/version';
	import { addNewFlow, deleteFlow, moveFlow, importFlowPage } from '$lib/models/nodeDecorateAction';
	import { getDebateStyleFlow, type DebateStyleFlow } from '$lib/models/debateStyle';

	let previouslyOpen = false;
	$: {
		if ($showTutorial && $documentOpen && !previouslyOpen && $tutorialStep === 0)
			tutorialStep.set(1);
		previouslyOpen = $documentOpen;
	}
	$: if ($showTutorial && $documentOpen && $nodes.root.children.length) tutorialDocked.set(true);

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
			openPopup(DownloadUpload, 'File');
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
		const query = new URLSearchParams(location.search);
		if ($setupPending && !query.has('join') && !query.has('confirm'))
			openPopup(Onboarding, 'Set up Flew');
		acceptCardMirrorLink();
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
	let panelSubUnsub = settings.subscribe([...panelIds], () => {
		hasRightPanels = panelIds.some(
			(id) => panelSide(settings.data[id].value as number) === 'right'
		);
	});
	onDestroy(panelSubUnsub);
	onDestroy(disconnectCardMirror);
	let showFlowLibraryBar = true;
	onDestroy(
		settings.subscribe(['showFlowLibraryBar'], () => {
			showFlowLibraryBar = settings.data.showFlowLibraryBar.value as boolean;
		})
	);

	let showToolbar = true;
	onDestroy(
		settings.subscribe(
			[
				'showUndoRedoButtons',
				'showBoxCreationButtons',
				'showQuickExtensionButtons',
				'showBoxFormatButtons'
			],
			() => {
				showToolbar = [
					'showUndoRedoButtons',
					'showBoxCreationButtons',
					'showQuickExtensionButtons',
					'showBoxFormatButtons'
				].some((key) => Boolean(settings.data[key].value));
			}
		)
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

		history.setNextBeforeFocus($selectedFlowId, 'root');
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
		'commandControl alt shift': {
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
			s: {
				handle: saveFlow,
				require: () => $documentOpen && !$frozen && !libraryBusy,
				preventDefault: 'always'
			},
			z: {
				handle: () => {
					history.redo($selectedFlowId ?? 'root', $pendingAction);
				},
				require: () => {
					return history.canRedo($selectedFlowId ?? 'root', $pendingAction);
				},
				stopRepeat: false,
				preventDefault: 'always'
			}
		},
		commandControl: {
			s: {
				handle: () => {
					void saveDocument();
				},
				require: () => $documentOpen && !$frozen && !libraryBusy,
				preventDefault: 'always'
			},
			z: {
				handle: () => {
					history.undo($selectedFlowId ?? 'root', $pendingAction);
				},
				require: () => {
					return history.canUndo($selectedFlowId ?? 'root', $pendingAction);
				},
				stopRepeat: false,
				preventDefault: 'always'
			}
		},
		'commandControl alt': {
			n: {
				handle: () => {
					const style = getDebateStyleFlow('primary');
					if (style == null) return;
					addFlow(style);
				},
				require: () => $documentOpen && getDebateStyleFlow('primary') != null
			},
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

	async function readUploadFile(file: File, duplicate = false) {
		try {
			await handleUpload(await file.text(), duplicate);
		} catch (error) {
			openPopup(Message, 'File Message', {
				message: error instanceof Error ? error.message : 'Could not open this file.',
				error: true
			});
		}
	}

	function readUploadDragged(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files[0];
		if (!file) return;
		if (/\.json$/i.test(file.name) || ['text/plain', 'application/json'].includes(file.type)) {
			void readUploadFile(file);
		} else {
			openPopup(Message, 'File Message', { message: 'Invalid file', error: true });
		}
	}
	function readUpload(event: Event, duplicate = false) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) void readUploadFile(file, duplicate);
	}

	function preventDefault(e: { preventDefault: () => void }) {
		e.preventDefault();
	}

	function dropPage(event: DragEvent) {
		const raw = event.dataTransfer?.getData('application/x-flew-page');
		if (
			!raw ||
			$frozen ||
			!$documentOpen ||
			(event.target instanceof Element &&
				(event.target.closest(
					'[data-box-id], .autoflow-panel, .transcript, .notes-panel, .cardmirror-panel'
				) ||
					(event.target.closest('.panel-body') && !event.target.closest('.tabs'))))
		)
			return;
		event.preventDefault();
		try {
			const { source, ids } = readPageDrag(raw);
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
			for (const sourceId of ids) {
				const id = importFlowPage(source, sourceId, index++);
				if (id) clickTab(id);
			}
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
		if (dataObj?.isSettings === true) {
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
		id="chooseFlowFile"
		bind:this={chooseFileInput}
		type="file"
		accept=".json,application/json"
		hidden
		on:change={(event) => readUpload(event, $library.connected && !$library.imported)}
	/>
	<div class="grid" class:showPrelude={!$documentOpen}>
		<div class="sidebar">
			<div class="sidebar-head">
				<div class="header">
					<ButtonBar
						wrap
						buttons={[
							{
								icon: 'help',
								ariaLabel: 'Help',
								tutorialHighlight: 7,
								onclick: () => openPopup(Help, 'Help'),
								tooltip: $isChangelogVersionCurrent ? 'help' : 'new updates',
								notification: !$isChangelogVersionCurrent
							},
							{
								icon: 'gear',
								ariaLabel: 'Settings',
								tutorialHighlight: 6,
								onclick: () => openPopup(Settings, 'Settings'),
								tooltip: 'settings'
							},
							{
								icon: 'file',
								ariaLabel: 'File menu',
								tooltip: 'file menu',
								onclick: () => openPopup(DownloadUpload, 'File')
							},
							{
								icon: isOnline ? 'people' : 'offline',
								tutorialHighlight: 5,
								onclick: () => {
									if (isOnline) openPopup(Share, 'Share');
								},
								disabled: !isOnline,
								disabledReason: 'sharing is disabled while offline',
								tooltip: 'share'
							}
						]}
					/>
				</div>
				<div class="document-heading">
					<div class="document-name">
						<input
							class="document-title"
							use:highlightTutorial={!$documentOpen ? 0 : null}
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
						tutorialHighlight={!$documentOpen ? 0 : 4}
						tooltip={$documentOpen ? closeLabel : 'New flow'}
						disabled={libraryBusy || $frozen}
						disabledReason="library is busy"
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
		{#if $documentOpen}
			{#if $selectedFlowId != null && $nodes[$selectedFlowId]}
				{#key $selectedFlowId}
					<div class="title" class:full-width={!showToolbar} use:highlightTutorial={1}>
						<Title flowId={$selectedFlowId} deleteSelf={() => deleteFlowAndFocus()} />
					</div>
					{#if showToolbar}<div class="box-control">
							<BoxControl flowId={$selectedFlowId} />
						</div>{/if}
					<div
						class="flow"
						use:highlightTutorial={$tutorialStep === 3 ? 3 : null}
						class:customScrollbar={settings.data.customScrollbar.value}
						on:scroll={fixScroll}
					>
						<Flow on:focusFlow={focusFlow} flowId={$selectedFlowId} />
					</div>
				{/key}
			{:else}
				<div class="flow empty-flow">
					<div class="empty-document">
						<AddTab {addFlow} bind:switchSpeakers /><Button
							icon="undo"
							text="Undo"
							disabled={!history.canUndo('root', $pendingAction)}
							on:click={() => history.undo('root', $pendingAction)}
						/>
					</div>
				</div>
			{/if}
		{:else}
			<div class="prelude">
				{#if showFlowLibraryBar && (!$showTutorial || $tutorialStep === 4)}
					<FlowLibrarySetup bind:busy={libraryBusy} bind:error={libraryError} />
				{/if}
				{#if !showFlowLibraryBar && libraryError}<p role="alert">{libraryError}</p>{/if}
				<div
					class="prelude-content"
					use:highlightTutorial={$showTutorial && $tutorialStep === 4 ? 4 : null}
				>
					{#if $showTutorial && !$tutorialDocked}<Tutorial />{:else}<Prelude
							bind:busy={libraryBusy}
							bind:error={libraryError}
						/>{/if}
				</div>
			</div>
		{/if}
		{#if hasRightPanels || ($showTutorial && $tutorialDocked) || $panelTutorial}
			<div class="right-sidebar">
				{#if $panelTutorial}<div class="tutorial-card">
						<PanelGuide panel={$panelTutorial} />
					</div>{:else if $showTutorial && $tutorialDocked}<div class="tutorial-card">
						<Tutorial panel />
					</div>{/if}
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
	.tutorial-card {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: calc(var(--button-size) + var(--padding) * 4);
		overflow: hidden;
		padding: var(--padding);
		background: var(--background);
		border-radius: var(--border-radius);
		box-sizing: border-box;
	}

	.flow.empty-flow {
		height: 100%;
		grid-row: 1 / -1;
		grid-column: 2 / 4;
	}
	.empty-document {
		min-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--padding-big);
		font-size: 1.5em;
	}
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

	/* Sidebars are columns of surfaces: the document head, then one card per panel. */
	.sidebar,
	.right-sidebar {
		width: 100%;
		height: var(--main-height);
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		box-sizing: border-box;
		min-height: 0;
	}
	.sidebar {
		grid-area: sidebar;
	}
	.right-sidebar {
		grid-area: right-sidebar;
	}
	.sidebar-head {
		flex-shrink: 0;
		background: var(--background);
		border-radius: var(--border-radius);
		padding: var(--padding);
		box-sizing: border-box;
	}
	.header {
		height: auto;
		padding-bottom: var(--padding);
		flex-shrink: 0;
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
		outline: none;
		padding: var(--padding);
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
	.title.full-width {
		grid-column: 2 / 4;
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
