import { trackFeatureUsed } from './telemetry';
import { exportItems } from '../integrations/cardmirror/evidence';
import { get, writable } from 'svelte/store';
import { Connection, type ConnectionState } from '../integrations/cardmirror/connection';
import {
	layout,
	parsePayload,
	record,
	string,
	validProvenance
} from '../integrations/cardmirror/protocol';
import { focusId, selectedFlowId } from './focus';
import { nodes, frozen } from './store';
import { newBoxId, type BoxId, type FlowId, type Nodes } from './node';
import { doActionBundle, type ActionBundle } from './nodeAction';
import { resolvePendingAction } from './nodePendingAction';
import { history } from './history';
import { clearSelection } from './selection';
import { currentArgument, showArgument } from './argumentNavigation';
import { getIceServers } from './iceServers';
import { settings } from './settings';
import {
	documentChunkBytes,
	encodeBytes,
	maxDocumentBytes
} from '../integrations/cardmirror/documents';

export const cardMirror = writable<{ state: ConnectionState; error: string; notice: string }>({
	state: 'disconnected',
	error: '',
	notice: ''
});
export const cardMirrorOffer = writable('');
export const cardMirrorDocuments = writable<{
	supported: boolean;
	checked: boolean;
	sending: string;
	progress: number;
}>({ supported: false, checked: false, sending: '', progress: 0 });
let session = 0;
let documentAbort: AbortController | null = null;
export function cancelCardMirrorDocument() {
	documentAbort?.abort();
}
export const cardMirrorDestination = writable<{ flowId: FlowId; column: number } | null>(null);
// Destination is round-local. A closed document must not keep targeting an old page.
nodes.subscribe((tree) => {
	if (!tree.root.children.length) cardMirrorDestination.set(null);
});
let offerGeneration = 0;
const connection = new Connection(handleRequest, (state, error = '') => {
	cardMirror.update((value) => ({ ...value, state, error }));
	if (state === 'connected' || state === 'disconnected') cardMirrorOffer.set('');
	if (state === 'disconnected') {
		session++;
		cardMirrorDocuments.set({ supported: false, checked: false, sending: '', progress: 0 });
	}
	if (state === 'connected') {
		trackFeatureUsed('cardmirror', 'connected');
		const current = session;
		void connection
			.request('integration.capabilities', {})
			.then((value) => {
				if (current === session)
					cardMirrorDocuments.update((data) => ({
						...data,
						supported: record(value) && value.documentOpen === true,
						checked: true
					}));
			})
			.catch(() => {
				if (current === session) cardMirrorDocuments.update((data) => ({ ...data, checked: true }));
			});
	}
});

// The connection belongs to the app, not a panel instance: moving/collapsing a
// panel keeps it alive. Turning it off or leaving the app releases the peer.
settings.subscribe(['cardMirrorPanel'], () => {
	if (settings.data.cardMirrorPanel.value === 0) disconnectCardMirror();
});
export function disconnectCardMirror() {
	offerGeneration++;
	connection.close();
}
export async function createCardMirrorOffer() {
	const generation = ++offerGeneration;
	cardMirrorOffer.set('');
	const servers = await getIceServers();
	if (generation !== offerGeneration || settings.data.cardMirrorPanel.value === 0) return;
	const key = await connection.offer(servers);
	if (generation === offerGeneration) cardMirrorOffer.set(key);
}
export async function confirmCardMirror(key: string) {
	await connection.confirm(key);
}
export async function jumpToCardMirror(token: string) {
	const result = await connection.request('source.jump', { token });
	if (!record(result) || result.ok !== true) {
		const error = record(result) ? result.error : '';
		throw new Error(
			error === 'doc-not-open'
				? 'Open the source document in CardMirror first.'
				: error === 'not-found'
				? 'The source text could not be found in CardMirror.'
				: 'CardMirror could not open this source.'
		);
	}
}

export async function openCardMirrorDocument(name: string, blob: Blob, signal?: AbortSignal) {
	const state = get(cardMirrorDocuments);
	if (get(cardMirror).state !== 'connected' || !state.supported)
		throw new Error('Connect the updated companion plugin in native CardMirror first.');
	if (state.sending) throw new Error('Wait for the current document transfer to finish.');
	if (!/\.docx$/i.test(name) || blob.size < 4 || blob.size > maxDocumentBytes)
		throw new Error('Choose a DOCX document up to 50 MB.');
	const id = crypto.randomUUID(),
		current = session;
	const abort = new AbortController();
	documentAbort = abort;
	const check = () => {
		if (current !== session || signal?.aborted || abort.signal.aborted)
			throw new Error('Document transfer cancelled.');
	};
	cardMirrorDocuments.update((value) => ({ ...value, sending: name, progress: 0 }));
	try {
		check();
		await connection.request('document.begin', {
			id,
			name: name.replace(/[\\/\p{Cc}]/gu, '_'),
			size: blob.size
		});
		for (let offset = 0; offset < blob.size; offset += documentChunkBytes) {
			check();
			const bytes = new Uint8Array(
				await blob.slice(offset, offset + documentChunkBytes).arrayBuffer()
			);
			check();
			await connection.request('document.chunk', { id, offset, data: encodeBytes(bytes) });
			check();
			cardMirrorDocuments.update((value) => ({
				...value,
				progress: Math.round((Math.min(offset + bytes.length, blob.size) / blob.size) * 100)
			}));
		}
		check();
		await connection.request('document.finish', { id });
	} catch (error) {
		if (current === session)
			void connection.request('document.cancel', { id }).catch(() => undefined);
		throw error;
	} finally {
		if (documentAbort === abort) documentAbort = null;
		if (current === session)
			cardMirrorDocuments.update((value) => ({ ...value, sending: '', progress: 0 }));
	}
}

