import { nodes, subscribeFlowsChange, sideDocText, newNodes, frozen } from '$lib/models/store';
import { writable, derived, get } from 'svelte/store';
import { getJson, loadNodes, downloadString, downloadXlsx } from './file';
import { getNode, type Nodes } from './node';
import { getDebateStyleFlow } from './debateStyle';
import { replaceNodes, addNewFlow } from './nodeDecorateAction';
import { resolvePendingAction } from './nodePendingAction';
import { trackFlowDataUpload, getCurrentTier } from './telemetry';
import { documentTitle, resetDocumentTitle, documentFilename, documentCreated } from './document';
import {
	directFolderAccess,
	bindLibraryFile,
	needsFileLocation,
	chooseNewLibraryFile,
	libraryTarget,
	newLibraryTarget,
	saveLibraryFile,
	type FileTarget,
	library
} from './flowLibrary';
import { focusId, selectedFlowId, lastFocusIds } from './focus';
import { history, History } from './history';

export type NodeKey = string;
export type SavedNodesData = {
	created: string;
	modified: string;
	title?: string;
	flowInfos: { content: string; invert: boolean }[];
};
export type SavedNodesDatas = { [key: NodeKey]: SavedNodesData };
export const MAX_SAVED_FLOWS = 20;
const savedNodesDatasMut = writable<SavedNodesDatas>(getSavedNodesDatas());
export const savedNodesDatas = derived(savedNodesDatasMut, (value) => value);
export const saveStatus = writable('');
export const dirty = writable(false);
export const documentOpen = writable(false);
let flowKey: NodeKey | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let switching = false;
let saving = false;
let session = 0;
let editRevision = 0;
let lastSavedRaw: string | null = null;
let lastDurableRaw: string | null = null;

export function getSavedNodesDatas(): SavedNodesDatas {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem('savedFlows') ?? '{}');
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		return Object.fromEntries(
			Object.entries(parsed).filter(
				([key, value]) =>
					key.startsWith('flow:') &&
					value &&
					typeof value.created === 'string' &&
					typeof value.modified === 'string' &&
					Array.isArray(value.flowInfos) &&
					value.flowInfos.every(
						(info: { content?: unknown; invert?: unknown }) =>
							info && typeof info.content === 'string' && typeof info.invert === 'boolean'
					)
			)
		);
	} catch {
		return {};
	}
}
export function maybeSaveNodes() {
	if (switching || saving || get(frozen) || !get(documentOpen)) return;
	dirty.set(true);
	saveStatus.set('Unsaved changes');
	editRevision++;
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		timer = null;
		void saveNodes(get(nodes));
	}, 1000);
}
subscribeFlowsChange(maybeSaveNodes);
// Subscribe after initialization so merely opening the app does not create a save.
let initialized = false;
sideDocText.subscribe(() => {
	if (initialized) maybeSaveNodes();
});
documentTitle.subscribe(() => {
	if (initialized) maybeSaveNodes();
});
initialized = true;

