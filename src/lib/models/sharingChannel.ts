import { get } from 'svelte/store';
import type { Nodes } from './node';
import { applyActionBundle, applyActionBundleAndSyncUi, type ActionBundle } from './nodeAction';
import { resolvePendingAction } from './nodePendingAction';
import { disconnect, type ConnectionId } from './sharingConnection';
import { connections, flowsChange, nodes, frozen } from './store';
import { syncUi } from './nodeSyncUi';
import {
	changingDocument,
	documentId,
	documentTitle,
	sharedDocument,
	receiveSharedDocument,
	type SharedDocument
} from './document';

export type ActionId = string & { readonly ActionId: unique symbol };
export type SendAction = { id: ActionId; actionBundle: ActionBundle; documentId?: string };
const PROTOCOL = 'flew-document-v2';
type Hello = { tag: 'hello'; protocol: string };
const compatibleChannels = new WeakSet<object>();
type Metadata = { title?: string };
type MetadataMessage = { tag: 'metadata'; id: string; documentId: string; patch: Metadata };
export type HostMessage =
	| Hello
	| { tag: 'sync'; nodes: Nodes; first: boolean; document?: Omit<SharedDocument, 'nodes'> }
	| { tag: 'action'; action: SendAction }
	| { tag: 'actionRecieved'; actionId: ActionId }
	| { tag: 'name'; name: string }
	| MetadataMessage;
export type GuestMessage =
	| Hello
	| { tag: 'requestSync' }
	| { tag: 'action'; action: SendAction }
	| { tag: 'document'; document: SharedDocument; baseId: string | null }
	| MetadataMessage;

