import type { SerializedBox } from '../../models/node';
import type { ExportItem } from './protocol';

export function exportItems(boxes: SerializedBox[]): ExportItem[] {
	const items: ExportItem[] = [];
	const sent = new Set<string>();
	function visit(box: SerializedBox) {
		const snapshots =
			box.value.cardMirror?.sources.flatMap((source) =>
				source.evidence ? [source.evidence] : []
			) ?? [];
		const evidence = snapshots.filter((snapshot) => {
			if (sent.has(snapshot.id)) return false;
			sent.add(snapshot.id);
			return true;
		});
		if (evidence.length) items.push({ text: box.value.content, evidence });
		else if (
			!snapshots.length &&
			box.value.content.trim() &&
			!box.value.empty &&
			!box.value.isExtension
		)
			items.push({ text: box.value.content });
		box.children.forEach(visit);
	}
	boxes.forEach(visit);
	return items;
}