export function insertionActions(
	tree: Nodes,
	flowId: FlowId,
	target: BoxId | FlowId | null,
	payload: unknown
) {
	const parsed = parsePayload(payload);
	const cells = layout(parsed);
	const flow = tree[flowId];
	if (!flow) throw new Error('Open a flow page in Flew first.');
	const candidate = target ? tree[target] : null;
	const starter = flow.children.length === 1 ? flow.children[0] : null;
	const anchorId =
		candidate?.value.tag === 'box' && candidate.value.flowId === flowId
			? (target as BoxId)
			: starter && !tree[starter]?.value.content.trim()
			? starter
			: null;
	const anchor = anchorId ? tree[anchorId]! : null;
	const responding = parsed.placement === 'responses';
	if (responding && (!anchor || anchor.value.empty || anchor.value.isExtension))
		throw new Error('Select an argument in Flew to receive responses.');
	if (responding && anchor && anchor.level >= flow.value.columns.length)
		throw new Error('There is no speech column after this argument.');
	const parent = responding ? anchorId! : anchor?.parent ?? flowId;
	const siblings = tree[parent]!.children as BoxId[];
	const reuse =
		anchor &&
		!anchor.value.content.trim() &&
		!anchor.value.isExtension &&
		!anchor.value.cardMirrorSpacer &&
		!anchor.value.starred &&
		!anchor.value.starNote &&
		!anchor.value.crossed &&
		!anchor.value.bold &&
		!anchor.value.empty &&
		!responding &&
		!anchor.children.length &&
		!anchor.value.cardMirror;
	let index = !responding && anchorId ? siblings.indexOf(anchorId) + 1 : siblings.length;
	const actions: ActionBundle = [];
	let first: BoxId | null = null;
	let last: BoxId | null = null;
	for (const cell of cells) {
		if (!first && reuse && anchorId && anchor) {
			actions.push({ tag: 'update', id: anchorId, newValue: { tag: 'box', flowId, ...cell } });
			first = last = anchorId;
		} else {
			const id = newBoxId();
			actions.push({
				tag: 'add',
				id,
				parent,
				index: index++,
				value: { tag: 'box', flowId, ...cell }
			});
			first ??= id;
			last = id;
		}
	}
	return { actions, first: first!, last: last! };
}

export function columnInsertionActions(
	tree: Nodes,
	flowId: FlowId,
	column: number,
	payload: unknown
) {
	const flow = tree[flowId];
	if (!flow || !Number.isInteger(column) || column < 0 || column >= flow.value.columns.length)
		throw new Error('Choose an available page and speech column in the CardMirror panel.');
	const parsed = parsePayload(payload);
	if (parsed.placement === 'responses')
		throw new Error('Unpin the destination and select an argument before sending responses.');
	if (column === 0) return insertionActions(tree, flowId, null, payload);
	const actions: ActionBundle = [];
	let parent: FlowId | BoxId = flowId;
	for (let index = 0; index < column; index++) {
		const id = newBoxId();
		actions.push({
			tag: 'add',
			id,
			parent,
			index: index === 0 ? flow.children.length : 0,
			value: { tag: 'box', content: '', flowId, empty: true }
		});
		parent = id;
	}
	const ids: BoxId[] = [];
	layout(parsed).forEach((cell, index) => {
		const id = newBoxId();
		ids.push(id);
		actions.push({ tag: 'add', id, parent, index, value: { tag: 'box', flowId, ...cell } });
	});
	return { actions, first: ids[0], last: ids[ids.length - 1] };
}

