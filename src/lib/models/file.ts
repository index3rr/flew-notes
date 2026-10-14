import { Workbook, type Buffer } from 'exceljs';
import { type BoxId, type FlowId, type Nodes, newFlowId, newBoxId, getNode } from './node';
import type { OldBox, OldFlows } from './oldType';
import { newNodes, sideDocText } from './store';
import { applyActionBundle } from './nodeAction';
import { settings, SETTINGS_VERSION } from './settings';
import { get } from 'svelte/store';
import { documentTitle, documentFilename, documentCreated } from './document';
import { trackFileExported } from './telemetry';

const CURRENT_SAVE_VERSION: Version = 1 as const;

type Version = number;

type SaveableNodes = {
	nodes: Nodes;
	version: Version;
	sideDocText?: string;
	title?: string;
	created?: string;
};
export function getJson(nodes: Nodes): string {
	const saveable: SaveableNodes = {
		nodes,
		version: CURRENT_SAVE_VERSION,
		sideDocText: get(sideDocText),
		title: get(documentTitle),
		created: get(documentCreated) ?? undefined
	};
	return JSON.stringify(saveable);
}

export function loadNodes(data: { [key: string]: any }, applyMetadata = true): Nodes {
	if (
		!data ||
		typeof data !== 'object' ||
		(data.version != null && data.version !== 1 && data.version !== 0)
	)
		throw new Error('Unsupported flow file');
	let version: Version = data?.version ?? 0;
	let upgraded = data;
	if (version === 0 && !Array.isArray(data)) throw new Error('Invalid legacy flow file');
	while (version < CURRENT_SAVE_VERSION) {
		if (upgrade[version]) {
			upgraded = upgrade[version](upgraded);
			version += 1;
		} else {
			throw new Error('Cannot upgrade save data');
		}
	}
	const ret: SaveableNodes = upgraded as SaveableNodes;
	validateNodes(ret.nodes);
	if (ret.sideDocText != null && typeof ret.sideDocText !== 'string')
		throw new Error('Invalid notes');
	if (ret.title != null && typeof ret.title !== 'string') throw new Error('Invalid title');
	if (
		ret.created != null &&
		(typeof ret.created !== 'string' || !Number.isFinite(Date.parse(ret.created)))
	)
		throw new Error('Invalid document date');
	if (applyMetadata) {
		sideDocText.set(ret.sideDocText ?? '');
		documentTitle.set(ret.title ?? '');
		documentCreated.set(ret.created ?? null);
	}
	return ret.nodes;
}

function validateNodes(nodes: Nodes) {
	if (
		!nodes?.root ||
		nodes.root.value?.tag !== 'root' ||
		nodes.root.parent !== null ||
		nodes.root.level !== -1
	)
		throw new Error('Invalid flow tree');
	const visited = new Set<string>();
	const queue: { id: string; parent: string | null; level: number; flow?: string }[] = [
		{ id: 'root', parent: null, level: -1 }
	];
	while (queue.length) {
		const { id, parent, level, flow } = queue.pop()!;
		const node = (nodes as unknown as Record<string, NodeData>)[id];
		if (
			!node ||
			visited.has(id) ||
			node.parent !== parent ||
			node.level !== level ||
			!Array.isArray(node.children)
		)
			throw new Error('Invalid flow tree');
		visited.add(id);
		const value = node.value;
		if (id !== 'root') {
			if (typeof value.content !== 'string' || value.tag !== (parent === 'root' ? 'flow' : 'box'))
				throw new Error('Invalid flow node');
			if (
				value.tag === 'flow' &&
				(!Array.isArray(value.columns) ||
					!value.columns.every((c: unknown) => typeof c === 'string') ||
					typeof value.invert !== 'boolean')
			)
				throw new Error('Invalid flow columns');
			if (value.tag === 'box' && value.flowId !== flow) throw new Error('Invalid box flow');
		}
		for (const child of node.children) {
			if (typeof child !== 'string') throw new Error('Invalid child');
			queue.push({
				id: child,
				parent: id,
				level: level + 1,
				flow: value.tag === 'flow' ? id : flow
			});
		}
	}
	if (visited.size !== Object.keys(nodes).length) throw new Error('Unreachable flow nodes');
}
type NodeData = {
	parent: string | null;
	level: number;
	children: string[];
	value: { tag: string; content?: string; columns?: unknown[]; invert?: boolean; flowId?: string };
};

export function downloadJson(nodes: Nodes) {
	const data: string = getJson(nodes);
	downloadString(data, documentFilename());
	trackFileExported('json', nodes.root.children.length);
}

export function downloadSettingsJson() {
	const data = settings.convertSettingsToJson(true);
	downloadString(data, 'settings.json');
}

export function importSettingsJson(data: { [key: string]: any }) {
	if (!data['isSettings']) {
		return;
	}

	if (data['version'] != SETTINGS_VERSION) {
		return; // Handle upgrading settings here if needed in the future
	}

	try {
		settings.parseJsonToSettings(data);
	} catch (e) {
		return;
	}
}

export function downloadString(data: string, filename: string) {
	const element: HTMLAnchorElement = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8, ' + encodeURIComponent(data));
	element.setAttribute('download', filename);
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
}

