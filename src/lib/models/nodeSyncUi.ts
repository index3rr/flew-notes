import { get } from 'svelte/store';
import type { Nodes } from './node';
import { _nodesMut } from './store';
import { focusId, selectedFlowId, lastFocusIds } from './focus';
import { selectedBoxIds, selectionAnchorId } from './selection';

export function syncUi(nodes: Nodes) {
	const selected = get(selectedFlowId);
	if (!selected || !nodes[selected]) selectedFlowId.set(nodes.root.children[0] ?? null);
	const focused = get(focusId);
	if (focused && !nodes[focused]) focusId.set(null);
	lastFocusIds.update((ids) =>
		Object.fromEntries(
			Object.entries(ids).filter(([flow, id]) => nodes[flow as keyof Nodes] && nodes[id])
		)
	);
	selectedBoxIds.update((ids) => new Set([...ids].filter((id) => nodes[id])));
	const anchor = get(selectionAnchorId);
	if (anchor && !nodes[anchor]) selectionAnchorId.set(null);
	_nodesMut.set(nodes);
}
