import { safeCardHtml, snapshotCard } from './evidence';
import type { ExportItem, Provenance } from '../../src/lib/integrations/cardmirror/protocol';
// Keep desktop DOM access here: the v1 public API exposes only selection extraction.
let lastEditor: HTMLElement | null = null;
function rememberEditor(event: FocusEvent) {
	const target = event.target;
	if (target instanceof Element)
		lastEditor = target.closest<HTMLElement>('.ProseMirror') ?? lastEditor;
}
document.addEventListener('focusin', rememberEditor);
export function disposeOutline() {
	document.removeEventListener('focusin', rememberEditor);
	lastEditor = null;
	outlineChannel?.close();
}
function editor(speech: boolean): HTMLElement {
	const localSpeech = document.querySelector<HTMLElement>('.pmd-pane-speech .ProseMirror');
	const element = speech
		? localSpeech ??
		  (document.body.classList.contains('pmd-speech-banner-visible')
				? document.querySelector<HTMLElement>('.ProseMirror')
				: null)
		: lastEditor?.isConnected
		? lastEditor
		: document.querySelector<HTMLElement>('.ProseMirror-focused, .ProseMirror');
	if (!element)
		throw new Error(
			speech
				? 'Open the speech document in this CardMirror window first.'
				: 'Open a CardMirror document first.'
		);
	return element;
}
function localOutline(speech: boolean) {
	const element = editor(speech);
	const blocks: {
		title: string;
		group: string;
		tags: string[];
		provenance?: (Provenance | null)[];
	}[] = [];
	let current: (typeof blocks)[number] | null = null;
	let group = '';
	for (const heading of element.querySelectorAll('h1,h2,h3,h4,p.pmd-analytic')) {
		const copy = heading.cloneNode(true) as HTMLElement;
		copy.querySelectorAll('[contenteditable="false"]').forEach((node) => node.remove());
		const text = copy.textContent?.trim() ?? '';
		if (!text) continue;
		if (heading.matches('h1,h2')) group = text;
		else if (heading.matches('h3')) {
			current = { title: text, group, tags: [] };
			blocks.push(current);
		} else {
			if (!current) {
				current = { title: group || 'Arguments', group, tags: [] };
				blocks.push(current);
			}
			current.tags.push(text);
			const evidence = snapshotCard(heading, document.title);
			(current.provenance ??= []).push(
				evidence
					? {
							kind: heading.matches('h4') ? 'tag' : 'analytic',
							sources: [
								{
									kind: heading.matches('h4') ? 'tag' : 'analytic',
									key: evidence.id,
									token: '',
									documentTitle: document.title,
									excerpt: text,
									evidence
								}
							]
					  }
					: null
			);
		}
	}
	return { name: document.title, blocks };
}
export async function outlineInsert(speech: boolean, items: ExportItem[]) {
	const native = (
		window as unknown as {
			electronAPI?: {
				speechSendSlice?: (payload: {
					sliceJson: unknown;
					atEnd: boolean;
				}) => Promise<{ delivered: boolean; reason?: string }>;
			};
		}
	).electronAPI;
	if (speech && native?.speechSendSlice) {
		const result = await native.speechSendSlice({
			atEnd: true,
			sliceJson: {
				openStart: 0,
				openEnd: 0,
				content: items.flatMap(({ text, evidence }) =>
					evidence?.length
						? evidence.map((snapshot) => snapshot.node)
						: [
								{
									type: 'analytic_unit',
									content: [
										{
											type: 'analytic',
											attrs: { id: crypto.randomUUID() },
											content: [{ type: 'text', text }]
										}
									]
								}
						  ]
				)
			}
		});
		if (result.delivered) return { ok: true, count: items.length };
		if (result.reason !== 'same-window')
			throw new Error('Choose an open speech document in CardMirror first.');
	}
	const element = editor(speech);
	element.focus();
	// Let ProseMirror observe the end-of-document DOM selection, then use its own paste
	// handler. This keeps schema validation, document dirty state, and undo in the host.
	const range = document.createRange();
	range.selectNodeContents(element);
	range.collapse(false);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	document.dispatchEvent(new Event('selectionchange'));
	await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	const wrapper = document.createElement('div');
	for (const { text, evidence } of items) {
		if (evidence?.length) {
			const template = document.createElement('template');
			template.innerHTML = evidence.map((snapshot) => safeCardHtml(snapshot.html)).join('');
			wrapper.append(template.content);
			continue;
		}
		const unit = document.createElement('div');
		unit.className = 'pmd-analytic-unit';
		const paragraph = document.createElement('p');
		paragraph.className = 'pmd-analytic';
		paragraph.textContent = text;
		unit.append(paragraph);
		wrapper.append(unit);
	}
	const clipboardData = new DataTransfer();
	clipboardData.setData('text/plain', items.map((item) => item.text).join('\n'));
	clipboardData.setData('text/html', wrapper.innerHTML);
	const handled = !element.dispatchEvent(
		new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })
	);
	if (!handled) throw new Error('This CardMirror version could not insert the selection.');
	return { ok: true, count: items.length };
}

const outlineChannel =
	typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('flew-cardmirror-outlines') : null;
outlineChannel?.addEventListener('message', (event) => {
	const data = event.data;
	if (!data || data.kind !== 'read-speech' || typeof data.nonce !== 'string') return;
	try {
		outlineChannel.postMessage({
			kind: 'speech-outline',
			nonce: data.nonce,
			result: localOutline(true)
		});
	} catch {
		/* Only the window with the designated speech document replies. */
	}
});
export async function outlineRead(speech: boolean) {
	try {
		return localOutline(speech);
	} catch (error) {
		if (!speech || !outlineChannel) throw error;
	}
	const nonce = crypto.randomUUID();
	return new Promise<{ name: string; blocks: { title: string; group: string; tags: string[] }[] }>(
		(resolve, reject) => {
			const finish = (event: MessageEvent) => {
				if (event.data?.kind === 'speech-outline' && event.data.nonce === nonce) {
					clearTimeout(timeout);
					outlineChannel!.removeEventListener('message', finish);
					resolve(event.data.result);
				}
			};
			const timeout = setTimeout(() => {
				outlineChannel!.removeEventListener('message', finish);
				reject(
					new Error(
						'Open the speech document in this window, or load the companion plugin in its window.'
					)
				);
			}, 3000);
			outlineChannel!.addEventListener('message', finish);
			outlineChannel!.postMessage({ kind: 'read-speech', nonce });
		}
	);
}
