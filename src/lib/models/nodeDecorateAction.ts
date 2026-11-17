import type { DebateStyleFlow } from './debateStyle';
import {
	getNode,
	getParentFlowId,
	newBoxId,
	newFlowId,
	type Box,
	type BoxId,
	type Flow,
	type FlowId,
	type Nodes,
	type RootId,
	type SelfIdFor,
	type SerializedBox
} from './node';
import {
	doActionBundle,
	type Action,
	type ActionBundle,
	type ActionOrBundle,
	type AddAction,
	type MoveAction,
	type UpdateAction
} from './nodeAction';
import { resolvePendingAction } from './nodePendingAction';
import { nodes } from './store';
import { groupReplyTargets } from './selection';
import { collectGroupReplyParents, expandReplyGroup } from './groupReply';
import { trackFlowCreated, trackFlowDeleted, trackBoxCreated } from './telemetry';

let $nodes: Nodes;
nodes.subscribe((nodes) => {
	$nodes = nodes;
});

// TODO deal with addTab button height bug when replacing flow

function decorate<
	Input extends unknown[],
	Ret,
	Output extends { action: ActionOrBundle; owner: FlowId | RootId; ret?: Ret }
>(fn: (nodes: Nodes, ...args: Input) => Output): (...args: Input) => Output['ret'] {
	return function (...args: Input) {
		resolvePendingAction($nodes);
		const output = fn($nodes, ...args);
		doActionBundle(output.action, output.owner);
		return output.ret;
	};
}

export function newBoxAction(
	parent: FlowId | BoxId,
	parentFlowId: FlowId,
	index: number,
	placeholder?: string
): AddAction<Box> {
	const addAction: AddAction<Box> = {
		tag: 'add',
		parent,
		id: newBoxId(),
		index: index,
		value: {
			tag: 'box',
			content: '',
			placeholder: placeholder,
			flowId: parentFlowId
		}
	};

	return addAction;
}

// we need access to an extension's id to create a child, so id is an input
export function newExtensionAction(
	parent: FlowId | BoxId,
	parentFlowId: FlowId,
	selfId: BoxId
): AddAction<Box> {
	const addAction: AddAction<Box> = {
		tag: 'add',
		parent,
		id: selfId,
		index: 0, // Extensions are always at position 0
		value: {
			tag: 'box',
			content: '',
			flowId: parentFlowId,
			isExtension: true
		}
	};

	return addAction;
}

export function buildPasteActions(
	parent: FlowId | BoxId,
	flowId: FlowId,
	boxes: SerializedBox[],
	startIndex = 0
): { actions: ActionBundle; firstId: BoxId | null } {
	const actions: ActionBundle = [];
	let firstId: BoxId | null = null;
	let index = startIndex;
	for (const box of boxes) {
		const id = newBoxId();
		if (firstId == null) firstId = id;
		const value: Box = {
			tag: 'box',
			content: box.value.content,
			flowId
		};
		if (box.value.empty != null) value.empty = box.value.empty;
		if (box.value.crossed != null) value.crossed = box.value.crossed;
		if (box.value.bold != null) value.bold = box.value.bold;
		if (box.value.isExtension != null) value.isExtension = box.value.isExtension;
		if (box.value.placeholder != null) value.placeholder = box.value.placeholder;
		actions.push({ tag: 'add', parent, id, index, value });
		if (box.children.length > 0) {
			const childResult = buildPasteActions(id, flowId, box.children, 0);
			actions.push(...childResult.actions);
		}
		index++;
	}
	return { actions, firstId };
}

export const addNewBox = decorate(function (
	nodes: Nodes,
	parent: FlowId | BoxId,
	index: number,
	placeholder?: string
) {
	const flowId = getParentFlowId(nodes, parent).unwrap();
	const result = {
		action: newBoxAction(parent, flowId, index, placeholder),
		owner: flowId
	};
	trackBoxCreated(getNode(nodes, parent).unwrap().level);
	return result;
});

// Consolidate the selected arguments' branches into one response stack.
export const addGroupReply = decorate(function (nodes: Nodes, targets: BoxId[]) {
	const validTargets = groupReplyTargets(nodes, expandReplyGroup(nodes, targets));
	const owner = nodes[targets[0]]?.value.flowId ?? 'root';
	if (validTargets == null) return { action: [], owner, ret: null };
	const [parentId, ...respondsTo] = validTargets;
	const parent = getNode(nodes, parentId).unwrap();
	const flowId = parent.value.flowId;
	const actions: ActionBundle = [];
	let extensionId = parent.children.find((id) => nodes[id]?.value.isExtension);
	let extensionChildren = extensionId ? nodes[extensionId]?.children.length ?? 0 : 0;
	let index = parent.children.length;
	for (const target of validTargets) {
		for (const childId of nodes[target]?.children ?? []) {
			const child = nodes[childId];
			if (!child) continue;
			if (child.value.respondsTo) {
				const value = { ...child.value };
				delete value.respondsTo;
				actions.push(newUpdateAction(childId, value));
			}
			if (target === parentId) continue;
			if (child.value.isExtension && extensionId) {
				for (const grandchild of child.children) {
					actions.push({
						tag: 'move',
						id: grandchild,
						newParent: extensionId,
						newIndex: extensionChildren++
					});
				}
				actions.push({ tag: 'delete', id: childId });
			} else {
				actions.push({
					tag: 'move',
					id: childId,
					newParent: parentId,
					newIndex: child.value.isExtension ? 0 : index
				});
				index++;
				if (child.value.isExtension) {
					extensionId = childId;
					extensionChildren = child.children.length;
				}
			}
		}
	}
	// Group members occupy adjacent rows, even when an older group is expanded.
	const parentIndex = nodes[parent.parent]?.children.indexOf(parentId) ?? 0;
	respondsTo.forEach((id, offset) => {
		actions.push({ tag: 'move', id, newParent: parent.parent, newIndex: parentIndex + offset + 1 });
	});
	const action = newBoxAction(parentId, flowId, extensionId ? 1 : 0);
	action.value.respondsTo = respondsTo;
	actions.push(action);
	trackBoxCreated(parent.level);
	return { action: actions, owner: flowId, ret: action.id };
});

