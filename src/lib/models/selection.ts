import { writable, get, type Writable } from 'svelte/store';
import type { BoxId, FlowId, Nodes } from './node';
import { getParentFlowId } from './node';
import { focusId } from './focus';

export const selectionAnchorId: Writable<BoxId | null> = writable(null);
export const selectedBoxIds: Writable<Set<BoxId>> = writable(new Set());

function collectAllBoxesInFlow(nodes: Nodes, flowId: FlowId): BoxId[] {
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

export function collectBoxRange(nodes: Nodes, from: BoxId, to: BoxId): BoxId[] {
	if (from === to) return [from];

	const fromFlow = getParentFlowId(nodes, from).unwrap();
	const toFlow = getParentFlowId(nodes, to).unwrap();
	if (fromFlow !== toFlow) return [];

	const allBoxes = collectAllBoxesInFlow(nodes, fromFlow);
	const fromIdx = allBoxes.indexOf(from);
	const toIdx = allBoxes.indexOf(to);
	if (fromIdx === -1 || toIdx === -1) return [];

	const start = Math.min(fromIdx, toIdx);
	const end = Math.max(fromIdx, toIdx);
	return allBoxes.slice(start, end + 1);
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
