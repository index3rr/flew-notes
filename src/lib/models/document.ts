import { writable, get } from 'svelte/store';
import { nodes } from './store';
import type { Nodes } from './node';

// A document contains all flow pages and the notes sidebar.
export const documentTitle = writable('');
export const documentCreated = writable<string | null>(null);
let unnamedTitle = newDefaultTitle();
function newDefaultTitle() {
	return `Flow ${new Date().toISOString().replace(/[:.]/g, '-')}`;
}
export function resetDocumentTitle(title = '') {
	unnamedTitle = newDefaultTitle();
	documentTitle.set(title);
}
export function documentFilename(title = get(documentTitle)) {
	const sanitized = title.trim().replace(/[<>:"/\\|?*]/g, '-');
	const encoder = new TextEncoder();
	let safe = '';
	// Leave room for the extension and collision suffix on filesystems with a
	// 255-byte filename limit, without splitting a Unicode character.
	for (const char of sanitized) {
		const next = safe + (char.charCodeAt(0) < 32 ? '-' : char);
		if (encoder.encode(next).length > 200) break;
		safe = next;
	}
	safe = safe.replace(/[. ]+$/g, '');
	const name = safe || unnamedTitle;
	return `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? '_' : ''}${name}.json`;
}

export function documentTitleFromFilename(name: string) {
	return name.replace(/\.(json|xlsx)$/i, '');
}

// Document identity belongs to the collaboration session, never to a local file path.
export const documentOpen = writable(false);
export let documentId: string = crypto.randomUUID();
export let changingDocument = false;
export function beginDocumentChange() {
	changingDocument = true;
}
export function endDocumentChange() {
	changingDocument = false;
}
export function setDocumentId(id: string = crypto.randomUUID()) {
	documentId = id;
}
export type SharedDocument = {
	id: string;
	open: boolean;
	title: string;
	created: string | null;
	nodes: Nodes;
};
export function sharedDocument(): SharedDocument {
	return {
		id: documentId,
		open: get(documentOpen),
		title: get(documentTitle),
		created: get(documentCreated),
		nodes: get(nodes)
	};
}
let receiveDocument: (document: SharedDocument) => void;
export function registerDocumentReceiver(receiver: typeof receiveDocument) {
	receiveDocument = receiver;
}
export function receiveSharedDocument(document: SharedDocument) {
	receiveDocument(document);
}
