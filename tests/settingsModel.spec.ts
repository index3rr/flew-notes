import { test, expect } from '@playwright/test';
let settings: typeof import('../src/lib/models/settings').settings;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
test.beforeAll(async () => {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
	});
	({ settings } = await import('../src/lib/models/settings'));
});
test.afterAll(() => {
	if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
	else Reflect.deleteProperty(globalThis, 'localStorage');
});

test.afterEach(() => settings.resetToAuto());

test('invalid settings values fall back without corrupting valid imported preferences', () => {
	settings.parseJsonToSettings({
		isSettings: true,
		version: 2,
		settings: {
			debateStyle: 999,
			fontFamily: -1,
			padding: -100,
			gap: 1e9,
			fontSize: NaN,
			pacingEnabled: 'true',
			timerStartPhrases: 17,
			customBackground: '#nope',
			notesPanel: 2,
			transcriptAnalyticsOnly: true
		}
	});
	expect(settings.data.debateStyle.value).toBe(settings.data.debateStyle.auto);
	expect(settings.data.fontFamily.value).toBe(settings.data.fontFamily.auto);
	expect(settings.data.padding.value).toBe(0);
	expect(settings.data.gap.value).toBe(30);
	expect(settings.data.fontSize.value).toBe(settings.data.fontSize.auto);
	expect(settings.data.pacingEnabled.value).toBe(false);
	expect(settings.data.timerStartPhrases.value).toBe(settings.data.timerStartPhrases.auto);
	expect(settings.data.customBackground.value).toBe(settings.data.customBackground.auto);
	expect(settings.data.notesPanel.value).toBe(2);
	expect(settings.data.transcriptAnalyticsOnly.value).toBe(true);
});

test('malformed settings objects and unknown keys are ignored', () => {
	for (const data of [
		null,
		[],
		{ isSettings: true },
		{ isSettings: true, settings: null },
		{ isSettings: true, settings: [] },
		'settings'
	])
		settings.parseJsonToSettings(data);
	settings.parseJsonToSettings(
		JSON.parse(
			'{"isSettings":true,"version":2,"settings":{"__proto__":7,"constructor":8,"futureSetting":9}}'
		)
	);
	expect(settings.data.debateStyle.value).toBe(settings.data.debateStyle.auto);
	expect(Object.prototype).not.toHaveProperty('value');
});

test('custom font settings still import and random colors are always valid', () => {
	settings.parseJsonToSettings({
		isSettings: true,
		version: 2,
		settings: { fontFamily: 4, fontFamilyCustom: 'My font' }
	});
	expect(settings.data.fontFamily.value).toBe(4);
	const font = settings.data.fontFamily;
	if (font.type === 'radio') expect(font.detail.customOptionValue).toBe('My font');
	for (let i = 0; i < 20; i++) {
		settings.randomize();
		for (const setting of Object.values(settings.data))
			if (setting.type === 'color') expect(setting.value).toMatch(/^#[\da-f]{6}$/i);
	}
});

test('a failed settings write preserves this session and never throws on popup teardown', () => {
	const storage = localStorage.setItem;
	localStorage.setItem = () => {
		throw new DOMException('Full', 'QuotaExceededError');
	};
	try {
		settings.setValue('notesPanel', 1);
		expect(settings.saveToLocalStorage()).toBe(false);
		expect(settings.data.notesPanel.value).toBe(1);
	} finally {
		localStorage.setItem = storage;
	}
});

test('fun mode leaves telemetry, transcription models, promotion and save limits alone', () => {
	settings.setValue('telemetry', 0);
	settings.setValue('transcriptModel', 3);
	settings.setValue('speechDropPromo', true);
	settings.setValue('maxLocalSaves', 7);
	const callbacks: (() => void)[] = [];
	const interval = globalThis.setInterval;
	globalThis.setInterval = ((callback: () => void) => {
		callbacks.push(callback);
		return interval(() => undefined, 1e9);
	}) as typeof setInterval;
	try {
		settings.setValue('funMode', true);
		const randomize = callbacks.at(-1);
		if (!randomize) throw new Error('Fun mode did not schedule updates');
		for (let i = 0; i < 500; i++) randomize();
		expect(settings.data.telemetry.value).toBe(0);
		expect(settings.data.transcriptModel.value).toBe(3);
		expect(settings.data.speechDropPromo.value).toBe(true);
		expect(settings.data.maxLocalSaves.value).toBe(7);
	} finally {
		settings.setValue('funMode', false);
		globalThis.setInterval = interval;
	}
});

test('version 2 settings retain their former default layout and version 3 uses the new layout', () => {
	settings.parseJsonToSettings({ isSettings: true, version: 2, settings: {} });
	expect(settings.data.notesPanel.value).toBe(2);
	expect(settings.data.coveragePanel.value).toBe(2);
	expect(settings.data.timersPanel.value).toBe(1);
	settings.resetToAuto();
	settings.parseJsonToSettings({ isSettings: true, version: 3, settings: {} });
	expect(settings.data.notesPanel.value).toBe(0);
	expect(settings.data.coveragePanel.value).toBe(0);
	expect(settings.data.timersPanel.value).toBe(3);
});

test('legacy settings keep their expanded timer while migrating hidden Notes', () => {
	settings.parseJsonToSettings({ isSettings: true, version: 1, settings: { showSideDoc: false } });
	expect(settings.data.notesPanel.value).toBe(0);
	expect(settings.data.timersPanel.value).toBe(1);
});

test('version 4 removes manual-save visibility and retires full-flow telemetry tiers', () => {
	settings.parseJsonToSettings({
		isSettings: true,
		version: 3,
		settings: { showSaveButton: false, telemetry: 4 }
	});
	expect(settings.data.showSaveButton).toBeUndefined();
	expect(settings.data.telemetry.value).toBe(2);
	expect(JSON.parse(settings.convertSettingsToJson()).version).toBe(4);
	expect(settings.convertSettingsToJson()).not.toContain('showSaveButton');
});
