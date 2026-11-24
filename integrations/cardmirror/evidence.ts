import {
	validEvidence,
	type CardNode,
	type EvidenceSnapshot
} from '../../src/lib/integrations/cardmirror/protocol';

// Stored HTML is only ever pasted through CardMirror's schema parser, never rendered
// in Flew. Keep formatting while excluding editor controls and active HTML content.
export function safeCardHtml(html: string): string {
	const template = document.createElement('template');
	template.innerHTML = html;
	template.content
		.querySelectorAll(
			'script,style,iframe,object,embed,link,meta,input,button,[contenteditable="false"]'
		)
		.forEach((node) => node.remove());
	const tags = new Set([
		'DIV',
		'P',
		'H4',
		'SPAN',
		'STRONG',
		'B',
		'EM',
		'I',
		'U',
		'S',
		'STRIKE',
		'MARK',
		'SUB',
		'SUP',
		'BR',
		'A',
		'TABLE',
		'TBODY',
		'THEAD',
		'TR',
		'TD',
		'TH',
		'COLGROUP',
		'COL'
	]);
	const attributes = new Set([
		'class',
		'style',
		'href',
		'colspan',
		'rowspan',
		'data-colwidth',
		'data-num-role',
		'data-num-restart'
	]);
	const styles = new Set([
		'font-weight',
		'font-style',
		'text-decoration',
		'text-decoration-line',
		'background-color',
		'color',
		'font-size',
		'font-family',
		'vertical-align',
		'margin-left',
		'text-indent',
		'text-align'
	]);
	for (const element of [...template.content.querySelectorAll('*')]) {
		if (!tags.has(element.tagName)) {
			element.replaceWith(...element.childNodes);
			continue;
		}
		for (const attribute of [...element.attributes]) {
			if (
				!attributes.has(attribute.name) ||
				(attribute.name === 'href' && !/^(https?:|mailto:)/i.test(attribute.value))
			)
				element.removeAttribute(attribute.name);
		}
		if (element instanceof HTMLElement) {
			for (const property of [...element.style]) {
				if (
					!styles.has(property) ||
					/url\s*\(|expression\s*\(|[\\<>]/i.test(element.style.getPropertyValue(property))
				)
					element.style.removeProperty(property);
			}
		}
	}
	return template.innerHTML;
}

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
