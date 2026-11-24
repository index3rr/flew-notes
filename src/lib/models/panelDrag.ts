import { get } from 'svelte/store';
import { nodes, frozen } from './store';
import { selectedBoxIds, collectAllBoxesInFlow } from './selection';
import { serializeBoxSubtree, type BoxId, type Nodes, type SerializedBox } from './node';
import { buildPasteActions, newDeleteAction } from './nodeDecorateAction';
import { resolvePendingAction } from './nodePendingAction';
import { doActionBundle } from './nodeAction';
import { showArgument } from './argumentNavigation';
import { loadNodes } from './file';

export const boxesMime = 'application/x-flew-boxes';
export const pagesMime = 'application/x-flew-page';
export const fileMime = 'application/x-flew-speechdrop';
export function selectionRoots(tree: Nodes, ids: Iterable<BoxId>): BoxId[] {
	const selected = new Set(ids);
	const ordered = tree.root.children.flatMap((flow) => collectAllBoxesInFlow(tree, flow));
	return ordered
		.filter((id) => selected.has(id))
		.filter((id) => {
			let parent: string | undefined = tree[id]?.parent;
			while (parent && parent !== 'root') {
				if (selected.has(parent as BoxId)) return false;
				parent = tree[parent as BoxId]?.parent;
			}
			return !!tree[id];
		});
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
		[boxesMime, pagesMime].some((type) => event.dataTransfer!.types.includes(type))
	);
}
export function dropOnBox(event: DragEvent, target: BoxId) {
	if (!canDropBoxes(event) || get(frozen)) return;
	event.preventDefault();
	event.stopPropagation();
	resolvePendingAction(get(nodes));
	const tree = get(nodes),
		node = tree[target];
	if (!node) return;
	let boxes: SerializedBox[];
	let moving: BoxId[] = [];
	const raw = event.dataTransfer!.getData(pagesMime);
	if (raw) {
		const { source, ids } = readPageDrag(raw);
		boxes = ids.flatMap((id) =>
			source[id]!.children.map((child) => serializeBoxSubtree(source, child))
		);
	} else {
		const data = JSON.parse(event.dataTransfer!.getData(boxesMime));
		boxes = data.boxes;
		moving = event.ctrlKey || event.metaKey ? [] : selectionRoots(tree, data.ids ?? []);
	}
	let count = 0;
	const valid = (box: SerializedBox, depth = 0): boolean => {
		if (
			++count > 10000 ||
			depth > 64 ||
			!box ||
			typeof box !== 'object' ||
			!box.value ||
			typeof box.value.content !== 'string' ||
			!Array.isArray(box.children)
		)
			return false;
		for (const field of [
			'empty',
			'crossed',
			'bold',
			'isExtension',
			'starred',
			'cardMirrorSpacer'
		] as const)
			if (box.value[field] != null && typeof box.value[field] !== 'boolean') return false;
		for (const field of ['placeholder', 'starNote'] as const)
			if (box.value[field] != null && typeof box.value[field] !== 'string') return false;
		return box.children.every((child) => valid(child, depth + 1));
	};
	if (!Array.isArray(boxes) || !boxes.length || !boxes.every((box) => valid(box))) return;
	// Never move a branch into itself or remove a target through one of its ancestors.
	let ancestor: string | undefined = target;
	while (ancestor && ancestor !== 'root') {
		if (moving.includes(ancestor as BoxId)) return;
		ancestor = tree[ancestor as BoxId]?.parent;
	}
	const replace = !node.value.content.trim() && !node.value.isExtension;
	const flow = tree[node.value.flowId]!;
	const depth = (box: SerializedBox): number => 1 + Math.max(0, ...box.children.map(depth));
	if (
		(replace ? node.level - 1 : node.level) + Math.max(0, ...boxes.map(depth)) >
		flow.value.columns.length
	)
		return;
	const parent = replace ? node.parent : target;
	const index = replace
		? tree[node.parent]!.children.indexOf(target)
		: node.children[0] && tree[node.children[0]]?.value.isExtension
		? 1
		: 0;
	const result = moving.length
		? {
				firstId: moving[0],
				actions: moving.map((id, offset) => ({
					tag: 'move' as const,
					id,
					newParent: parent,
					newIndex: index + offset
				}))
		  }
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
	event: DragEvent
): Promise<{ name: string; blob: Blob } | null> {
	const file = event.dataTransfer?.files[0];
	if (file) return { name: file.name, blob: file };
	const raw = event.dataTransfer?.getData(fileMime);
	if (!raw) return null;
	const data = JSON.parse(raw);
	if (!/^[A-Za-z0-9_-]{1,64}$/.test(data.room) || !Number.isSafeInteger(data.index))
		throw new Error('Invalid SpeechDrop file');
	const response = await fetch(`/api/speechdrop/${encodeURIComponent(data.room)}/${data.index}`);
	if (!response.ok) throw new Error('Could not load speech document.');
	return { name: data.name, blob: await response.blob() };
}
export async function documentText(name: string, blob: Blob) {
	if (/\.txt$/i.test(name)) return blob.text();
	if (!/\.docx$/i.test(name)) throw new Error('Choose a DOCX or TXT document.');
	const { extractRawText } = await import('mammoth/mammoth.browser');
	return (await extractRawText({ arrayBuffer: await blob.arrayBuffer() })).value;
}