function destination() {
	const tree = get(nodes),
		id = get(cardMirrorDestination)?.flowId ?? get(selectedFlowId);
	if (!id || !tree[id]) throw new Error('Open a flow page in Flew first.');
	return { tree, id };
}
let lastReveal = '';
let revealIndex = -1;
function reveal(params: unknown) {
	if (
		!record(params) ||
		!Array.isArray(params.keys) ||
		!params.keys.length ||
		params.keys.length > 500 ||
		!params.keys.every((k) => string(k))
	)
		throw new Error('Invalid source keys.');
	const keys = new Set(params.keys as string[]),
		tree = get(nodes);
	const matches: BoxId[] = [];
	function visit(id: BoxId) {
		const box = tree[id];
		if (!box) return;
		if (box.value.cardMirror?.sources.some((s) => keys.has(s.key))) matches.push(id);
		box.children.forEach(visit);
	}
	tree.root.children.forEach((id) => tree[id]?.children.forEach(visit));
	if (!matches.length)
		throw new Error('No matching argument in this Flew document. Send the selection first.');
	const signature = JSON.stringify([...keys]);
	revealIndex = signature === lastReveal ? (revealIndex + 1) % matches.length : 0;
	lastReveal = signature;
	showArgument(matches[revealIndex], tree);
	return { matches: matches.length, position: revealIndex + 1 };
}
async function handleRequest(method: string, params: unknown): Promise<unknown> {
	if (method === 'integration.capabilities') return { responses: true };
	if (method === 'flow.pages') {
		const tree = get(nodes);
		return tree.root.children.map((id) => ({
			id,
			title: tree[id]!.value.content || 'Untitled page',
			selected: id === (get(cardMirrorDestination)?.flowId ?? get(selectedFlowId))
		}));
	}
	if (method === 'flow.select') {
		if (
			!record(params) ||
			!string(params.id) ||
			!get(nodes).root.children.includes(params.id as FlowId)
		)
			throw new Error('That flow page is no longer open.');
		const pin = get(cardMirrorDestination);
		if (pin) {
			const tree = get(nodes),
				next = params.id as FlowId;
			const speech = tree[pin.flowId]?.value.columns[pin.column];
			cardMirrorDestination.set({
				flowId: next,
				column: Math.max(0, tree[next]!.value.columns.indexOf(speech ?? ''))
			});
		}
		selectedFlowId.set(params.id as FlowId);
		focusId.set(params.id as FlowId);
		return { ok: true };
	}
	if (method === 'flow.reveal') return reveal(params);
	if (method !== 'flow.insert') throw new Error('Unsupported CardMirror command.');
	if (get(frozen)) throw new Error('Wait for Flew to finish syncing before sending.');
	resolvePendingAction(get(nodes));
	const { tree, id } = destination();
	const pinned = get(cardMirrorDestination);
	const target = currentArgument(tree, id)?.id ?? null;
	const result = pinned
		? columnInsertionActions(tree, id, pinned.column, params)
		: insertionActions(tree, id, target, params);
	history.setNextBeforeFocus(target ?? id, id);
	doActionBundle(result.actions, id);
	history.setPrevAfterFocus(result.last, id);
	if (!pinned) {
		clearSelection();
		focusId.set(result.last);
	}
	cardMirror.update((value) => ({
		...value,
		notice: `Received selection in ${tree[id]!.value.content || 'Untitled page'}${
			pinned ? ' · ' + tree[id]!.value.columns[pinned.column] : ''
		}.`
	}));
	return { cells: result.actions.length, page: tree[id]!.value.content || 'Untitled page' };
}

export async function readCardMirrorHeadings(
	speech = false
): Promise<{ name: string; blocks: import('./speechDoc').DocBlock[] }> {
	const result = await connection.request('outline.read', { speech });
	if (
		!record(result) ||
		!string(result.name, 1000) ||
		!Array.isArray(result.blocks) ||
		result.blocks.length > 500 ||
		!result.blocks.every(
			(block) =>
				record(block) &&
				string(block.title) &&
				string(block.group) &&
				Array.isArray(block.tags) &&
				block.tags.length <= 500 &&
				block.tags.every((tag) => string(tag)) &&
				(block.provenance === undefined ||
					(Array.isArray(block.provenance) &&
						block.provenance.length === block.tags.length &&
						block.provenance.every((source) => source === null || validProvenance(source))))
		)
	)
		throw new Error('Update the CardMirror companion plugin to read headings.');
	return result as { name: string; blocks: import('./speechDoc').DocBlock[] };
}
export async function sendToCardMirror(boxes: import('./node').SerializedBox[], speech = false) {
	const items = exportItems(boxes);
	if (!items.length) throw new Error('Select cells containing text first.');
	if (items.some((item) => item.evidence?.length)) {
		const capabilities = await connection.request('integration.capabilities', {});
		if (!record(capabilities) || capabilities.evidence !== true)
			throw new Error('Reload the updated CardMirror companion plugin to send attached evidence.');
	}
	await connection.request('outline.insert', {
		speech,
		texts: items.map((item) => item.text),
		items
	});
}

// A confirmation tab forwards the return key to the originating app tab without storing it.
const confirmationChannel =
	typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('flew-cardmirror-confirm') : null;
confirmationChannel?.addEventListener('message', (event) => {
	if (typeof event.data === 'string' && get(cardMirror).state === 'pairing')
		void confirmCardMirror(event.data).catch((error) =>
			cardMirror.update((value) => ({ ...value, error: error.message }))
		);
});
export function acceptCardMirrorLink() {
	const params = new URLSearchParams(location.hash.slice(1));
	const key = params.get('cardMirrorReply');
	if (!key) return;
	historyReplaceHash();
	if (get(cardMirror).state === 'pairing') void confirmCardMirror(key);
	else confirmationChannel?.postMessage(key);
}
function historyReplaceHash() {
	window.history.replaceState(null, '', location.pathname + location.search);
}
