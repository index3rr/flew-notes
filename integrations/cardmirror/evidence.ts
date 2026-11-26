import {
	validEvidence,
	type CardNode,
	type EvidenceSnapshot
} from '../../src/lib/integrations/cardmirror/protocol';

import { safeCardHtml } from '../../src/lib/integrations/cardmirror/html';
export { safeCardHtml } from '../../src/lib/integrations/cardmirror/html';

export function snapshotCard(heading: Element, namespace: string): EvidenceSnapshot | undefined {
	const unit = heading.closest<HTMLElement>('.pmd-card, .pmd-analytic-unit');
	if (!unit) return;
	// v1 exposes heading extraction only. Read the unit's immutable ProseMirror
	// node rather than trying to reach or mutate the editor view.
	const node = (
		unit as HTMLElement & { pmViewDesc?: { node?: { toJSON(): CardNode } } }
	).pmViewDesc?.node?.toJSON();
	if (!node) return;
	const first = unit.querySelector('h4[data-id],p.pmd-analytic[data-id]');
	const snapshot = {
		version: 1 as const,
		id: namespace + '|' + (first?.getAttribute('data-id') || JSON.stringify(node)),
		node,
		html: safeCardHtml(unit.outerHTML)
	};
	return validEvidence(snapshot) ? snapshot : undefined;
}
export function captureEvidence(source: string): EvidenceSnapshot | undefined {
	if (!source.startsWith('cmsrc1.')) return;
	try {
		const bytes = source.slice(7).replace(/-/g, '+').replace(/_/g, '/');
		const token = JSON.parse(
			new TextDecoder().decode(Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0)))
		);
		if (typeof token.headingId !== 'string' || typeof token.docId !== 'string') return;
		const heading = [...document.querySelectorAll('.ProseMirror [data-id]')].find(
			(element) => element.getAttribute('data-id') === token.headingId
		);
		return heading ? snapshotCard(heading, token.docId) : undefined;
	} catch {
		return;
	}
}
