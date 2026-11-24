import { showArgument } from './argumentNavigation';
import { writable } from 'svelte/store';
import type { BoxId } from './node';
export const speechDropCode = writable('');
export const speechDocument = writable('');
export const speechDocumentSource = writable<{ name: string; room: string; index: number } | null>(
	null
);
speechDocument.subscribe(() => speechDocumentSource.set(null));
export const speechDetected = writable(0);
export const transcribedPhrase = writable({ id: 0, text: '' });
export type PartnerNotice = { id: string; text: string; received: boolean; argumentId?: BoxId };
export const partnerNotices = writable<PartnerNotice[]>([]);
export function addPartnerNotice(text: string, received: boolean, argumentId?: BoxId) {
	const id = crypto.randomUUID();
	if (received && 'Notification' in window && Notification.permission === 'granted') {
		try {
			const notification = new Notification('Your debate partner', {
				body: text.replace(/\[\[argument:[^\]]+\]\]/g, '[Argument]'),
				icon: '/favicon.png',
				tag: id
			});
			notification.onerror = () =>
				systemNoticeIds.update((ids) => {
					const next = new Set(ids);
					next.delete(id);
					return next;
				});
			notification.onclick = () => {
				window.focus();
				if (argumentId) showArgument(argumentId);
				notification.close();
			};
			systemNoticeIds.update((ids) => new Set([...ids, id]));
		} catch {
			/* In-app notifications remain available when the browser cannot display one. */
		}
	}
	partnerNotices.update((items) => [...items.slice(-49), { id, text, received, argumentId }]);
}

export const systemNoticeIds = writable<Set<string>>(new Set());
export async function enablePartnerNotifications() {
	if (!('Notification' in window)) return;
	await Notification.requestPermission();
}
