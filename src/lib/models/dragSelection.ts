import { get } from 'svelte/store';
import { nodes } from './store';
import { settings } from './settings';
import { focusId, selectedFlowId } from './focus';
import { checkIdBox, type BoxId, type FlowId } from './node';
import {
	clearSelection,
	collectBoxRange,
	consumeAnchorCapture,
	selectedBoxIds,
	selectionAnchorId
} from './selection';

let selectingWithPointer = false;
let pointerSelectionHeld = false;
let selectionFlow: FlowId | null = null;
selectedFlowId.subscribe((id) => {
	if (id !== selectionFlow) {
		selectionFlow = id;
		pointerSelectionHeld = false;
		clearSelection();
	}
});
export function releasePointerSelection() {
	pointerSelectionHeld = false;
}
export function isSelectingWithPointer() {
	return selectingWithPointer || pointerSelectionHeld;
}

export function renderedBoxRange(from: BoxId, to: BoxId): BoxId[] {
	const bounds = new Map<BoxId, DOMRect>();
	for (const cell of document.querySelectorAll<HTMLElement>('[data-box-id]')) {
		if (cell.closest('.children.isFolded')) continue;
		const rect = cell.getBoundingClientRect();
		if (rect.width && rect.height) bounds.set(cell.dataset.boxId as BoxId, rect);
	}
	return collectBoxRange(get(nodes), from, to, bounds);
}

