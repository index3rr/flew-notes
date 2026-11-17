import { derived } from 'svelte/store';
import type { BoxId, Nodes } from './node';
import { nodes } from './store';

export function collectGroupReplyParents(nodes: Nodes): Map<BoxId, BoxId> {
	const parents = new Map<BoxId, BoxId>();
	for (const reply of Object.values(nodes)) {
		if (reply?.value.tag !== 'box' || !reply.value.respondsTo?.length) continue;
		const parentId = reply.parent as BoxId;
		const parent = nodes[parentId];
		if (!parent || parent.value.empty || parent.value.isExtension) continue;
		const targets = reply.value.respondsTo.filter((id) => {
			const target = nodes[id];
			return (
				target?.value.tag === 'box' &&
				target.value.flowId === parent.value.flowId &&
				target.level === parent.level &&
				!target.value.empty &&
				!target.value.isExtension
			);
		});
		if (!targets.length) continue;
		for (const id of [parentId, ...targets]) parents.set(id, parentId);
	}
	return parents;
}

export const groupReplyParents = derived(nodes, collectGroupReplyParents);

export function expandReplyGroup(nodes: Nodes, targets: BoxId[]): BoxId[] {
	const selected = new Set(targets);
	const first = nodes[targets[0]];
	if (!first) return targets;
	let changed = true;
	while (changed) {
		changed = false;
		for (const reply of Object.values(nodes)) {
			if (reply?.value.tag !== 'box' || !reply.value.respondsTo?.length) continue;
			const members = [reply.parent as BoxId, ...reply.value.respondsTo].filter((id) => {
				const node = nodes[id];
				return (
					node?.value.flowId === first.value.flowId &&
					node.level === first.level &&
					!node.value.empty &&
					!node.value.isExtension
				);
			});
			if (!members.some((id) => selected.has(id))) continue;
			for (const id of members) {
				if (!selected.has(id)) {
					selected.add(id);
					changed = true;
				}
			}
		}
	}
	return [...selected];
}

export const groupReplyMembers = derived([nodes, groupReplyParents], ([nodes, parents]) => {
	const groups = new Map<BoxId, BoxId[]>();
	for (const [id, parent] of parents) groups.set(parent, [...(groups.get(parent) ?? []), id]);
	for (const [parent, members] of groups) {
		const owner = nodes[parent]?.parent;
		const siblings = owner ? nodes[owner]?.children ?? [] : [];
		members.sort((a, b) => siblings.indexOf(a) - siblings.indexOf(b));
	}
	return groups;
});
