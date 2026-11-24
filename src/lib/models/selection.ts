import { writable, get, type Writable } from 'svelte/store';
import type { BoxId, FlowId, Nodes } from './node';
import { focusId } from './focus';

export const selectionAnchorId: Writable<BoxId | null> = writable(null);
export const selectedBoxIds: Writable<Set<BoxId>> = writable(new Set());

export function collectAllBoxesInFlow(nodes: Nodes, flowId: FlowId): BoxId[] {
	const result: BoxId[] = [];
	const flow = nodes[flowId];
	if (!flow || flow.value.tag !== 'flow') return result;
	const dfs = (id: BoxId) => {
		result.push(id);
		const node = nodes[id];
		if (node && node.value.tag === 'box') {
			for (const childId of node.children as BoxId[]) {
				dfs(childId);
			}
		}
	};
	for (const childId of flow.children as BoxId[]) {
		dfs(childId);
	}
	return result;
}

export interface CellBounds {
	top: number;
	bottom: number;
}

// A range is a rectangle in the flow grid, not a slice of the tree traversal.
// Bounds come from rendered cells so wrapped text and sibling response groups line up.
export function collectBoxRange(
	nodes: Nodes,
	from: BoxId,
	to: BoxId,
	bounds?: ReadonlyMap<BoxId, CellBounds>
): BoxId[] {
	const first = nodes[from],
		last = nodes[to];
	if (!first || !last || first.value.flowId !== last.value.flowId) return [];
	const all = collectAllBoxesInFlow(nodes, first.value.flowId);
	const minLevel = Math.min(first.level, last.level);
	const maxLevel = Math.max(first.level, last.level);
	const start = bounds?.get(from),
		end = bounds?.get(to);
	if (start && end) {
		const top = Math.min(start.top, end.top),
			bottom = Math.max(start.bottom, end.bottom);
		return all.filter((id) => {
			const node = nodes[id]!,
				rect = bounds!.get(id);
			return (
				node.level >= minLevel &&
				node.level <= maxLevel &&
				!!rect &&
				rect.bottom > top + 0.5 &&
				rect.top < bottom - 0.5
			);
		});
	}
	const fromIndex = all.indexOf(from),
		toIndex = all.indexOf(to);
	return all
		.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1)
		.filter((id) => nodes[id]!.level >= minLevel && nodes[id]!.level <= maxLevel);
}

// Selected cells one response can answer together: the cells in the top-most selected cell's
// column, in order. Returns null unless there are at least two and the next column exists.
export function groupReplyTargets(nodes: Nodes, ids: Iterable<BoxId>): BoxId[] | null {
	const selected = new Set(ids);
	const first = [...selected][0];
	if (first == null) return null;
	const flowId = nodes[first]?.value.flowId;
	if (flowId == null) return null;
	const flow = nodes[flowId];
	if (!flow || flow.value.tag !== 'flow') return null;
	const ordered = collectAllBoxesInFlow(nodes, flowId).filter((id) => selected.has(id));
	const levels = ordered.map((id) => nodes[id]!.level);
	const level = levels.length ? Math.min(...levels) : null;
	if (level == null || level >= flow.value.columns.length) return null;
	const targets = ordered.filter((id) => {
		const node = nodes[id];
		return node?.level === level && !node.value.empty && !node.value.isExtension;
	});
	return targets.length >= 2 ? targets : null;
}

export function clearSelection() {
	selectedBoxIds.set(new Set());
	selectionAnchorId.set(null);
}

let shiftHeld = false;
let anchorCaptureId: BoxId | null = null;

if (typeof window !== 'undefined') {
	window.addEventListener('keydown', (e) => {
		if (e.key === 'Shift' && !shiftHeld) {
			shiftHeld = true;
			anchorCaptureId = get(focusId) as BoxId | null;
		}
	});
	window.addEventListener('blur', () => {
		shiftHeld = false;
		anchorCaptureId = null;
	});
	window.addEventListener('keyup', (e) => {
		if (e.key === 'Shift') shiftHeld = false;
	});
}

export function isShiftHeld(): boolean {
	return shiftHeld;
}

export function consumeAnchorCapture(): BoxId | null {
	const v = anchorCaptureId;
	anchorCaptureId = null;
	return v;
}
