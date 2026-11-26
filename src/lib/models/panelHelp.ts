import type { PanelId } from './panels';

export const tutorialShortcuts: Record<string, string[]> = {
	previousPage: ['commandControl', 'option', 'up'],
	nextPage: ['commandControl', 'option', 'down'],
	primaryPage: ['commandControl', 'option', 'n'],
	secondaryPage: ['commandControl', 'option', 'shift', 'n'],
	star: ['commandControl', 'shift', '8']
};

export const panelHelp: Record<PanelId, { summary: string; steps: string[] }> = {
	tabsPanel: {
		summary: 'Organize the pages in this round.',
		steps: [
			'Use {previousPage} or {nextPage} to switch pages, or just click them. Use {primaryPage} to add a primary page and {secondaryPage} to add a secondary page.',
			'You can select pages by shift clicking or control/command clicking, and reorder/delete them.',
			'You can also drag pages from the flow library panel or autoflow panel to add them here.'
		]
	},
	notesPanel: {
		summary: 'Keep private notes alongside your flow.',
		steps: [
			'You can write whatever you want here to help you keep track of the round.',
			'You can drag and drop arguments from the flow to here, and with the autoflow panel, things like plantext.',
			"These notes are saved alongside your flows, but don’t sync with your partner's notes if you are using live collaboration."
		]
	},
	timersPanel: {
		summary: 'Track speeches, prep and argument pacing.',
		steps: [
			'Pick a speech here and start the timer to keep track of how long you have.',
			'Prep timers for both teams are at the top if applicable.',
			'In settings, you can enable pacing to give you an idea of how many seconds you can spend on each argument on your flow.'
		]
	},
	coveragePanel: {
		summary: 'Find unanswered and dropped arguments.',
		steps: [
			'This panel lets you choose a speech and then shows you what arguments need to be responded to.',
			'You can click on an argument to jump to it, and quickly add a response with the button on the right.',
			'You can also extend all arguments the last speech dropped in the context menu, and control in settings if they still show up here.'
		]
	},
	starredPanel: {
		summary: 'Return to important arguments and their notes.',
		steps: [
			'This panel lets you star arguments with {star} and keep them here.',
			'Click the starred argument to jump to it on the flow.',
			'You can add a note, or unstar it from here as well, useful for CX questions.'
		]
	},
	speechDropPanel: {
		summary: 'Exchange files in a SpeechDrop room.',
		steps: [
			'Here you can put in a speechdrop code and view its files.',
			'You can download and delete files as well as uploading them with the context menu or by dragging and dropping files here.',
			"If you want to put a file from the speechdrop into tools like the autoflow panel, there's no need to download it and then reupload it, simply drag it to the autoflow panel."
		]
	},
	autoflowPanel: {
		summary: 'Turn a speech document into flowable blocks.',
		steps: [
			"You can drag and drop or load a .docx file here. Then, you'll see a list of its blocks, and can preview their contents.",
			'You can drag these blocks into the flow pages list to add it as a new page, the flow itself as arguments, or into notes (useful for plantext.)',
			'These arguments will have cards attached to them, which means if you paste them into cardmirror, those cards will appear.'
		]
	},
	libraryPanel: {
		summary: 'Reuse pages from saved documents.',
		steps: [
			'Here, you can see the recent flows you’ve edited, and if you have a folder connected to store flows, navigate that folder.',
			'You can preview pages from other flows by clicking on them, and even select multiple with shift click or control/command click.',
			'Then, you can drag those pages into your flow tabs, your notes, or a flow page itself.'
		]
	},
	transcriptPanel: {
		summary: 'Transcribe audio and find claims outside a reference document.',
		steps: [
			'The transcript is a bit finicky and will be improved, but you can choose either microphone or tab audio to record in settings, and a model to transcribe with.',
			'If you drag a speechdrop file here or just paste something in, the model will automatically keep track of what they are reading from the doc.',
			'More importantly, it will keep track of what they don’t read from the doc, but instead read from analytics or their flows. These arguments can be added to the flow with one click, or dragged onto the flow.'
		]
	},
	collaborationPanel: {
		summary: 'Work on a shared round and message your partners.',
		steps: [
			"You can connect to your partners computer and share the same flow with a QR code, a link, or a pairing code. All changes to the flow will be sent live, so you can make sure you don't miss anything.",
			'This panel isn’t required to use collaboration, but it lets you send messages to your partner and give them system notifications so they don’t look like an idiot when you need to prompt them.'
		]
	},
	cardMirrorPanel: {
		summary: 'Move complete cards between your flow and CardMirror.',
		steps: [
			'First, install the extension and pair it with Flew.',
			'Then, you can send cards from the doc straight into Flew, and from this panel jump back to those cards in cardmirror!',
			'You can also send analytics from your flows directly into a speech doc in CardMirror.'
		]
	}
};