export function unsetFlowKey() {
	flowKey = null;
	bindLibraryFile(null);
}
function clearTimer() {
	if (timer) clearTimeout(timer);
	timer = null;
}
function worthSaving(value: Nodes) {
	return (
		value.root.children.length > 0 ||
		get(documentTitle).trim() !== '' ||
		get(sideDocText) !== '' ||
		flowKey !== null
	);
}
// localStorage is written synchronously, even when called during pagehide.
export async function saveNodes(value = get(nodes)): Promise<boolean> {
	clearTimer();
	if (switching || get(frozen) || !get(documentOpen)) return true;
	if (!worthSaving(value)) {
		dirty.set(false);
		saveStatus.set('');
		return true;
	}
	saving = true;
	try {
		resolvePendingAction(value);
	} finally {
		saving = false;
	}
	const raw = getJson(value);
	if (raw === lastSavedRaw && !get(dirty)) return true;
	const title = get(documentTitle);
	const savedSession = session;
	const savedRevision = editRevision;
	saveStatus.set('Saving…');
	let recoveryError = '';
	try {
		const metadata = getSavedNodesDatas();
		flowKey ??= `flow:${crypto.randomUUID()}`;
		localStorage.setItem(flowKey, raw);
		metadata[flowKey] = {
			created: metadata[flowKey]?.created ?? new Date().toISOString(),
			modified: new Date().toISOString(),
			title,
			flowInfos: value.root.children.map((id) => {
				const flow = getNode(value, id).unwrap().value;
				return { content: flow.content, invert: flow.invert };
			})
		};
		const keys = Object.keys(metadata).sort((a, b) =>
			metadata[a].modified.localeCompare(metadata[b].modified)
		);
		while (directFolderAccess && keys.length > MAX_SAVED_FLOWS) {
			const oldest = keys.shift()!;
			if (oldest !== flowKey) {
				localStorage.removeItem(oldest);
				delete metadata[oldest];
			}
		}
		localStorage.setItem('savedFlows', JSON.stringify(metadata));
		savedNodesDatasMut.set(metadata);
		lastDurableRaw = raw;
	} catch {
		recoveryError = 'Browser recovery save failed. Download a JSON copy to keep your work.';
	}
	let file = libraryTarget();
	if (!file && get(library).connected) {
		file = newLibraryTarget();
		bindLibraryFile(file);
	}
	try {
		if (directFolderAccess) await saveLibraryFile(raw, title, file);
		const pendingLocation = directFolderAccess && needsFileLocation();
		if (directFolderAccess && file && !pendingLocation) lastDurableRaw = raw;
		if (session === savedSession && editRevision === savedRevision) {
			lastSavedRaw = raw;
			dirty.set(!!recoveryError || pendingLocation);
			saveStatus.set(
				recoveryError ||
					(pendingLocation
						? 'Not saved to disk — save to choose a file'
						: directFolderAccess && file
						? get(library).imported
							? 'Saved in browser library'
							: 'Saved to folder'
						: 'Saved in browser')
			);
		}
		if (getCurrentTier() >= 3) trackFlowDataUpload(value);
		return !recoveryError;
	} catch (error) {
		if (session === savedSession) {
			dirty.set(true);
			saveStatus.set(`${(error as Error).message}${recoveryError ? ' ' + recoveryError : ''}`);
		}
		return false;
	}
}
let choosingFile = false;
export async function saveDocument(): Promise<boolean> {
	if (choosingFile || switching || get(frozen) || !get(documentOpen)) return false;
	if (!directFolderAccess) return saveNodes();
	if (!needsFileLocation()) return saveNodes();
	choosingFile = true;
	const savedSession = session;
	try {
		// The picker must open directly from the Save click or keyboard shortcut.
		const chosen = chooseNewLibraryFile(get(documentTitle));
		void saveNodes();
		const file = await chosen;
		if (session !== savedSession) return false;
		if (file.name.toLowerCase().endsWith('.xlsx')) {
			resolvePendingAction(get(nodes));
			await downloadXlsx(get(nodes), file.handle);
			return true;
		}
		bindLibraryFile(file);
		lastSavedRaw = null;
		return await saveNodes();
	} catch (error) {
		if (session !== savedSession) return false;
		await saveNodes();
		if ((error as DOMException).name !== 'AbortError') {
			dirty.set(true);
			saveStatus.set((error as Error).message);
		}
		return false;
	} finally {
		choosingFile = false;
	}
}
export async function saveBeforeSwitch() {
	if (!get(documentOpen)) return;
	let before: number;
	do {
		before = editRevision;
		await saveNodes();
	} while (before !== editRevision);
	if (worthSaving(get(nodes)) && getJson(get(nodes)) !== lastDurableRaw && get(dirty)) {
		throw new Error(
			'Your changes could not be saved. Download a JSON copy before opening another flow.'
		);
	}
}
export async function openDocument(
	raw: string,
	options: { key?: string; target?: FileTarget; duplicate?: boolean } = {}
) {
	const data = JSON.parse(raw);
	loadNodes(data, false); // Validate without touching the current document.
	await saveBeforeSwitch();
	clearTimer();
	switching = true;
	session++;
	try {
		flowKey = options.duplicate ? null : options.key ?? null;
		bindLibraryFile(options.duplicate ? newLibraryTarget() : options.target ?? null);
		resetDocumentTitle();
		const next = loadNodes(data);
		documentCreated.set(
			options.duplicate
				? new Date().toISOString()
				: get(documentCreated) ??
						(options.key ? getSavedNodesDatas()[options.key]?.created : null) ??
						new Date().toISOString()
		);
		documentOpen.set(true);
		if (options.duplicate)
			documentTitle.set(
				`${get(documentTitle) || options.target?.name.replace(/\.json$/i, '') || 'Flow'} copy`
			);
		focusId.set(null);
		lastFocusIds.set({});
		replaceNodes(next);
		history.histories = { root: new History() };
		history.lastAddedOwner = null;
		selectedFlowId.set(next.root.children[0] ?? null);
		lastSavedRaw = options.duplicate ? null : getJson(next);
		lastDurableRaw = lastSavedRaw;
		dirty.set(false);
		saveStatus.set('');
	} finally {
		switching = false;
	}
	if (options.duplicate) await saveNodes();
}
export async function closeDocument() {
	await saveBeforeSwitch();
	clearTimer();
	switching = true;
	session++;
	try {
		unsetFlowKey();
		documentOpen.set(false);
		documentCreated.set(null);
		resetDocumentTitle();
		sideDocText.set('');
		focusId.set(null);
		lastFocusIds.set({});
		selectedFlowId.set(null);
		if (get(nodes).root.children.length) replaceNodes(newNodes());
		history.histories = { root: new History() };
		history.lastAddedOwner = null;
		lastSavedRaw = null;
		lastDurableRaw = null;
		dirty.set(false);
		saveStatus.set('');
	} finally {
		switching = false;
	}
	return true;
}
export async function createDocument(title = get(documentTitle)) {
	const style = getDebateStyleFlow('primary');
	if (!style) throw new Error('No starting page is available for this debate style.');
	if (!(await closeDocument())) return;
	resetDocumentTitle(title);
	documentCreated.set(new Date().toISOString());
	documentOpen.set(true);
	const id = addNewFlow(0, style, false);
	if (!id) throw new Error('Could not create the starting page.');
	selectedFlowId.set(id);
	focusId.set(id);
	await saveNodes();
}
// Remote collaboration can supply a document without opening a local file.
nodes.subscribe((value) => {
	if (!switching && value.root.children.length) {
		documentOpen.set(true);
		if (!get(documentCreated)) documentCreated.set(new Date().toISOString());
	}
});

