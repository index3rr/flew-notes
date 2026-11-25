export function panelDrop(node: HTMLElement, options: { types: string[]; disabled?: boolean }) {
	function over(event: DragEvent) {
		const relevant =
			event.dataTransfer && options.types.some((type) => event.dataTransfer!.types.includes(type));
		if (!event.dataTransfer?.types.length) return;
		node.dataset.dropState = relevant && !options.disabled ? 'ready' : 'blocked';
		if (relevant) {
			event.preventDefault();
			event.dataTransfer!.dropEffect = options.disabled ? 'none' : 'copy';
		}
	}
	function clear() {
		delete node.dataset.dropState;
	}
	function leave(event: DragEvent) {
		if (!(event.relatedTarget instanceof Node) || !node.contains(event.relatedTarget)) clear();
	}
	node.addEventListener('dragenter', over);
	node.addEventListener('dragover', over);
	node.addEventListener('dragleave', leave);
	window.addEventListener('drop', clear);
	window.addEventListener('dragend', clear);
	return {
		update(next: typeof options) {
			options = next;
		},
		destroy() {
			node.removeEventListener('dragenter', over);
			node.removeEventListener('dragover', over);
			node.removeEventListener('dragleave', leave);
			window.removeEventListener('drop', clear);
			window.removeEventListener('dragend', clear);
		}
	};
}
