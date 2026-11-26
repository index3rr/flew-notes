import { safeCardHtml } from './html';
import { exportItems } from './evidence';
import { validEvidence, type CardNode, type ExportItem, type EvidenceSnapshot } from './protocol';
import type { SerializedBox } from '../../models/node';
export const evidenceMime = 'application/x-flew-evidence';
export function evidenceHtml(boxes: SerializedBox[]): string {
	return exportItems(boxes)
		.map((item) => {
			if (item.evidence?.length)
				return item.evidence.map((card) => safeCardHtml(card.html)).join('');
			const unit = document.createElement('div');
			unit.className = 'pmd-analytic-unit';
			const line = document.createElement('p');
			line.className = 'pmd-analytic';
			line.textContent = item.text;
			unit.append(line);
			return unit.outerHTML;
		})
		.join('');
}
export function setEvidenceTransfer(transfer: DataTransfer, boxes: SerializedBox[]) {
	transfer.setData('text/html', evidenceHtml(boxes));
	transfer.setData(evidenceMime, JSON.stringify(exportItems(boxes)));
}
export async function copyBoxes(boxes: SerializedBox[], text: string) {
	if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
		try {
			await navigator.clipboard.write([
				new ClipboardItem({
					'text/plain': new Blob([text], { type: 'text/plain' }),
					'text/html': new Blob([evidenceHtml(boxes)], { type: 'text/html' })
				})
			]);
			return;
		} catch {
			/* Plain text still works on browsers without rich clipboard access. */
		}
	}
	await navigator.clipboard.writeText(text);
}
function inline(node: Node, marks: NonNullable<CardNode['marks']> = []): CardNode[] {
	if (node.nodeType === Node.TEXT_NODE)
		return node.textContent
			? [{ type: 'text', text: node.textContent, ...(marks.length ? { marks } : {}) }]
			: [];
	if (!(node instanceof HTMLElement)) return [];
	if (node.tagName === 'BR') return [{ type: 'hard_break' }];
	const next = [...marks];
	const add = (type: string, attrs?: Record<string, unknown>) => {
		if (!next.some((mark) => mark.type === type)) next.push({ type, ...(attrs ? { attrs } : {}) });
	};
	if (node.matches('b,strong') || Number(node.style.fontWeight) >= 600) add('bold');
	if (node.matches('i,em') || node.style.fontStyle === 'italic') add('italic');
	if (node.matches('.pmd-emphasis')) add('emphasis_mark');
	else if (node.matches('.pmd-underline')) add('underline_mark');
	else if (node.matches('.pmd-cite')) add('cite_mark');
	else if (node.tagName === 'U' || /underline/.test(node.style.textDecoration))
		add('underline_direct');
	if (node.matches('s,strike') || /line-through/.test(node.style.textDecoration))
		add('strikethrough');
	if (node.tagName === 'MARK' || node.hasAttribute('data-highlight') || node.style.backgroundColor)
		add('highlight', {
			color: node.getAttribute('data-highlight') || node.style.backgroundColor || 'yellow'
		});
	if (node.tagName === 'A' && /^(https?:|mailto:)/i.test(node.getAttribute('href') ?? ''))
		add('link', { href: node.getAttribute('href') });
	return [...node.childNodes].flatMap((child) => inline(child, next));
}
export function cardsFromHtml(html: string): SerializedBox[] {
	if (!html || html.length > 1_000_000) return [];
	const template = document.createElement('template');
	template.innerHTML = safeCardHtml(html);
	const units = [...template.content.querySelectorAll<HTMLElement>('.pmd-card,.pmd-analytic-unit')];
	if (!units.length) {
		for (const heading of template.content.querySelectorAll<HTMLElement>(
			'h4.pmd-tag,p.pmd-analytic'
		)) {
			const unit = document.createElement('div');
			unit.className = heading.matches('h4') ? 'pmd-card' : 'pmd-analytic-unit';
			unit.append(heading.cloneNode(true));
			let next = heading.nextElementSibling;
			while (next && !next.matches('h4.pmd-tag,p.pmd-analytic')) {
				unit.append(next.cloneNode(true));
				next = next.nextElementSibling;
			}
			units.push(unit);
		}
	}
	return units.flatMap((unit) => {
		const heading = unit.querySelector<HTMLElement>('h4.pmd-tag,h4,p.pmd-analytic');
		if (!heading) return [];
		const analytic = unit.classList.contains('pmd-analytic-unit');
		const content: CardNode[] = [];
		for (const element of unit.querySelectorAll<HTMLElement>('h4,p')) {
			const type =
				element === heading
					? analytic
						? 'analytic'
						: 'tag'
					: element.matches('.pmd-cite-para,.pmd-citation')
					? 'cite_paragraph'
					: element.matches('.pmd-undertag')
					? 'undertag'
					: 'card_body';
			content.push({
				type,
				...(element === heading ? { attrs: { id: crypto.randomUUID() } } : {}),
				content: [...element.childNodes].flatMap((child) => inline(child))
			});
		}
		const evidence: EvidenceSnapshot = {
			version: 1,
			id: 'clipboard:' + crypto.randomUUID(),
			node: { type: analytic ? 'analytic_unit' : 'card', content },
			html: safeCardHtml(unit.outerHTML)
		};
		if (!validEvidence(evidence)) return [];
		const tag = heading.textContent?.trim() ?? '';
		const cite = unit.querySelector('.pmd-cite-para,.pmd-citation')?.textContent?.trim();
		return [
			{
				value: {
					content: tag + (cite ? '\n' + cite : ''),
					cardMirror: {
						kind: analytic ? ('analytic' as const) : ('tag' as const),
						sources: [
							{
								key: evidence.id,
								token: '',
								documentTitle: 'Pasted CardMirror card',
								excerpt: tag,
								evidence
							}
						]
					}
				},
				children: []
			}
		];
	});
}
export function readEvidenceTransfer(transfer: DataTransfer): SerializedBox[] {
	const raw = transfer.getData(evidenceMime);
	if (raw) {
		try {
			const items: ExportItem[] = JSON.parse(raw);
			if (Array.isArray(items)) {
				const html = items
					.flatMap((item) =>
						Array.isArray(item.evidence)
							? item.evidence.filter(validEvidence).map((card) => card.html)
							: []
					)
					.join('');
				const cards = cardsFromHtml(html);
				if (cards.length) return cards;
			}
		} catch {
			/* Fall back to the host's normal HTML clipboard. */
		}
	}
	return cardsFromHtml(transfer.getData('text/html'));
}
