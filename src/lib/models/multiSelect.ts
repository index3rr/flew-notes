export function selectItems<T>(
	ordered: readonly T[],
	current: Iterable<T>,
	target: T,
	anchor: T | null,
	event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }
) {
	const selected = new Set(current);
	if (event.shiftKey && anchor != null && ordered.includes(anchor)) {
		const from = ordered.indexOf(anchor),
			to = ordered.indexOf(target);
		return { selected: new Set(ordered.slice(Math.min(from, to), Math.max(from, to) + 1)), anchor };
	}
	if (event.ctrlKey || event.metaKey) {
		if (selected.has(target)) selected.delete(target);
		else selected.add(target);
		return { selected, anchor: target };
	}
	return { selected: new Set([target]), anchor: target };
}
