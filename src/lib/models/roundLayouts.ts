import { panelIds } from './panels';
import { settings } from './settings';

const layoutKeys = [
	...panelIds,
	...panelIds.map((id) => id + 'ShowName'),
	'sidebarWidth',
	'panelWidth',
	'showUndoRedoButtons',
	'showBoxCreationButtons',
	'showQuickExtensionButtons',
	'showBoxFormatButtons'
];
type LayoutValues = Record<string, number | boolean>;
export type RoundLayout = { id: string; name: string; values: LayoutValues };
const storageKey = 'flewRoundLayouts';

function captureLayout(key: 'auto' | 'value'): LayoutValues {
	return Object.fromEntries(
		layoutKeys.map((id) => [id, settings.data[id][key] as number | boolean])
	);
}

function defaultLayouts(): RoundLayout[] {
	const base = captureLayout('auto');
	return [
		{ id: 'flowing', name: 'Flowing', values: base },
		{
			id: 'prep',
			name: 'Prep',
			values: { ...base, timersPanel: 1, notesPanel: 2, coveragePanel: 2 }
		},
		{
			id: 'review',
			name: 'Review',
			values: {
				...base,
				notesPanel: 2,
				starredPanel: 2,
				coveragePanel: 4,
				libraryPanel: 3,
				showBoxCreationButtons: false,
				showQuickExtensionButtons: false,
				showBoxFormatButtons: false
			}
		}
	];
}

function readValues(raw: unknown): LayoutValues | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const values = raw as Record<string, unknown>;
	const entries = layoutKeys.flatMap<readonly [string, number | boolean]>((key) => {
		const value = values[key];
		const auto = settings.data[key].auto;
		if (typeof auto === 'boolean' && typeof value === 'boolean') return [[key, value] as const];
		if (typeof auto === 'number' && typeof value === 'number' && Number.isFinite(value))
			return [[key, value] as const];
		return [];
	});
	return entries.length ? Object.fromEntries(entries) : null;
}

export function readRoundLayouts(): RoundLayout[] {
	try {
		const data = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
		if (Array.isArray(data)) {
			const ids = new Set<string>();
			return data.flatMap((entry) => {
				const values = readValues(entry?.values);
				const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
				const id = entry?.id;
				if (!values || !name || typeof id !== 'string' || !id || ids.has(id)) return [];
				ids.add(id);
				return [{ id, name, values }];
			});
		}
		// The original three slots were stored by name. Keep any user snapshots in those slots.
		return defaultLayouts().map((layout) => ({
			...layout,
			values: readValues(data?.[layout.name]) ?? layout.values
		}));
	} catch {
		return defaultLayouts();
	}
}

function writeRoundLayouts(layouts: RoundLayout[]) {
	try {
		localStorage.setItem(storageKey, JSON.stringify(layouts));
	} catch {
		throw new Error('Could not save layouts in this browser.');
	}
	return layouts;
}

function uniqueName(name: string, layouts: RoundLayout[], id?: string) {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Enter a layout name.');
	if (
		layouts.some(
			(layout) => layout.id !== id && layout.name.toLowerCase() === trimmed.toLowerCase()
		)
	)
		throw new Error('A layout with that name already exists.');
	return trimmed;
}

export function saveRoundLayout(name: string) {
	const layouts = readRoundLayouts();
	const layout = {
		id: crypto.randomUUID(),
		name: uniqueName(name, layouts),
		values: captureLayout('value')
	};
	return writeRoundLayouts([...layouts, layout]);
}

export function updateRoundLayout(id: string, change: { name: string } | { capture: true }) {
	const layouts = readRoundLayouts();
	const layout = layouts.find((entry) => entry.id === id);
	if (!layout) throw new Error('This layout is no longer available.');
	if ('name' in change) layout.name = uniqueName(change.name, layouts, id);
	else layout.values = captureLayout('value');
	return writeRoundLayouts(layouts);
}

export function removeRoundLayout(id: string) {
	return writeRoundLayouts(readRoundLayouts().filter((layout) => layout.id !== id));
}

export function applyRoundLayout({ values }: RoundLayout) {
	for (const key of layoutKeys) {
		const value = values[key];
		if (value !== undefined && settings.data[key].value !== value) settings.setValue(key, value);
	}
	return settings.saveToLocalStorage();
}
