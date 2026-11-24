// Separate from Flew's collaboration/QR wire formats. No relay or stored pairing secrets.
export const kinds = ['pocket', 'hat', 'block', 'tag', 'analytic', 'undertag', 'cite'] as const;
export type Kind = (typeof kinds)[number];
// Self-contained evidence, retained with the flow even if the source file moves.
export interface CardNode {
	type: string;
	text?: string;
	attrs?: Record<string, unknown>;
	marks?: { type: string; attrs?: Record<string, unknown> }[];
	content?: CardNode[];
}
export interface EvidenceSnapshot {
	version: 1;
	id: string;
	node: CardNode;
	html: string;
}
export interface ExportItem {
	text: string;
	evidence?: EvidenceSnapshot[];
}
export function validEvidence(value: unknown): value is EvidenceSnapshot {
	if (
		!record(value) ||
		value.version !== 1 ||
		!string(value.id) ||
		!string(value.html, 1_000_000) ||
		!record(value.node) ||
		!['card', 'analytic_unit'].includes(value.node.type as string)
	)
		return false;
	let count = 0;
	function validNode(node: unknown, depth: number): boolean {
		return (
			++count <= 10000 &&
			depth <= 64 &&
			record(node) &&
			string(node.type, 100) &&
			(node.text === undefined || string(node.text, 1_000_000)) &&
			(node.attrs === undefined || record(node.attrs)) &&
			(node.marks === undefined ||
				(Array.isArray(node.marks) &&
					node.marks.length <= 50 &&
					node.marks.every(
						(mark) =>
							record(mark) &&
							string(mark.type, 100) &&
							(mark.attrs === undefined || record(mark.attrs))
					))) &&
			(node.content === undefined ||
				(Array.isArray(node.content) && node.content.every((child) => validNode(child, depth + 1))))
		);
	}
	try {
		return JSON.stringify(value.node).length <= 1_000_000 && validNode(value.node, 0);
	} catch {
		return false;
	}
}
export interface Source {
	evidence?: EvidenceSnapshot;
	kind?: Kind;
	key: string;
	token: string;
	documentTitle: string;
	excerpt: string;
}
export interface Provenance {
	kind: Kind;
	sources: Source[];
}
export interface FlowPayload {
	placement?: 'below' | 'responses';
	mode: 'column' | 'cell';
	docTitle: string;
	space: number;
	items: { kind: Kind; text: string; source: string; key: string; evidence?: EvidenceSnapshot }[];
}
export function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function string(value: unknown, max = 100_000): value is string {
	return typeof value === 'string' && value.length <= max;
}
export function isKind(value: unknown): value is Kind {
	return kinds.includes(value as Kind);
}
export function validProvenance(value: unknown): value is Provenance {
	return (
		record(value) &&
		isKind(value.kind) &&
		Array.isArray(value.sources) &&
		value.sources.length > 0 &&
		value.sources.length <= 500 &&
		value.sources.every(
			(s) =>
				record(s) &&
				string(s.key) &&
				string(s.token) &&
				string(s.documentTitle, 1000) &&
				string(s.excerpt) &&
				(s.kind === undefined || isKind(s.kind)) &&
				(s.evidence === undefined || validEvidence(s.evidence))
		)
	);
}
export function parsePayload(value: unknown): FlowPayload {
	if (
		!record(value) ||
		!['column', 'cell'].includes(value.mode as string) ||
		!string(value.docTitle, 1000) ||
		(value.placement !== undefined &&
			value.placement !== 'below' &&
			value.placement !== 'responses') ||
		!Number.isInteger(value.space) ||
		(value.space as number) < 0 ||
		(value.space as number) > 10 ||
		!Array.isArray(value.items) ||
		!value.items.length ||
		value.items.length > 500 ||
		!value.items.every(
			(i) =>
				record(i) &&
				isKind(i.kind) &&
				string(i.text) &&
				i.text.trim().length > 0 &&
				string(i.source) &&
				string(i.key) &&
				(i.evidence === undefined || validEvidence(i.evidence))
		)
	) {
		throw new Error('Invalid CardMirror selection. Send at most 500 items at a time.');
	}
	return value as unknown as FlowPayload;
}

export interface ImportedCell {
	content: string;
	bold?: boolean;
	cardMirror?: Provenance;
	cardMirrorSpacer?: true;
}
export function layout(payload: FlowPayload): ImportedCell[] {
	const cells: ImportedCell[] = [];
	for (const item of payload.items) {
		const source: Source = {
			kind: item.kind,
			key: item.key,
			token: item.source,
			documentTitle: payload.docTitle,
			excerpt: item.text,
			...(item.evidence ? { evidence: item.evidence } : {})
		};
		const previous = cells[cells.length - 1];
		if (previous && (payload.mode === 'cell' || item.kind === 'cite')) {
			if (
				source.evidence &&
				previous.cardMirror?.sources.some((saved) => saved.evidence?.id === source.evidence?.id)
			)
				delete source.evidence;
			previous.content += '\n' + item.text;
			previous.cardMirror!.sources.push(source);
		} else {
			cells.push({
				content: item.text,
				bold: ['pocket', 'hat', 'block'].includes(item.kind),
				cardMirror: { kind: item.kind, sources: [source] }
			});
		}
	}
	for (let i = 0; i < payload.space; i++) cells.push({ content: '', cardMirrorSpacer: true });
	return cells;
}
