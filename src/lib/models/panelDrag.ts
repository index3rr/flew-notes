import {
	setEvidenceTransfer,
	readEvidenceTransfer,
	evidenceMime
} from '../integrations/cardmirror/clipboard';
import { readSpeechDropFile, type SpeechDropFile } from './speechDropFile';
import { get } from 'svelte/store';
import { nodes, frozen } from './store';
import { selectedBoxIds, collectAllBoxesInFlow } from './selection';
import {
	validSerializedBoxes,
	serializeBoxSubtree,
	type BoxId,
	type Nodes,
	type SerializedBox
} from './node';
import { buildPasteActions, newDeleteAction } from './nodeDecorateAction';
import { resolvePendingAction } from './nodePendingAction';
import { doActionBundle, applyAction } from './nodeAction';
import { showArgument } from './argumentNavigation';
import { loadNodes } from './file';

export const boxesMime = 'application/x-flew-boxes';
export const pagesMime = 'application/x-flew-page';
export const fileMime = 'application/x-flew-speechdrop';
export function selectionRoots(tree: Nodes, ids: Iterable<BoxId>): BoxId[] {
	const selected = new Set(ids);
	return tree.root.children
		.flatMap((flow) => collectAllBoxesInFlow(tree, flow))
		.filter((id) => {
			if (!selected.has(id)) return false;
			let parent: BoxId | import('./node').FlowId | 'root' | null | undefined = tree[id]?.parent;
			while (parent && parent !== 'root') {
				if (selected.has(parent as BoxId)) return false;
				parent = tree[parent]?.parent;
			}
			return true;
		});
}
export function boxDropPosition(event: DragEvent): 'before' | 'after' | 'inside' {
	const element = event.currentTarget;
	if (!(element instanceof HTMLElement) || (!event.clientX && !event.clientY)) return 'inside';
	const bounds = element.getBoundingClientRect();
	const edge = bounds.height / 4;
	return event.clientY < bounds.top + edge
		? 'before'
		: event.clientY > bounds.bottom - edge
		? 'after'
		: 'inside';
}