function childToData(
	nodes: Nodes,
	data: string[][],
	flowId: FlowId,
	boxId: BoxId | FlowId,
	x: number,
	y: number
) {
	let height = 0;
	for (const child of getNode(nodes, boxId).unwrap().children) {
		height += childToData(nodes, data, flowId, child, x + 1, y + height);
	}
	// acutally add it to data
	while (!data[y]) {
		// make list of empty strings of length flow.columns.length
		const row: string[] = Array.from(
			{ length: getNode(nodes, flowId).unwrap().value.columns.length },
			() => ''
		);
		data.push(row);
	}
	// exclude root
	if (x >= 0) {
		const node = getNode(nodes, boxId).unwrap();
		if (node.value.tag === 'box' && node.value.isExtension) {
			data[y][x] = '→ Extended →';
		} else {
			data[y][x] = node.value.content;
		}
	}
	// return 1 height if no children
	return Math.max(1, height);
}

// TODO add extend arrows when content : empty : content cell
function fixXlsxWorkbookName(name: string) {
	for (const char of ['*', '?', ':', '\\', '/', '[', ']']) {
		name = name.replaceAll(char, '');
	}
	name = name.substring(0, 31);
	return name;
}

export function downloadXlsx(nodes: Nodes) {
	const wb: Workbook = new Workbook();

	let unnamedIterator = 1;
	for (const flowId of nodes.root.children) {
		const data: string[][] = [];

		childToData(nodes, data, flowId, flowId, -1, 0);

		let name: string = getNode(nodes, flowId).unwrap().value.content;

		if (!name) {
			// Allows unnamed books to be downloaded
			name = 'Unnamed Flow ' + unnamedIterator;
			unnamedIterator += 1;
		}

		name = fixXlsxWorkbookName(name);
		const ws = wb.addWorksheet(name);
		ws.columns = getNode(nodes, flowId)
			.unwrap()
			.value.columns.map(function (column: string) {
				return { header: column, width: 25 };
			});
		for (let y = 0; y < data.length; y++) {
			// make space for header with + 2
			const row = ws.getRow(y + 2);
			for (let x = 0; x < data[y].length; x++) {
				// light red
				let fill = 'FFFFCCCC';
				// darker red
				let border = 'FFFF9999';

				if (
					(x % 2 == 0 && !getNode(nodes, flowId).unwrap().value.invert) ||
					(x % 2 == 1 && getNode(nodes, flowId).unwrap().value.invert)
				) {
					// light blue
					fill = 'FFCCE5FF';
					// darker blue
					border = 'FF99CCFF';
				}
				const cell = row.getCell(x + 1);
				cell.value = data[y][x];

				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: fill }
				};
				cell.border = {
					top: { style: 'thin', color: { argb: border } },
					left: { style: 'thin', color: { argb: border } },
					bottom: { style: 'thin', color: { argb: border } },
					right: { style: 'thin', color: { argb: border } }
				};
				cell.alignment = { wrapText: true };
			}
		}
		// bold headers
		ws.getRow(1).font = { bold: true };
	}
	wb.xlsx
		.writeBuffer()
		.then(function (value: Buffer) {
			// build anchor tag and attach file (works in chrome)
			const a: HTMLAnchorElement = document.createElement('a');
			const data: Blob = new Blob([value], {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});

			const url: string = URL.createObjectURL(data);
			a.href = url;
			a.download = documentFilename().replace(/\.json$/, '.xlsx');
			document.body.appendChild(a);
			a.click();
			setTimeout(function () {
				document.body.removeChild(a);
				window.URL.revokeObjectURL(url);
			}, 0);
			trackFileExported('xlsx', nodes.root.children.length);
		})
		.catch(function (error) {
			console.log(error.message);
		});
}

const upgrade: {
	[key: number]: (saved: { [key: string]: any }) => SaveableNodes;
} = {
	0: upgrade_0_1
};

function upgrade_0_1(saved: { [key: string]: any }): SaveableNodes {
	const flows = saved as OldFlows;
	const nodes: Nodes = newNodes();
	for (let i = 0; i < flows.length; i++) {
		const flow = flows[i];
		const flowId = newFlowId();
		applyActionBundle(
			nodes,
			[
				{
					tag: 'add',
					parent: 'root',
					id: flowId,
					index: i,
					value: {
						tag: 'flow',
						content: flow.content,
						invert: flow.invert,
						columns: flow.columns
					}
				}
			],
			false
		);
		for (let j = 0; j < flow.children.length; j++) {
			const box = flow.children[j];
			upgrade_0_1_addBoxesRec(nodes, flowId, flowId, box, j);
		}
	}
	const ret: SaveableNodes = { nodes, version: 1 };
	return ret;
}

function upgrade_0_1_addBoxesRec(
	nodes: Nodes,
	flowId: FlowId,
	parentId: FlowId | BoxId,
	box: OldBox,
	index: number
) {
	const id = newBoxId();
	applyActionBundle(
		nodes,
		[
			{
				tag: 'add',
				parent: parentId,
				id,
				index,
				value: {
					tag: 'box',
					content: box.content,
					flowId,

					placeholder: box.placeholder,
					empty: box.empty,
					crossed: box.crossed
				}
			}
		],
		false
	);
	for (let i = 0; i < box.children.length; i++) {
		upgrade_0_1_addBoxesRec(nodes, flowId, id, box.children[i], i);
	}
}
