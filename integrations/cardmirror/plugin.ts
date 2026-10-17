import { Connection } from '../../src/lib/integrations/cardmirror/connection';
import { record, string } from '../../src/lib/integrations/cardmirror/protocol';
import type { Api, Definition } from './api';

// CardMirror permits loading the same bundle again. Release the previous peer
// before replacing its command handlers so Flew cannot stay paired to old code.
window.__flewCardMirrorDispose?.();
let host: Api | null = null;
let dialog: HTMLDialogElement | null = null;
let status: HTMLParagraphElement | null = null;
let connected = false;
const peer = new Connection(
	async (method, params) => {
		if (method !== 'source.jump' || !record(params) || !string(params.token) || !host)
			throw new Error('Invalid source request.');
		return host.jumpToSource(params.token);
	},
	(state, error) => {
		connected = state === 'connected';
		if (status)
			status.textContent =
				error ||
				(connected
					? 'Connected. You can close this window and send to Flew.'
					: state === 'disconnected'
					? 'Not connected.'
					: 'Waiting for the key exchange…');
		if (connected) host?.showToast('Connected to Flew. Mod+Alt+F sends the selection.');
	}
);
function dispose() {
	peer.close();
	dialog?.close();
	window.removeEventListener('pagehide', dispose);
}
window.__flewCardMirrorDispose = dispose;
window.addEventListener('pagehide', dispose, { once: true });

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
	const el = document.createElement(tag);
	if (text) el.textContent = text;
	return el;
}
function connect(api: Api) {
	host = api;
	if (dialog) {
		dialog.showModal();
		return;
	}
	const previousFocus = document.activeElement as HTMLElement | null;
	dialog = element('dialog');
	dialog.className = 'pmd-confirm';
	dialog.setAttribute('aria-label', 'Connect to Flew');
	Object.assign(dialog.style, {
		maxWidth: '36rem',
		width: '85vw',
		padding: '24px',
		color: 'var(--text, inherit)',
		background: 'var(--bg, Canvas)'
	});
	const heading = element('h2', 'Connect to Flew');
	heading.className = 'pmd-confirm-title';
	dialog.append(heading);
	dialog.append(
		element(
			'p',
			'In Flew, enable Settings → Panels → CardMirror, open a flow and create a connection key. Paste it here, then paste the reply back into Flew. Keys expire after two minutes.'
		)
	);
	const offerLabel = element('label', 'Flew connection key');
	const offer = element('textarea');
	offer.setAttribute('aria-label', 'Flew connection key');
	offer.rows = 3;
	offer.spellcheck = false;
	offer.style.width = '100%';
	offerLabel.append(offer);
	dialog.append(offerLabel);
	const replyLabel = element('label', 'CardMirror reply key');
	const reply = element('textarea');
	reply.setAttribute('aria-label', 'CardMirror reply key');
	reply.rows = 3;
	reply.readOnly = true;
	reply.style.width = '100%';
	reply.addEventListener('focus', () => reply.select());
	replyLabel.append(reply);
	status = element('p', connected ? 'Connected to Flew.' : 'Not connected.');
	status.setAttribute('role', 'status');
	function button(text: string, run: () => void | Promise<void>) {
		const b = element('button', text);
		b.type = 'button';
		b.className = 'pmd-confirm-btn';
		b.addEventListener('click', async () => {
			b.disabled = true;
			try {
				await run();
			} catch (error) {
				if (status)
					status.textContent = error instanceof Error ? error.message : 'Connection failed.';
			} finally {
				b.disabled = false;
			}
		});
		return b;
	}
	dialog.append(
		button('Create reply key', async () => {
			reply.value = '';
			reply.value = await peer.answer(offer.value);
		})
	);
	dialog.append(
		replyLabel,
		button('Copy reply key', () => navigator.clipboard.writeText(reply.value)),
		status
	);
	dialog.append(
		button('Disconnect', () => {
			peer.close();
			offer.value = '';
			reply.value = '';
		})
	);
	dialog.append(button('Done', () => dialog?.close()));
	dialog.addEventListener('keydown', (event) => event.stopPropagation());
	dialog.addEventListener('close', () => {
		dialog?.remove();
		dialog = null;
		status = null;
		previousFocus?.focus();
	});
	document.body.append(dialog);
	dialog.showModal();
	offer.focus();
}