export function startBoxDrag(event: DragEvent, id: BoxId) {
	const tree = get(nodes),
		selected = get(selectedBoxIds);
	const ids = selectionRoots(tree, selected.has(id) ? selected : [id]);
	event.dataTransfer?.setData(
		boxesMime,
		JSON.stringify({ ids, boxes: ids.map((key) => serializeBoxSubtree(tree, key)) })
	);
	event.dataTransfer?.setData('text/plain', ids.map((key) => tree[key]!.value.content).join('\n'));
	if (event.dataTransfer) {
		setEvidenceTransfer(
			event.dataTransfer,
			ids.map((key) => serializeBoxSubtree(tree, key))
		);
		event.dataTransfer.effectAllowed = 'copyMove';
		// Native drag images only include the initiating element. Preserve the grid's
		// actual row/column positions for the entire selected group.
		const cells = [...document.querySelectorAll<HTMLElement>('[data-box-id]')].filter(
			(cell) =>
				(selected.has(id)
					? selected.has(cell.dataset.boxId as BoxId)
					: cell.dataset.boxId === id) && cell.getBoundingClientRect().height
		);
		if (cells.length) {
			const rects = cells.map((cell) => cell.getBoundingClientRect());
			const left = Math.min(...rects.map((r) => r.left)),
				top = Math.min(...rects.map((r) => r.top));
			const preview = document.createElement('div');
			preview.dataset.selectionDragPreview = '';
			Object.assign(preview.style, {
				position: 'fixed',
				left: '0',
				top: '0',
				pointerEvents: 'none',
				zIndex: '-1',
				width: Math.max(...rects.map((r) => r.right)) - left + 'px',
				height: Math.max(...rects.map((r) => r.bottom)) - top + 'px'
			});
			cells.forEach((cell, index) => {
				const clone = cell.cloneNode(true) as HTMLElement,
					rect = rects[index],
					style = getComputedStyle(cell);
				clone.dataset.dragBoxId = clone.dataset.boxId;
				clone.removeAttribute('data-box-id');
				clone.removeAttribute('draggable');
				clone
					.querySelectorAll('[data-box-id]')
					.forEach((element) => element.removeAttribute('data-box-id'));

				Object.assign(clone.style, {
					position: 'absolute',
					left: rect.left - left + 'px',
					top: rect.top - top + 'px',
					width: rect.width + 'px',
					height: rect.height + 'px',
					background: style.backgroundColor,
					color: style.color
				});
				// Palette variables normally come from each cell's parent.
				for (let i = 0; i < style.length; i++) {
					const property = style[i];
					if (property.startsWith('--'))
						clone.style.setProperty(property, style.getPropertyValue(property));
				}
				cell.querySelectorAll('textarea').forEach((text, i) => {
					clone.querySelectorAll('textarea')[i].value = text.value;
				});
				preview.append(clone);
			});
			document.body.append(preview);
			event.dataTransfer.setDragImage(
				preview,
				Math.max(0, event.clientX - left),
				Math.max(0, event.clientY - top)
			);
			setTimeout(() => preview.remove(), 0);
		}
	}
	event.stopPropagation();
}
export function readPageDrag(raw: string) {
	const data = JSON.parse(raw);
	const source = loadNodes({ version: 1, nodes: data.nodes }, false);
	const ids = data.ids ?? [data.id];
	if (!Array.isArray(ids) || !ids.length || !ids.every((id) => source.root.children.includes(id)))
		throw new Error('Invalid pages');
	return { source, ids: ids as import('./node').FlowId[] };
}
export function canDropBoxes(event: DragEvent) {
	return (
		!!event.dataTransfer &&
		[boxesMime, pagesMime, evidenceMime, 'text/html'].some((type) =>
			event.dataTransfer!.types.includes(type)
		)
	);
}
export function dropOnBox(event: DragEvent, target: BoxId) {
	if (!canDropBoxes(event) || get(frozen)) return;
	event.preventDefault();
	event.stopPropagation();
	resolvePendingAction(get(nodes));
	const tree = structuredClone(get(nodes)),
		node = tree[target];
	if (!node) return;
	let boxes: SerializedBox[];
	let moving: BoxId[] = [];
	try {
		const transfer = event.dataTransfer!;
		const rawPage = transfer.getData(pagesMime);
		const rawBoxes = transfer.getData(boxesMime);
		if (rawPage) {
			const { source, ids } = readPageDrag(rawPage);
			boxes = ids.flatMap((id) =>
				source[id]!.children.map((child) => serializeBoxSubtree(source, child))
			);
		} else if (rawBoxes) {
			const data = JSON.parse(rawBoxes);
			const ids = data.ids ?? [];
			if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) return;
			boxes = data.boxes;
			moving = event.ctrlKey || event.metaKey ? [] : selectionRoots(tree, ids as BoxId[]);
		} else {
			boxes = readEvidenceTransfer(transfer);
		}
	} catch {
		// Transfer data can come from another app or a different Flew build.
		return;
	}
	if (!validSerializedBoxes(boxes)) return;
	// Never move a branch into itself or remove a target through one of its ancestors.
	let ancestor: string | undefined = target;
	while (ancestor && ancestor !== 'root') {
		if (moving.includes(ancestor as BoxId)) return;
		ancestor = tree[ancestor as BoxId]?.parent;
	}
	const position = boxDropPosition(event);
	const replace =
		position === 'inside' &&
		!node.value.content.trim() &&
		!node.value.isExtension &&
		!node.children.length;
	const flow = tree[node.value.flowId]!;
	const depth = (box: SerializedBox): number => 1 + Math.max(0, ...box.children.map(depth));
	if (
		(replace || position !== 'inside' ? node.level - 1 : node.level) +
			Math.max(0, ...boxes.map(depth)) >
		flow.value.columns.length
	)
		return;
	const parent = replace || position !== 'inside' ? node.parent : target;
	const index =
		position !== 'inside'
			? tree[node.parent]!.children.indexOf(target) + (position === 'after' ? 1 : 0)
			: replace
			? tree[node.parent]!.children.indexOf(target)
			: node.children[0] && tree[node.children[0]]?.value.isExtension
			? 1
			: 0;
	const moveActions: import('./nodeAction').ActionBundle = [];
	if (moving.length) {
		const projection = structuredClone(tree);
		let anchor: BoxId | null = position === 'after' ? target : null;
		const before =
			position === 'before'
				? target
				: position === 'inside' && !replace
				? projection[parent]!.children.find(
						(child) => !moving.includes(child) && !projection[child]?.value.isExtension
				  )
				: null;
		if (
			position === 'inside' &&
			!replace &&
			projection[parent]!.children[0] &&
			projection[projection[parent]!.children[0]]?.value.isExtension
		)
			anchor = projection[parent]!.children[0];
		for (const id of moving) {
			const siblings = projection[parent]!.children;
			let next = anchor
				? siblings.indexOf(anchor) + 1
				: before
				? siblings.indexOf(before)
				: replace
				? siblings.indexOf(target)
				: siblings.length;
			const old = projection[id]!;
			if (old.parent === parent && siblings.indexOf(id) < next) next--;
			const action: import('./nodeAction').ActionBundle[number] = {
				tag: 'move',
				id,
				newParent: parent,
				newIndex: Math.max(0, next)
			};
			moveActions.push(action);
			applyAction(projection, action);
			anchor = id;
		}
	}
	const result = moving.length
		? { firstId: moving[0], actions: moveActions }
		: buildPasteActions(parent, node.value.flowId, boxes, index);

	const actions: import('./nodeAction').ActionBundle = [
		...(replace ? newDeleteAction(tree, target) : []),
		...result.actions
	];
	const projected = new Map<
		BoxId,
		{ flowId: import('./node').FlowId; level: number; parent: import('./node').FlowId | BoxId }
	>();
	for (const root of moving) {
		if (replace) {
			let ancestor = tree[root]?.parent;
			while (ancestor && ancestor !== 'root') {
				if (ancestor === target) return;
				ancestor = tree[ancestor]?.parent as typeof ancestor;
			}
		}
		const delta = tree[parent]!.level + 1 - tree[root]!.level;
		const visit = (id: BoxId) => {
			const box = tree[id];
			if (!box) return;
			projected.set(id, {
				flowId: node.value.flowId,
				level: box.level + delta,
				parent: id === root ? parent : box.parent
			});
			box.children.forEach(visit);
		};
		visit(root);
	}
	for (const [id, box] of Object.entries(tree)) {
		if (box?.value.tag !== 'box' || !box.value.respondsTo) continue;
		const next = projected.get(id as BoxId) ?? {
			flowId: box.value.flowId,
			level: box.level,
			parent: box.parent
		};
		const links = box.value.respondsTo.filter((target) => {
			const original = tree[target];
			if (!original) return true;
			const moved = projected.get(target) ?? {
				flowId: original.value.flowId,
				level: original.level
			};
			return (
				moved.flowId === next.flowId && moved.level === next.level - 1 && target !== next.parent
			);
		});
		if (links.length === box.value.respondsTo.length) continue;
		const value = { ...box.value };
		if (links.length) value.respondsTo = links;
		else delete value.respondsTo;
		actions.push({ tag: 'update', id: id as BoxId, newValue: value, fields: ['respondsTo'] });
	}

	doActionBundle(
		actions,
		moving.some((id) => tree[id]?.value.flowId !== node.value.flowId) ? 'root' : node.value.flowId
	);
	if (result.firstId) showArgument(result.firstId);
}
export async function droppedDocument(
	event: DragEvent,
	signal?: AbortSignal
): Promise<{ name: string; blob: Blob; source?: SpeechDropFile } | null> {
	const file = event.dataTransfer?.files[0];
	if (file) {
		if (file.size > 50 * 1024 * 1024) throw new Error('This document exceeds the 50 MB limit.');
		return { name: file.name, blob: file };
	}
	const raw = event.dataTransfer?.getData(fileMime);
	if (!raw) return null;
	const data = JSON.parse(raw);
	if (
		!data ||
		typeof data.room !== 'string' ||
		!/^[A-Za-z0-9_-]{1,64}$/.test(data.room) ||
		!Number.isSafeInteger(data.index) ||
		data.index < 0 ||
		typeof data.name !== 'string' ||
		(data.ctime !== undefined && typeof data.ctime !== 'number')
	)
		throw new Error('Invalid SpeechDrop file');
	return { name: data.name, blob: await readSpeechDropFile(data, signal), source: data };
}
export async function documentText(name: string, blob: Blob) {
	if (/\.txt$/i.test(name)) return blob.text();
	if (!/\.docx$/i.test(name)) throw new Error('Choose a DOCX or TXT document.');
	const { extractRawText } = await import('mammoth/mammoth.browser');
	return (await extractRawText({ arrayBuffer: await blob.arrayBuffer() })).value;
}
