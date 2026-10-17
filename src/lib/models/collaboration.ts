import { writable } from 'svelte/store';
import type { BoxId } from './node';
export const speechDropCode = writable('');
export const speechDocument = writable('');
export const speechDocumentSource = writable<{ name: string; room: string; index: number } | null>(
	null
);
speechDocument.subscribe(() => speechDocumentSource.set(null));
export const speechDetected = writable(0);
export type PartnerNotice = { id: string; text: string; received: boolean; argumentId?: BoxId };
export const partnerNotices = writable<PartnerNotice[]>([]);
export function addPartnerNotice(text: string, received: boolean, argumentId?: BoxId) {
	partnerNotices.update((items) => [
		...items.slice(-49),
		{ id: crypto.randomUUID(), text, received, argumentId }
	]);
}
