// Separate from Flew's collaboration/QR wire formats. No relay or stored pairing secrets.
export const kinds = ['pocket', 'hat', 'block', 'tag', 'analytic', 'undertag', 'cite'] as const;
export type Kind = (typeof kinds)[number];
export interface Source {
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
	mode: 'column' | 'cell';
	docTitle: string;
	space: number;
	items: { kind: Kind; text: string; source: string; key: string }[];
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
				string(s.excerpt)
		)
	);
}
export function parsePayload(value: unknown): FlowPayload {
	if (
		!record(value) ||
		!['column', 'cell'].includes(value.mode as string) ||
		!string(value.docTitle, 1000) ||
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
				string(i.key)
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
			key: item.key,
			token: item.source,
			documentTitle: payload.docTitle,
			excerpt: item.text
		};
		const previous = cells[cells.length - 1];
		if (previous && (payload.mode === 'cell' || item.kind === 'cite')) {
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
