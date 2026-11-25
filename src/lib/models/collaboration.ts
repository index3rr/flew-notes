import { showArgument } from './argumentNavigation';
import { writable, get } from 'svelte/store';
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
function savedMessages(): PartnerNotice[] {
	try {
		const data = JSON.parse(localStorage.getItem('partnerMessages') ?? '[]');
		return Array.isArray(data)
			? data
					.filter(
						(item) =>
							item &&
							typeof item.id === 'string' &&
							typeof item.text === 'string' &&
							typeof item.received === 'boolean' &&
							(item.argumentId === undefined || typeof item.argumentId === 'string')
					)
					.slice(-500)
			: [];
	} catch {
		return [];
	}
}
export const partnerNotices = writable<PartnerNotice[]>(savedMessages());
partnerNotices.subscribe((messages) => {
	try {
		localStorage.setItem('partnerMessages', JSON.stringify(messages));
	} catch {
		/* Keep messages in memory if storage is full. */
	}
});
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
	partnerNotices.update((items) => [...items.slice(-499), { id, text, received, argumentId }]);
}

export const systemNoticeIds = writable<Set<string>>(new Set());
export const partnerNotificationPermission = writable<NotificationPermission | 'unsupported'>(
	'Notification' in window ? Notification.permission : 'unsupported'
);
export function watchPartnerNotifications() {
	let permission: PermissionStatus | undefined;
	let stopped = false;
	const refresh = () =>
		partnerNotificationPermission.set(
			'Notification' in window ? Notification.permission : 'unsupported'
		);
	refresh();
	window.addEventListener('focus', refresh);
	if ('Notification' in window)
		void navigator.permissions
			?.query({ name: 'notifications' })
			.then((status) => {
				if (stopped) return;
				permission = status;
				permission.addEventListener('change', refresh);
			})
			.catch(() => undefined);
	return () => {
		stopped = true;
		window.removeEventListener('focus', refresh);
		permission?.removeEventListener('change', refresh);
	};
}
export async function enablePartnerNotifications() {
	if (!('Notification' in window)) return;
	const previous = get(partnerNotificationPermission);
	const permission = await Notification.requestPermission();
	partnerNotificationPermission.set(permission);
	if (permission === 'granted' && previous !== 'granted') {
		new Notification('Flew Notes', {
			body: 'Partner notifications enabled.',
			icon: '/favicon.png',
			tag: 'flew-partner-notification-test'
		});
	}
}