export const addGroupResponse = decorate(function (nodes: Nodes, sourceId: BoxId) {
	const parentId = collectGroupReplyParents(nodes).get(sourceId);
	const parent = parentId && nodes[parentId];
	const owner = nodes[sourceId]?.value.flowId ?? 'root';
	if (!parentId || !parent) return { action: [], owner, ret: null };
	const action = newBoxAction(parentId, parent.value.flowId, parent.children.length);
	trackBoxCreated(parent.level);
	return { action, owner: parent.value.flowId, ret: action.id };
});

export const addNewExtension = decorate(function (nodes: Nodes, parent: FlowId | BoxId) {
	const flowId = getParentFlowId(nodes, parent).unwrap();
	const extensionId = newBoxId();
	return {
		action: [newExtensionAction(parent, flowId, extensionId), newBoxAction(extensionId, flowId, 0)],
		owner: flowId
	};
});

export const addNewFlow = decorate(function (
	nodes: Nodes,
	index: number,
	style: DebateStyleFlow,
	switchSpeakers = false,
	content?: string
) {
	const starterBoxes = style.starterBoxes;
	let columns;
	if (style.columnsSwitch != null && switchSpeakers) {
		columns = style.columnsSwitch;
	} else {
		columns = style.columns;
	}
	const id = newFlowId();
	const addAction: AddAction<Flow> = {
		tag: 'add',
		parent: 'root',
		id,
		index,
		value: {
			tag: 'flow',
			content: content ?? '',
			invert: style.invert,
			columns
		}
	};
	const actionBundle: Action<Flow | Box>[] = [addAction];
	if (starterBoxes != null) {
		starterBoxes.forEach((placeholder, index) => {
			actionBundle.push(newBoxAction(id, id, index, placeholder));
		});
	} else {
		actionBundle.push(newBoxAction(id, id, 0));
	}
	trackFlowCreated(style.name, nodes.root.children.length + 1);
	return {
		action: actionBundle,
		owner: 'root',
		ret: id
	};
});

export const toggleBoxFormat = decorate(function (
	nodes: Nodes,
	id: BoxId,
	format: 'bold' | 'crossed'
) {
	const box = getNode(nodes, id).unwrap();
	return {
		action: newUpdateAction(id, { ...box.value, [format]: !box.value[format] }),
		owner: getParentFlowId(nodes, id).unwrap()
	};
});

export function newUpdateAction<Value extends Flow | Box>(
	id: SelfIdFor<Value>,
	value: Value
): UpdateAction<Value> {
	const previous = $nodes[id]?.value as Value | undefined;
	return {
		tag: 'update',
		id: id,
		newValue: value,
		fields: [...new Set([...Object.keys(previous ?? {}), ...Object.keys(value)])].filter(
			(field) => {
				return (
					JSON.stringify(previous?.[field as keyof Value]) !==
					JSON.stringify(value[field as keyof Value])
				);
			}
		)
	};
}

export function newDeleteAction(nodes: Nodes, id: BoxId | FlowId): ActionBundle {
	const actionBundle: ActionBundle = [];

	const box = getNode(nodes, id).unwrap();
	if (box == null) return actionBundle;
	const parent = getNode(nodes, box.parent).unwrap();
	if (parent == null) return actionBundle;
	for (const child of box.children.toReversed()) {
		actionBundle.push(...newDeleteAction(nodes, child));
	}
	actionBundle.push({
		tag: 'delete',
		id: id
	});
	return actionBundle;
}
export const deleteBox = decorate(function (nodes: Nodes, id: BoxId) {
	const actionBundle = newDeleteAction(nodes, id);
	return { action: actionBundle, owner: getParentFlowId(nodes, id).unwrap() };
});

export const deleteFlow = decorate(function (nodes: Nodes, id: FlowId) {
	const actionBundle = newDeleteAction(nodes, id);
	trackFlowDeleted(nodes.root.children.length - 1);
	return { action: actionBundle, owner: 'root' };
});

export const moveFlow = decorate(function (nodes: Nodes, id: FlowId, newIndex: number) {
	const moveAction: MoveAction<Flow> = {
		tag: 'move',
		id: id,
		newIndex: newIndex
	};
	return { action: moveAction, owner: 'root' };
});

export const addNewEmpty = decorate(function (nodes: Nodes, flowId: FlowId, level: number) {
	const actions = [];
	let parentId: BoxId | FlowId = flowId;
	for (let i = 0; i < level; i++) {
		const newId = newBoxId();
		const addAction: AddAction<Box> = {
			tag: 'add',
			parent: parentId,
			id: newId,
			index: 0,
			value: {
				tag: 'box',
				content: '',
				flowId,
				empty: true
			}
		};
		actions.push(addAction);
		parentId = newId;
	}
	const finalBoxAction = newBoxAction(parentId, flowId, 0);
	actions.push(finalBoxAction);
	return {
		action: actions,
		ret: finalBoxAction.id,
		owner: flowId
	};
});

export const replaceNodes = decorate(function (nodes: Nodes, newNodes: Nodes) {
	return {
		action: {
			tag: 'replace',
			newNodes: structuredClone(newNodes)
		},
		owner: 'root'
	};
});