export function dragSelect(container: HTMLElement, flowId: FlowId) {
	let gesture: {
		pointerId: number;
		origin: BoxId;
		anchor: BoxId;
		active: boolean;
		x: number;
		y: number;
		startX: number;
		startY: number;
		textarea: HTMLTextAreaElement | null;
	} | null = null;
	let frame = 0;
	let lastTime = 0;
	let suppressClick = false;
	const horizontal = container.closest<HTMLElement>('.flow');

	function cellAt(target: Element | null): BoxId | null {
		const cell = target?.closest<HTMLElement>('[data-box-id]');
		if (!cell || !container.contains(cell)) return null;
		const id = checkIdBox(get(nodes), cell.dataset.boxId as BoxId);
		return id && get(nodes)[id]?.value.flowId === flowId ? id : null;
	}

	function collapseTextSelection() {
		const text = gesture?.textarea;
		if (text) text.setSelectionRange(text.selectionEnd, text.selectionEnd);
		window.getSelection()?.removeAllRanges();
	}

	function updateSelection() {
		if (!gesture) return;
		const rect = container.getBoundingClientRect();
		const view = horizontal?.getBoundingClientRect() ?? rect;
		const left = Math.max(0, rect.left, view.left);
		const right = Math.min(innerWidth, rect.right, view.right);
		const headers = container.parentElement?.querySelector('.headers')?.getBoundingClientRect();
		const top = Math.max(0, rect.top, headers?.bottom ?? rect.top);
		const bottom = Math.min(innerHeight, rect.bottom);
		if (right <= left || bottom <= top) return;
		const x = gesture.active ? Math.max(left + 1, Math.min(right - 1, gesture.x)) : gesture.x;
		const y = gesture.active ? Math.max(top + 1, Math.min(bottom - 1, gesture.y)) : gesture.y;
		let id = cellAt(document.elementFromPoint(x, y));
		if (!id && gesture.active) {
			// Track the nearest visible cell through gaps and beyond the scroll area's edges.
			let closest: HTMLElement | null = null;
			let distance = Infinity;
			let sameColumn = false;
			for (const cell of container.querySelectorAll<HTMLElement>('[data-box-id]')) {
				if (cell.closest('.children.isFolded')) continue;
				const bounds = cell.getBoundingClientRect();
				if (
					!bounds.height ||
					bounds.bottom <= top ||
					bounds.top >= bottom ||
					bounds.right <= left ||
					bounds.left >= right
				)
					continue;
				const dx = Math.max(bounds.left - x, 0, x - bounds.right);
				const dy = Math.max(bounds.top - y, 0, y - bounds.bottom);
				const nextDistance = Math.hypot(dx, dy);
				if ((!dx && !sameColumn) || (!dx === sameColumn && nextDistance < distance)) {
					closest = cell;
					distance = nextDistance;
					sameColumn = !dx;
				}
			}
			id = cellAt(closest);
		}
		if (!id || (!gesture.active && id === gesture.origin)) return;
		const current = get(nodes);
		if (!current[gesture.anchor]) {
			clearSelection();
			finish();
			return;
		}
		if (!gesture.active) {
			const threshold =
				parseFloat(getComputedStyle(container).getPropertyValue('--button-size')) / 4;
			if (Math.hypot(gesture.x - gesture.startX, gesture.y - gesture.startY) < threshold) return;
			gesture.active = true;
			selectingWithPointer = true;
			pointerSelectionHeld = true;
			consumeAnchorCapture();
			container.setPointerCapture(gesture.pointerId);
		}
		selectionAnchorId.set(gesture.anchor);
		selectedBoxIds.set(new Set(renderedBoxRange(gesture.anchor, id)));
		collapseTextSelection();
	}

	function scroll(time: number) {
		frame = 0;
		if (!gesture?.active) return;
		const rect = container.getBoundingClientRect();
		const view = horizontal?.getBoundingClientRect() ?? rect;
		const style = getComputedStyle(container);
		const unit = parseFloat(style.getPropertyValue('--button-size'));
		const padding = parseFloat(style.getPropertyValue('--padding'));
		const edge = unit + padding * 2;
		const elapsed = lastTime ? Math.min(time - lastTime, 32) / (1000 / 60) : 1;
		lastTime = time;
		const speed = (position: number, start: number, end: number) => {
			const margin = Math.min(edge, (end - start) / 4);
			if (position < start + margin) return -Math.min(1, (start + margin - position) / margin);
			if (position > end - margin) return Math.min(1, (position - end + margin) / margin);
			return 0;
		};
		container.scrollTop += speed(gesture.y, rect.top, rect.bottom) * unit * elapsed;
		if (horizontal) {
			horizontal.scrollLeft += speed(gesture.x, view.left, view.right) * unit * elapsed;
		}
		updateSelection();
		if (gesture?.active) frame = requestAnimationFrame(scroll);
	}

	function move(event: PointerEvent) {
		if (!gesture || event.pointerId !== gesture.pointerId) return;
		if (!(event.buttons & 1)) {
			finish();
			return;
		}
		gesture.x = event.clientX;
		gesture.y = event.clientY;
		updateSelection();
		if (gesture?.active) {
			event.preventDefault();
			if (!frame) frame = requestAnimationFrame(scroll);
		}
	}

	function finish() {
		if (!gesture) return;
		const { pointerId, active } = gesture;
		if (active) collapseTextSelection();
		gesture = null;
		selectingWithPointer = false;
		suppressClick = active;
		cancelAnimationFrame(frame);
		frame = 0;
		lastTime = 0;
		if (container.hasPointerCapture(pointerId)) container.releasePointerCapture(pointerId);
		window.removeEventListener('pointermove', move, true);
		window.removeEventListener('pointerup', end, true);
		window.removeEventListener('pointercancel', end, true);
		window.removeEventListener('blur', finish);
		window.removeEventListener('keydown', keydown, true);
	}

	function end(event: PointerEvent) {
		if (event.pointerId !== gesture?.pointerId) return;
		if (gesture.active) event.preventDefault();
		finish();
	}

	function start(event: PointerEvent) {
		if (event.button !== 0 || event.pointerType === 'touch' || event.altKey) return;
		const target = event.target as Element;
		if (target.closest('button, a, [role="separator"]')) return;
		finish();
		suppressClick = false;
		const origin = cellAt(target);
		if (origin && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			const selected = new Set(get(selectedBoxIds));
			if (selected.has(origin)) selected.delete(origin);
			else selected.add(origin);
			pointerSelectionHeld = true;
			selectionAnchorId.set(origin);
			selectedBoxIds.set(selected);
			target.closest('[data-box-id]')?.querySelector('textarea')?.focus({ preventScroll: true });
			suppressClick = true;
			return;
		}
		if (!event.shiftKey && (!origin || !get(selectedBoxIds).has(origin))) clearSelection();
		if (origin && get(selectedBoxIds).has(origin) && !event.shiftKey) {
			pointerSelectionHeld = true;
			return;
		}
		if (!origin) return;
		pointerSelectionHeld = false;
		const focused = get(focusId);
		const anchor = event.shiftKey
			? get(selectionAnchorId) ?? (focused ? checkIdBox(get(nodes), focused) : null) ?? origin
			: origin;
		if (event.shiftKey) {
			selectionAnchorId.set(anchor);
			selectedBoxIds.set(new Set(renderedBoxRange(anchor, origin)));
		}
		gesture = {
			pointerId: event.pointerId,
			origin,
			anchor,
			active: false,
			x: event.clientX,
			y: event.clientY,
			startX: event.clientX,
			startY: event.clientY,
			textarea: target.closest('[data-box-id]')?.querySelector('textarea') ?? null
		};
		if (gesture.textarea && target !== gesture.textarea) {
			event.preventDefault();
			gesture.textarea.focus({ preventScroll: true });
		}
		window.addEventListener('pointermove', move, { capture: true, passive: false });
		window.addEventListener('pointerup', end, true);
		window.addEventListener('pointercancel', end, true);
		window.addEventListener('blur', finish);
		window.addEventListener('keydown', keydown, true);
	}

	function keydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !gesture?.active) return;
		clearSelection();
		finish();
		event.preventDefault();
		event.stopPropagation();
	}

	function lostCapture(event: PointerEvent) {
		if (event.target === container && event.pointerId === gesture?.pointerId) finish();
	}

	function click(event: MouseEvent) {
		if (!suppressClick) {
			const id = cellAt(event.target as Element);
			if (!event.shiftKey && id && get(selectedBoxIds).has(id)) {
				pointerSelectionHeld = false;
				clearSelection();
			}
			return;
		}
		suppressClick = false;
		event.preventDefault();
		event.stopPropagation();
	}

	let cornersFrame = 0;
	const observedCells = new Set<HTMLElement>();
	function updateCorners() {
		cornersFrame = 0;
		const selected = get(selectedBoxIds);
		const cells = [...container.querySelectorAll<HTMLElement>('[data-box-id]')].filter(
			(cell) => selected.has(cell.dataset.boxId as BoxId) && cell.getBoundingClientRect().height
		);
		for (const cell of observedCells)
			if (!cells.includes(cell)) {
				resize.unobserve(cell);
				observedCells.delete(cell);
			}
		for (const cell of cells)
			if (!observedCells.has(cell)) {
				resize.observe(cell);
				observedCells.add(cell);
			}
		const rects = cells.map((cell) => cell.getBoundingClientRect());
		cells.forEach((cell, index) => {
			const rect = rects[index];
			// Only square a corner where another selected surface actually meets it.
			const covered = (x: number, y: number) =>
				rects.some(
					(other, i) =>
						i !== index &&
						(Math.min(rect.right, other.right) - Math.max(rect.left, other.left) > 1 ||
							Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top) > 1) &&
						x >= other.left - 1 &&
						x <= other.right + 1 &&
						y >= other.top - 1 &&
						y <= other.bottom + 1
				);
			for (const [corner, x, y] of [
				['tl', rect.left, rect.top],
				['tr', rect.right, rect.top],
				['br', rect.right, rect.bottom],
				['bl', rect.left, rect.bottom]
			] as const) {
				const property = '--selection-' + corner,
					value = covered(x, y) ? '0px' : 'var(--border-radius-small)';
				if (cell.style.getPropertyValue(property) !== value)
					cell.style.setProperty(property, value);
			}
		});
	}
	const scheduleCorners = () => {
		if (!cornersFrame) cornersFrame = requestAnimationFrame(updateCorners);
	};
	const unsubscribe = selectedBoxIds.subscribe(scheduleCorners);
	const resize = new ResizeObserver(scheduleCorners);
	resize.observe(container);
	// Text wrapping, folding, spacing and column resizing can change adjacency.
	const observer = new MutationObserver(scheduleCorners);
	observer.observe(container, {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['class', 'style']
	});
	const unsubscribeSettings = settings.subscribe(['any'], scheduleCorners);
	window.addEventListener('resize', scheduleCorners);
	container.addEventListener('pointerdown', start);
	container.addEventListener('lostpointercapture', lostCapture);
	container.addEventListener('click', click, true);
	return {
		destroy() {
			finish();
			unsubscribe();
			unsubscribeSettings();
			resize.disconnect();
			observer.disconnect();
			window.removeEventListener('resize', scheduleCorners);
			cancelAnimationFrame(cornersFrame);
			container.removeEventListener('pointerdown', start);
			container.removeEventListener('lostpointercapture', lostCapture);
			container.removeEventListener('click', click, true);
		}
	};
}