// Only unacknowledged local actions need prediction. Rebase them on every host
// event, in host order, so concurrent edits converge before the next local edit.
const pending = new Map<ActionId, { actions: ActionBundle; inverse: ActionBundle }>();
const pendingMetadata = new Map<string, Metadata>();
let confirmedDocumentId: string | null = null;
let applyingMetadata = false;
let activeConnection: unknown;
function clearPrediction() {
	pending.clear();
	pendingMetadata.clear();
}
connections.subscribe((state) => {
	const connection = state.tag === 'guest' ? state.connection : null;
	if (connection !== activeConnection) {
		clearPrediction();
		confirmedDocumentId = null;
		activeConnection = connection;
	}
});
function broadcast(message: HostMessage) {
	const state = get(connections);
	if (state.tag !== 'host') return;
	for (const connection of Object.values(state.holder)) {
		if (compatibleChannels.has(connection.channel)) connection.channel.send(message);
	}
}
function snapshot(first = false): HostMessage {
	resolvePendingAction(get(nodes));
	const { nodes: value, ...document } = sharedDocument();
	return { tag: 'sync', nodes: value, document, first };
}
export function publishDocument() {
	clearPrediction();
	const state = get(connections);
	if (state.tag === 'host') broadcast(snapshot());
	else if (state.tag === 'guest' && state.connection.tag === 'guestConnected') {
		state.connection.channel.send({
			tag: 'document',
			document: sharedDocument(),
			baseId: confirmedDocumentId
		});
		state.connection.awaitingSync = true;
		connections.set(state);
	}
}
function sendMetadata(patch: Metadata) {
	if (changingDocument || applyingMetadata || get(frozen)) return;
	const message: MetadataMessage = { tag: 'metadata', id: crypto.randomUUID(), documentId, patch };
	const state = get(connections);
	if (state.tag === 'host') broadcast(message);
	else if (state.tag === 'guest' && state.connection.tag === 'guestConnected') {
		pendingMetadata.set(message.id, patch);
		state.connection.channel.send(message);
	}
}
documentTitle.subscribe((title) => sendMetadata({ title }));
function applyMetadata(patch: Metadata) {
	applyingMetadata = true;
	try {
		if (patch.title !== undefined) documentTitle.set(patch.title);
	} finally {
		applyingMetadata = false;
	}
}
export function sendActionBundle(actionBundle: ActionBundle, inverseActionBundle: ActionBundle) {
	if (changingDocument) return;
	const state = get(connections);
	const id = crypto.randomUUID() as ActionId;
	const action = { id, actionBundle, documentId };
	if (state.tag === 'host') broadcast({ tag: 'action', action });
	else if (state.tag === 'guest' && state.connection.tag === 'guestConnected') {
		pending.set(id, { actions: structuredClone(actionBundle), inverse: inverseActionBundle });
		state.connection.channel.send({ tag: 'action', action });
	}
}
interface Channel<SendMessage, ReceiveMessage> {
	send(message: SendMessage): void;
	onOpen(fn: () => void): void;
	onClose(fn: () => void): void;
	onMessage(fn: (event: ReceiveMessage) => void): void;
}
function receiveDocument(document: SharedDocument) {
	try {
		receiveSharedDocument(structuredClone(document));
		clearPrediction();
		confirmedDocumentId = document.id;
		return true;
	} catch (error) {
		disconnect();
		alert(`Collaboration stopped to preserve your work: ${(error as Error).message}`);
		return false;
	}
}
export function addHostChannelHandler(
	channel: Channel<HostMessage, GuestMessage>,
	id: ConnectionId
) {
	let timeout: ReturnType<typeof setTimeout>;
	function rejectVersion() {
		const state = get(connections);
		if (state.tag !== 'host' || state.holder[id]?.channel !== channel) return;
		state.holder[id].pc.close();
		delete state.holder[id];
		connections.set(state);
		alert(
			'This guest uses an incompatible collaboration version. Refresh Flew Notes on both devices and reconnect.'
		);
	}
	channel.onOpen(() => {
		channel.send({ tag: 'hello', protocol: PROTOCOL });
		timeout = setTimeout(rejectVersion, 10000);
	});
	channel.onClose(() => clearTimeout(timeout));
	channel.onMessage((message) => {
		const state = get(connections);
		if (state.tag !== 'host' || state.holder[id]?.channel !== channel) return;
		if (message.tag === 'hello') {
			clearTimeout(timeout);
			if (message.protocol !== PROTOCOL) return rejectVersion();
			compatibleChannels.add(channel);
			channel.send(snapshot(true));
			return;
		}
		if (!compatibleChannels.has(channel)) return rejectVersion();
		switch (message.tag) {
			case 'requestSync':
				channel.send(snapshot());
				break;
			case 'document':
				if (message.baseId !== documentId) {
					channel.send(snapshot());
					break;
				}
				resolvePendingAction(get(nodes));
				if (receiveDocument(message.document)) {
					broadcast(snapshot());
					flowsChange();
				}
				break;
			case 'metadata':
				if (message.documentId !== documentId) return;
				applyMetadata(message.patch);
				broadcast(message);
				break;
			case 'action': {
				if (message.action.documentId !== documentId) return;
				resolvePendingAction(get(nodes));
				applyActionBundleAndSyncUi(structuredClone(message.action.actionBundle));
				for (const otherId of Object.keys(state.holder)) {
					const other = state.holder[otherId as ConnectionId].channel;
					if (id !== otherId && compatibleChannels.has(other)) other.send(message);
				}
				channel.send({ tag: 'actionRecieved', actionId: message.action.id });
				break;
			}
		}
	});
}
function rebase(actions: ActionBundle, acknowledged?: ActionId) {
	const value = get(nodes);
	for (const entry of [...pending.values()].reverse())
		applyActionBundle(value, entry.inverse, false);
	if (acknowledged) pending.delete(acknowledged);
	applyActionBundle(value, structuredClone(actions), false);
	for (const entry of pending.values()) {
		entry.inverse = applyActionBundle(value, structuredClone(entry.actions), false);
	}
	syncUi(value);
	flowsChange();
}
export function addGuestChannelHandler(channel: Channel<GuestMessage, HostMessage>) {
	let timeout: ReturnType<typeof setTimeout>;
	function rejectVersion() {
		const state = get(connections);
		if (
			state.tag !== 'guest' ||
			state.connection.tag !== 'guestConnected' ||
			state.connection.channel !== channel
		)
			return;
		disconnect();
		alert(
			'This host uses an incompatible collaboration version. Refresh Flew Notes on both devices and reconnect.'
		);
	}
	channel.onOpen(() => {
		channel.send({ tag: 'hello', protocol: PROTOCOL });
		timeout = setTimeout(rejectVersion, 10000);
	});
	channel.onClose(() => {
		clearTimeout(timeout);
		const state = get(connections);
		if (
			state.tag === 'guest' &&
			state.connection.tag === 'guestConnected' &&
			state.connection.channel === channel
		)
			clearPrediction();
	});
	channel.onMessage((message) => {
		const state = get(connections);
		if (
			state.tag !== 'guest' ||
			state.connection.tag !== 'guestConnected' ||
			state.connection.channel !== channel
		)
			return;
		if (message.tag === 'hello') {
			clearTimeout(timeout);
			if (message.protocol !== PROTOCOL) return rejectVersion();
			compatibleChannels.add(channel);
			return;
		}
		if (message.tag !== 'name' && !compatibleChannels.has(channel)) return rejectVersion();
		switch (message.tag) {
			case 'sync': {
				if (!message.document) return rejectVersion();
				const document = { ...message.document, nodes: message.nodes };
				if (!receiveDocument(document)) return;
				state.connection.awaitingSync = false;
				connections.set(state);
				flowsChange();
				break;
			}
			case 'name':
				state.connection.name = message.name;
				connections.set(state);
				break;
			case 'metadata':
				if (message.documentId !== documentId) return;
				pendingMetadata.delete(message.id);
				applyMetadata(message.patch);
				for (const patch of pendingMetadata.values()) applyMetadata(patch);
				break;
			case 'action':
				if (message.action.documentId !== documentId) return;
				if (get(frozen)) return;
				resolvePendingAction(get(nodes));
				rebase(message.action.actionBundle);
				break;
			case 'actionRecieved': {
				const entry = pending.get(message.actionId);
				if (!entry) return;
				resolvePendingAction(get(nodes));
				rebase(entry.actions, message.actionId);
				break;
			}
		}
	});
}
