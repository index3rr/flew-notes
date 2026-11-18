import type { Box, BoxId, Flow, FlowId, Node, Nodes } from './node';

// Coverage answers the two questions a debater asks before every speech:
// "what did they say that I haven't answered yet?" and "what of mine did they drop?"
// A speech is a column. Columns alternate sides, so column c - 1 is always the other side's
// last speech on that page and column c - 2 is your own.

export type CoverageItem = {
	id: BoxId;
	content: string;
	// The page's top-level argument this line descends from, for context when content is terse.
	root: string;
	// For dropped arguments: whether this speech already extends it.
	extended: boolean;
};

export type CoveragePage = {
	flowId: FlowId;
	name: string;
	invert: boolean;
	column: number;
	toAnswer: CoverageItem[];
	answered: number;
	dropped: CoverageItem[];
};

export type Coverage = { speech: string; pages: CoveragePage[] };

export function speechParts(column: string): string[] {
	return column
		.split('/')
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean);
}

export function columnForSpeech(columns: string[], speech: string): number {
	const exact = columns.findIndex((column) => column === speech);
	if (exact !== -1) return exact;
	const wanted = speechParts(speech);
	return columns.findIndex((column) => speechParts(column).some((part) => wanted.includes(part)));
}

// Every speech column in the document, in round order (the longest page decides the order).
export function documentSpeeches(nodes: Nodes): string[] {
	const pages = nodes.root.children
		.map((id) => nodes[id]?.value)
		.filter((value): value is Flow => value?.tag === 'flow');
	const ordered = [...pages].sort((a, b) => b.columns.length - a.columns.length);
	const speeches: string[] = [];
	for (const page of ordered)
		for (const column of page.columns)
			if (!speeches.some((speech) => columnForSpeech([speech], column) !== -1))
				speeches.push(column);
	return speeches;
}

function box(nodes: Nodes, id: BoxId): Node<Box> | null {
	const node = nodes[id];
	return node?.value.tag === 'box' ? (node as Node<Box>) : null;
}

function hasText(node: Node<Box>) {
	return node.value.content.trim().length > 0;
}

// A real response is a child cell with words in it. Extensions and blank cells mean "skipped".
function isAnswered(nodes: Nodes, node: Node<Box>) {
	return node.children.some((id) => {
		const child = box(nodes, id);
		return !!child && !child.value.isExtension && !child.value.empty && hasText(child);
	});
}

function isExtended(nodes: Nodes, node: Node<Box>) {
	return node.children.some((id) => {
		const extension = box(nodes, id);
		return (
			!!extension?.value.isExtension &&
			extension.children.some((grandchild) => {
				const response = box(nodes, grandchild);
				return !!response && hasText(response);
			})
		);
	});
}

function rootText(nodes: Nodes, node: Node<Box>): string {
	let current: Node<Box> = node;
	let best = hasText(node) && !node.value.isExtension ? node.value.content : '';
	while (current.parent !== current.value.flowId) {
		const parent = box(nodes, current.parent as BoxId);
		if (!parent) break;
		current = parent;
		if (hasText(current) && !current.value.isExtension) best = current.value.content;
	}
	return best.trim();
}

function boxesInColumn(nodes: Nodes, flowId: FlowId, column: number): BoxId[] {
	let level: (BoxId | FlowId)[] = [flowId];
	for (let depth = 0; depth <= column; depth++)
		level = level.flatMap((id) => (nodes[id]?.children ?? []) as BoxId[]);
	return level as BoxId[];
}

function item(nodes: Nodes, id: BoxId, node: Node<Box>): CoverageItem {
	const root = rootText(nodes, node);
	return {
		id,
		content: node.value.content.trim(),
		root: root === node.value.content.trim() ? '' : root,
		extended: isExtended(nodes, node)
	};
}

export function computeCoverage(nodes: Nodes, speech: string): Coverage {
	const pages: CoveragePage[] = [];
	for (const flowId of nodes.root.children) {
		const flow = nodes[flowId]?.value;
		if (flow?.tag !== 'flow') continue;
		const column = columnForSpeech(flow.columns, speech);
		if (column < 1) continue;
		const page: CoveragePage = {
			flowId,
			name: flow.content,
			invert: flow.invert,
			column,
			toAnswer: [],
			answered: 0,
			dropped: []
		};
		for (const id of boxesInColumn(nodes, flowId, column - 1)) {
			const node = box(nodes, id);
			if (!node || node.value.empty || node.value.isExtension || node.value.crossed) continue;
			if (!hasText(node)) continue;
			if (isAnswered(nodes, node)) page.answered++;
			else page.toAnswer.push(item(nodes, id, node));
		}
		if (column >= 2)
			for (const id of boxesInColumn(nodes, flowId, column - 2)) {
				const node = box(nodes, id);
				if (!node || node.value.empty || node.value.crossed) continue;
				if (!hasText(node) && !node.value.isExtension) continue;
				// An extension cell of yours stands for the argument it carries forward.
				if (node.value.isExtension && !rootText(nodes, node)) continue;
				if (!isAnswered(nodes, node)) page.dropped.push(item(nodes, id, node));
			}
		if (page.toAnswer.length || page.answered || page.dropped.length) pages.push(page);
	}
	return { speech, pages };
}

// Without a running timer, assume the speech after the furthest one anyone has written in.
export function nextSpeech(nodes: Nodes, speeches = documentSpeeches(nodes)): string | null {
	let furthest = -1;
	for (const flowId of nodes.root.children) {
		const flow = nodes[flowId]?.value;
		if (flow?.tag !== 'flow') continue;
		flow.columns.forEach((column, index) => {
			const written = boxesInColumn(nodes, flowId, index).some((id) => {
				const node = box(nodes, id);
				return !!node && hasText(node);
			});
			if (written) furthest = Math.max(furthest, columnForSpeech(speeches, column));
		});
	}
	return speeches[Math.min(furthest + 1, speeches.length - 1)] ?? null;
}

// CX and prep belong to the speech that follows them.
export function speechForTimer(upcoming: string[], speeches: string[]) {
	for (const name of upcoming) {
		const match = speeches.find((speech) => columnForSpeech([speech], name) !== -1);
		if (match) return match;
	}
	return null;
}