async function invoke(api: Api, fn: () => Promise<unknown>, success: (value: unknown) => string) {
	host = api;
	try {
		api.showToast(success(await fn()));
	} catch (error) {
		api.showToast(error instanceof Error ? error.message : 'Flew request failed.');
	}
}
function extract(api: Api) {
	const selection = api.extractSelection();
	if (!selection.ok)
		throw new Error(
			selection.error === 'no-active-doc'
				? 'Open a CardMirror document first.'
				: selection.error === 'no-heading-at-cursor'
				? 'Select an argument or put the cursor in a heading first.'
				: 'There is no sendable text in this selection.'
		);
	return selection;
}
async function send(api: Api, mode?: 'column' | 'cell') {
	await invoke(
		api,
		() => {
			const selection = extract(api);
			const setting = api.settings.get('space');
			return peer.request('flow.insert', {
				mode: mode ?? (api.settings.get('mode') === 'Everything in one cell' ? 'cell' : 'column'),
				docTitle: selection.docTitle,
				space:
					typeof setting === 'number' && Number.isFinite(setting)
						? Math.max(0, Math.min(10, Math.round(setting)))
						: 0,
				items: selection.items.map((item) => ({
					...item,
					key: selection.docId + '|' + item.text.toLowerCase()
				}))
			});
		},
		(value) => (record(value) ? `Sent to Flew: ${value.page}.` : 'Sent to Flew.')
	);
}

export const definition: Definition = {
	id: 'cardmirror-flew',
	name: 'Flew Notes integration',
	apiVersion: 1,
	settings: [
		{
			key: 'mode',
			label: 'Send mode',
			type: 'select',
			default: 'One cell per line',
			options: ['One cell per line', 'Everything in one cell'],
			description: 'Default layout for Send to Flew.'
		},
		{
			key: 'space',
			label: 'Empty cells after a send',
			type: 'number',
			default: 0,
			description: '0–10 blank cells between selections sent to Flew.'
		}
	],
	commands: [
		{
			id: 'cardmirror-flew.connect',
			label: 'Connect to Flew',
			keywords: ['flew', 'flow', 'pair'],
			defaultKey: null,
			run: connect
		},
		{
			id: 'cardmirror-flew.disconnect',
			label: 'Disconnect Flew',
			keywords: ['flew', 'flow'],
			defaultKey: null,
			run: (api) => {
				peer.close();
				api.showToast('Disconnected from Flew.');
			}
		},
		{
			id: 'cardmirror-flew.send',
			label: 'Send to Flew',
			keywords: ['flew', 'flow', 'send'],
			defaultKey: 'Mod-Alt-f',
			run: (api) => send(api)
		},
		{
			id: 'cardmirror-flew.sendColumn',
			label: 'Send to Flew (one cell per line)',
			keywords: ['flew', 'flow', 'column'],
			defaultKey: null,
			run: (api) => send(api, 'column')
		},
		{
			id: 'cardmirror-flew.sendCell',
			label: 'Send to Flew (single cell)',
			keywords: ['flew', 'flow', 'cell'],
			defaultKey: null,
			run: (api) => send(api, 'cell')
		},
		{
			id: 'cardmirror-flew.toggleMode',
			label: 'Toggle Flew Send Mode',
			keywords: ['flew', 'mode'],
			defaultKey: null,
			run: (api) => {
				const mode = api.settings.get('mode') === 'Everything in one cell' ? 'column' : 'cell';
				const bag = api.storage.get('__settings');
				api.storage.set('__settings', {
					...(record(bag) ? bag : {}),
					mode: mode === 'cell' ? 'Everything in one cell' : 'One cell per line'
				});
				api.showToast(
					mode === 'cell' ? 'Flew: everything in one cell.' : 'Flew: one cell per line.'
				);
			}
		},
		{
			id: 'cardmirror-flew.reveal',
			label: 'Reveal in Flew',
			keywords: ['flew', 'flow', 'reveal', 'find'],
			defaultKey: 'Mod-Alt-e',
			run: (api) =>
				invoke(
					api,
					() => {
						const selection = extract(api);
						return peer.request('flow.reveal', {
							keys: [
								...new Set(selection.items.map((i) => selection.docId + '|' + i.text.toLowerCase()))
							]
						});
					},
					(value) =>
						record(value)
							? `Flew: match ${value.position} of ${value.matches}.`
							: 'Revealed in Flew.'
				)
		},
		{
			id: 'cardmirror-flew.choosePage',
			label: 'Choose Flew Page',
			keywords: ['flew', 'flow', 'page', 'target'],
			defaultKey: null,
			run: (api) =>
				invoke(
					api,
					async () => {
						const pages = await peer.request('flow.pages', {});
						if (!Array.isArray(pages) || !pages.length)
							throw new Error('Open a flow in Flew first.');
						const next = pages[(pages.findIndex((p) => p.selected) + 1) % pages.length];
						await peer.request('flow.select', { id: next.id });
						return next.title;
					},
					(value) => `Flew destination: ${value}.`
				)
		}
	]
};
window.__registerCardMirrorPlugin?.(definition);