// Import into the local library without opening documents or changing editor state.
export function importLocalFlows(entries: { raw: string; name: string; modified?: string }[]) {
	const metadata = getSavedNodesDatas();
	const existing = new Set(Object.keys(metadata).map((key) => localStorage.getItem(key)));
	let skipped = 0;
	for (const entry of entries) {
		let value: Nodes;
		let data;
		try {
			data = JSON.parse(entry.raw);
			value = loadNodes(data, false);
		} catch {
			skipped++;
			continue;
		}
		const title =
			data.title ||
			entry.name
				.split('/')
				.pop()!
				.replace(/\.json$/i, '');
		const created = data.created ?? entry.modified ?? new Date().toISOString();
		const raw = JSON.stringify({
			nodes: value,
			version: 1,
			title,
			created,
			sideDocText: data.sideDocText ?? ''
		});
		if (existing.has(raw)) continue;
		const key = `flow:${crypto.randomUUID()}`;
		localStorage.setItem(key, raw);
		metadata[key] = {
			title,
			created,
			modified: entry.modified ?? created,
			flowInfos: value.root.children.map((id) => {
				const flow = getNode(value, id).unwrap().value;
				return { content: flow.content, invert: flow.invert };
			})
		};
		try {
			localStorage.setItem('savedFlows', JSON.stringify(metadata));
		} catch (error) {
			localStorage.removeItem(key);
			delete metadata[key];
			throw error;
		}
		existing.add(raw);
		savedNodesDatasMut.set({ ...metadata });
	}
	return skipped;
}
export async function loadSavedNodes(key: NodeKey, modifyOriginal = false) {
	await saveBeforeSwitch();
	const raw = localStorage.getItem(key);
	if (!raw) throw new Error('This browser save no longer exists.');
	await openDocument(raw, { key, duplicate: !modifyOriginal });
}
export function deleteNodes(key: NodeKey) {
	const metadata = getSavedNodesDatas();
	localStorage.removeItem(key);
	delete metadata[key];
	localStorage.setItem('savedFlows', JSON.stringify(metadata));
	savedNodesDatasMut.set(metadata);
	if (key === flowKey) flowKey = null;
}
export function downloadSavedNodes(key: NodeKey) {
	const raw = localStorage.getItem(key);
	if (raw) downloadString(raw, documentFilename(JSON.parse(raw).title ?? ''));
}
