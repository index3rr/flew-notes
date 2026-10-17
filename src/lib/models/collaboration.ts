import { writable } from 'svelte/store';
export const speechDropCode = writable('');
export const speechDocument = writable('');
export const speechDetected = writable(0);
export type PartnerNotice = { id: string; text: string; received: boolean };
export const partnerNotices = writable<PartnerNotice[]>([]);
export function addPartnerNotice(text: string, received: boolean) {
	partnerNotices.update((items) => [
		...items.slice(-49),
		{ id: crypto.randomUUID(), text, received }
	]);
}
