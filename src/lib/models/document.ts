import { writable, get } from 'svelte/store';

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
