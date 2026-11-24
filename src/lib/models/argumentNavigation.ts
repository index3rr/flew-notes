import { get } from 'svelte/store';
import { focusId, lastFocusIds, selectedFlowId } from './focus';
import { nodes } from './store';
import { folded } from './fold';
import { clearSelection } from './selection';
import type { Box, Flow, Node, BoxId, FlowId, Nodes } from './node';

export function currentArgument(
	tree = get(nodes),
	page = get(selectedFlowId),
	active = get(focusId),
	last = get(lastFocusIds)
): { id: BoxId; node: Node<Box> } | null {
	if (!page) return null;
	for (const id of [active, last[page]]) {
		const node = id ? tree[id] : null;
		if (id && node?.value?.tag === 'box' && node.value.flowId === page)
			return { id: id as BoxId, node: node as Node<Box> };
	}
	return null;
}

export function showArgument(id: BoxId, tree: Nodes = get(nodes)): boolean {
	const node = tree[id];
	if (!node || node.value.tag !== 'box') return false;
	folded.update((values) => {
		let parent: BoxId | FlowId | 'root' = node.parent;
		while (parent !== 'root') {
			values.delete(parent as BoxId);
			const ancestor: Node<Box> | Node<Flow> | undefined = tree[parent];
			if (!ancestor) return values;
			parent = ancestor.parent;
		}
		return values;
	});
	clearSelection();
	selectedFlowId.set(node.value.flowId);
	focusId.set(id);
	return true;
}
