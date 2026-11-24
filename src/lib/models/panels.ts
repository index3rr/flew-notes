// Single registry for sidebar panels. Order here is the order panels render on a side.
export const panelIds = [
	'tabsPanel',
	'notesPanel',
	'coveragePanel',
	'starredPanel',
	'speechDropPanel',
	'autoflowPanel',
	'timersPanel',
	'libraryPanel',
	'transcriptPanel',
	'collaborationPanel',
	'cardMirrorPanel'
] as const;
export type PanelId = (typeof panelIds)[number];

export const panelNames: Record<PanelId, string> = {
	tabsPanel: 'Tabs',
	notesPanel: 'Notes',
	coveragePanel: 'Coverage',
	starredPanel: 'Starred arguments',
	speechDropPanel: 'SpeechDrop',
	autoflowPanel: 'Autoflow',
	timersPanel: 'Timers',
	libraryPanel: 'Flow library',
	transcriptPanel: 'Transcript',
	collaborationPanel: 'Collaboration',
	cardMirrorPanel: 'CardMirror'
};

export const panelIcons: Record<PanelId, string> = {
	tabsPanel: 'dots',
	notesPanel: 'file',
	coveragePanel: 'checklist',
	starredPanel: 'star',
	speechDropPanel: 'download',
	autoflowPanel: 'checklist',
	timersPanel: 'clock',
	libraryPanel: 'folder',
	transcriptPanel: 'mic',
	collaborationPanel: 'people',
	cardMirrorPanel: 'link'
};

// These need an open flow; without one they show only their name.
export const documentPanelIds: readonly PanelId[] = ['notesPanel', 'coveragePanel', 'starredPanel'];

export const panelPositions = ['Off', 'Left', 'Right', 'Left collapsed', 'Right collapsed'];
export function panelSide(position: number): 'left' | 'right' | null {
	if (position === 1 || position === 3) return 'left';
	if (position === 2 || position === 4) return 'right';
	return null;
}
