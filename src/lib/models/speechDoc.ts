import type { Box, BoxId, Flow, FlowId, Nodes } from './node';
import type { ActionBundle } from './nodeAction';
import type { DebateStyleFlow } from './debateStyle';
import { columnForSpeech } from './coverage';

// Speech documents (Verbatim and friends) are outlines: pockets and hats (h1/h2) group blocks
// (h3, usually one per off-case position or answer block), and tags (h4) are the arguments.
// Flowing a document drops each block's tags into the speech's column on a matching page.

export type DocBlock = {
	title: string;
	group: string;
	tags: string[];
	provenance?: (import('../integrations/cardmirror/protocol').Provenance | null)[];
};

// Verbatim names its heading styles; mammoth only maps the built-in Heading 1-4 by default.
export const speechDocStyleMap = [
	"p[style-name='Pocket'] => h1:fresh",
	"p[style-name='Hat'] => h2:fresh",
	"p[style-name='Block'] => h3:fresh",
	"p[style-name='Tag'] => h4:fresh"
];

function decode(text: string) {
	return text
		.replace(/<[^>]*>/g, '')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
}

// Reads mammoth's HTML as text only; it is never inserted into the page.
export function blocksFromHtml(html: string): DocBlock[] {
	const headings: { level: number; text: string }[] = [];
	for (const match of html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/g)) {
		const text = decode(match[2]);
		if (text) headings.push({ level: Number(match[1]), text });
	}
	const tagLevel = headings.some((heading) => heading.level === 4)
		? 4
		: Math.max(0, ...headings.map((heading) => heading.level));
	const blockLevel = [3, 2, 1].find(
		(level) => level < tagLevel && headings.some((heading) => heading.level === level)
	);
	const blocks: DocBlock[] = [];
	let group = '';
	let current: DocBlock | null = null;
	for (const heading of headings) {
		if (blockLevel && heading.level < blockLevel) {
			group = heading.text;
			current = null;
		} else if (heading.level === blockLevel) {
			current = { title: heading.text, group, tags: [] };
			blocks.push(current);
		} else if (heading.level === tagLevel) {
			if (!current) {
				current = { title: group || 'Untitled', group, tags: [] };
				blocks.push(current);
			}
			current.tags.push(heading.text);
		}
	}
	// A block without tags (an overview or analytic block) still deserves a cell.
	for (const block of blocks) if (!block.tags.length) block.tags.push(block.title);
	return blocks;
}

// Tags are written to be read aloud; on a flow the claim before the first dash is enough.
export function shortenTag(tag: string): string {
	const clause = tag.split(/\s[—–-]\s|\s?—\s?|;\s|:\s(?=[A-Z])/)[0].trim();
	const short = clause.length >= 12 ? clause : tag;
	return short.length > 140 ? short.slice(0, 139).trimEnd() + '…' : short;
}

const filler = new Set(
	'a an the at a2 ext exts extension extensions block blocks frontline frontlines answers answer to vs on case off da das cp cps k adv advantage disad disadvantage turn turns'.split(
		' '
	)
);
const speechWords = /^(?:[12][acn][cr]|[12]ac|[12]nc|[12]nr|[12]ar|cx)$/;

export function nameWords(text: string): string[] {
	return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
		(word) => !filler.has(word) && !speechWords.test(word)
	);
}

// The page a block belongs to: same words, or one name contained in the other.
export function matchPage(block: DocBlock, pages: { id: FlowId; name: string }[]): FlowId | null {
	for (const title of [block.title, block.group]) {
		const words = nameWords(title);
		if (!words.length) continue;
		let best: { id: FlowId; score: number } | null = null;
		for (const page of pages) {
			const pageWords = nameWords(page.name);
			if (!pageWords.length) continue;
			const shared = pageWords.filter((word) => words.includes(word)).length;
			if (shared === 0) continue;
			const contained = shared === pageWords.length || shared === words.length;
			if (!contained) continue;
			const score = shared / Math.max(words.length, pageWords.length);
			if (!best || score > best.score) best = { id: page.id, score };
		}
		if (best) return best.id;
	}
	return null;
}

// A page name for a block that has no page yet: "AT: Doctors DA — 2AC" becomes "Doctors DA".
export function pageName(block: DocBlock): string {
	const cleaned = block.title
		.replace(/^\s*(?:at|a2|answers? to)\s*[:-]?\s*/i, '')
		.split(/\s[—–-]\s|\s?—\s?/)[0]
		.replace(/\b(?:[12](?:ac|nc|nr|ar))\b/gi, '')
		.trim();
	return cleaned || block.title;
}

