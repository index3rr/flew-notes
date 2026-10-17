import { get, writable } from 'svelte/store';
import { Connection, type ConnectionState } from '../integrations/cardmirror/connection';
import { layout, parsePayload, record, string } from '../integrations/cardmirror/protocol';
import { focusId, lastFocusIds, selectedFlowId } from './focus';
import { nodes, frozen } from './store';
import { newBoxId, type BoxId, type FlowId, type Nodes } from './node';
import { doActionBundle, type ActionBundle } from './nodeAction';
import { resolvePendingAction } from './nodePendingAction';
import { history } from './history';
import { clearSelection } from './selection';
import { folded } from './fold';
import { getIceServers } from './iceServers';
import { settings } from './settings';

export const cardMirror = writable<{ state: ConnectionState; error: string; notice: string }>({
	state: 'disconnected',
	error: '',
	notice: ''
});
export const cardMirrorOffer = writable('');
let offerGeneration = 0;
const connection = new Connection(handleRequest, (state, error = '') => {
	cardMirror.update((value) => ({ ...value, state, error }));
	if (state === 'connected' || state === 'disconnected') cardMirrorOffer.set('');
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

export function insertionActions(
	tree: Nodes,
	flowId: FlowId,
	target: BoxId | FlowId | null,
	payload: unknown
) {
	const cells = layout(parsePayload(payload));
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
	const parent = anchor?.parent ?? flowId;
	const siblings = tree[parent]!.children as BoxId[];
	const reuse =
		anchor &&
		!anchor.value.content.trim() &&
		!anchor.value.isExtension &&
		!anchor.value.cardMirrorSpacer &&
		!anchor.children.length &&
		!anchor.value.cardMirror;
	let index = anchorId ? siblings.indexOf(anchorId) + 1 : siblings.length;
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

function destination() {
	const tree = get(nodes),
		id = get(selectedFlowId);
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
	const id = matches[revealIndex];
	folded.update((values) => {
		let parent: FlowId | BoxId | 'root' = tree[id]!.parent;
		while (parent !== 'root') {
			values.delete(parent as BoxId);
			parent = tree[parent]!.parent;
		}
		return values;
	});
	clearSelection();
	selectedFlowId.set(tree[id]!.value.flowId);
	focusId.set(id);
	return { matches: matches.length, position: revealIndex + 1 };
}
async function handleRequest(method: string, params: unknown): Promise<unknown> {
	if (method === 'flow.pages') {
		const tree = get(nodes);
		return tree.root.children.map((id) => ({
			id,
			title: tree[id]!.value.content || 'Untitled page',
			selected: id === get(selectedFlowId)
		}));
	}
	if (method === 'flow.select') {
		if (
			!record(params) ||
			!string(params.id) ||
			!get(nodes).root.children.includes(params.id as FlowId)
		)
			throw new Error('That flow page is no longer open.');
		selectedFlowId.set(params.id as FlowId);
		focusId.set(params.id as FlowId);
		return { ok: true };
	}
	if (method === 'flow.reveal') return reveal(params);
	if (method !== 'flow.insert') throw new Error('Unsupported CardMirror command.');
	if (get(frozen)) throw new Error('Wait for Flew to finish syncing before sending.');
	resolvePendingAction(get(nodes));
	const { tree, id } = destination();
	const target = get(focusId) ?? get(lastFocusIds)[id] ?? tree[id]!.children[0] ?? null;
	const result = insertionActions(tree, id, target, params);
	history.setNextBeforeFocus(target ?? id, id);
	doActionBundle(result.actions, id);
	history.setPrevAfterFocus(result.last, id);
	clearSelection();
	focusId.set(result.last);
	cardMirror.update((value) => ({ ...value, notice: 'Received selection from CardMirror.' }));
	return { cells: result.actions.length, page: tree[id]!.value.content || 'Untitled page' };
}