export function speechFromFileName(name: string, speeches: string[]): string | null {
	const words = name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
	for (const word of words) {
		const speech = speeches.find((candidate) => columnForSpeech([candidate], word) !== -1);
		if (speech) return speech;
	}
	return null;
}

// New pages use the template where this speech comes earliest, so a 2AC answering a new
// off-case position lands on a neg page right after the 1NC column.
export function templateForSpeech(templates: DebateStyleFlow[], speech: string) {
	let best: { template: DebateStyleFlow; column: number } | null = null;
	for (const template of templates) {
		const column = columnForSpeech(template.columns, speech);
		if (column !== -1 && (!best || column < best.column)) best = { template, column };
	}
	return best;
}

export type DocPlanItem = {
	block: DocBlock;
	// An existing page, a new page named `newName`, or nothing.
	target: FlowId | 'new' | 'skip';
	newName: string;
};

const newId = <T>() => crypto.randomUUID() as unknown as T;

export function speechDocActions(
	nodes: Nodes,
	speech: string,
	items: DocPlanItem[],
	templates: DebateStyleFlow[],
	shorten: boolean
): { actions: ActionBundle; first: BoxId | null; pages: number } {
	const actions: ActionBundle = [];
	let first: BoxId | null = null;
	let pages = 0;
	let flowCount = nodes.root.children.length;
	const tagsFor = (block: DocBlock) =>
		block.tags.map((tag) => (shorten ? shortenTag(tag) : tag)).filter(Boolean);
	const addCells = (flowId: FlowId, parent: FlowId | BoxId, start: number, tags: string[]) => {
		tags.forEach((content, index) => {
			const id = newId<BoxId>();
			first ??= id;
			actions.push({
				tag: 'add',
				id,
				parent,
				index: start + index,
				value: { tag: 'box', flowId, content } as Box
			});
		});
	};
	// Responses in a later column hang off a chain of invisible spacers, like CardMirror's column sends.
	const spacerChain = (flowId: FlowId, column: number, topIndex: number) => {
		let parent: FlowId | BoxId = flowId;
		for (let level = 0; level < column; level++) {
			const id = newId<BoxId>();
			actions.push({
				tag: 'add',
				id,
				parent,
				index: level === 0 ? topIndex : 0,
				value: { tag: 'box', flowId, content: '', empty: true }
			});
			parent = id;
		}
		return parent;
	};
	for (const { block, target, newName } of items) {
		const tags = tagsFor(block);
		if (target === 'skip' || !tags.length) continue;
		if (target === 'new') {
			const chosen = templateForSpeech(templates, speech);
			if (!chosen) continue;
			const flowId = newId<FlowId>();
			actions.push({
				tag: 'add',
				id: flowId,
				parent: 'root',
				index: flowCount++,
				value: {
					tag: 'flow',
					content: newName.trim() || pageName(block),
					invert: chosen.template.invert,
					columns: [...chosen.template.columns]
				} as Flow
			});
			pages++;
			addCells(flowId, spacerChain(flowId, chosen.column, 0), 0, tags);
			continue;
		}
		const flow = nodes[target];
		if (flow?.value.tag !== 'flow') continue;
		const column = columnForSpeech(flow.value.columns, speech);
		if (column === -1) continue;
		if (column === 0) {
			// Fill a fresh page's single blank starter cell instead of leaving it above the tags.
			const [only] = flow.children as BoxId[];
			const starter = flow.children.length === 1 ? nodes[only] : null;
			if (
				starter?.value.tag === 'box' &&
				!starter.value.content.trim() &&
				!starter.children.length
			) {
				actions.push({
					tag: 'update',
					id: only,
					newValue: { ...starter.value, content: tags[0], placeholder: undefined }
				});
				first ??= only;
				addCells(target, target, 1, tags.slice(1));
			} else addCells(target, target, flow.children.length, tags);
		} else addCells(target, spacerChain(target, column, flow.children.length), 0, tags);
	}
	return { actions, first, pages };
}

export async function readSpeechDoc(blob: Blob): Promise<DocBlock[]> {
	const { convertToHtml } = await import('mammoth/mammoth.browser');
	const bytes = await blob.arrayBuffer();
	const { value } = await convertToHtml(
		{ arrayBuffer: bytes },
		{ styleMap: speechDocStyleMap, includeDefaultStyleMap: true }
	);
	const blocks = blocksFromHtml(value);
	const { docxEvidence } = await import('../integrations/cardmirror/docx');
	const evidence = await docxEvidence(bytes);
	for (const block of blocks)
		block.provenance = block.tags.map((tag) => evidence.get(tag)?.shift() ?? null);
	return blocks;
}
