import { test, expect } from '@playwright/test';
import posthog from 'posthog-js';
let telemetry: typeof import('../src/lib/models/telemetry');

type Payload = { event: string; properties: Record<string, unknown> };
const captured: Payload[] = [];
const originals = {
	init: posthog.init,
	capture: posthog.capture,
	shutdown: posthog.shutdown,
	register: posthog.register,
	opt_in_capturing: posthog.opt_in_capturing,
	opt_out_capturing: posthog.opt_out_capturing
};
const globals = Object.fromEntries(
	['window', 'document', 'navigator', 'localStorage'].map((key) => [
		key,
		Object.getOwnPropertyDescriptor(globalThis, key)
	])
);
const browser = Object.assign(new EventTarget(), { location: new URL('https://flew/app') });
const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
let sanitize: (payload: Payload) => Payload | null;
let initCalls = 0;
let gpc = false;

test.beforeAll(async () => {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: { getItem: () => null, setItem: () => undefined }
	});
	telemetry = await import('../src/lib/models/telemetry');
	Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
	Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
	Object.defineProperty(globalThis, 'navigator', {
		configurable: true,
		value: {
			get globalPrivacyControl() {
				return gpc;
			}
		}
	});
	posthog.init = (_token, config) => {
		initCalls++;
		sanitize = config?.before_send as typeof sanitize;
		return posthog;
	};
	posthog.capture = (event, properties) => {
		const result = sanitize({
			event,
			properties: {
				$current_url: 'https://flew/app?join=PRIVATE',
				$referrer: 'https://site/private',
				...properties
			}
		});
		if (result) captured.push(result);
		return undefined;
	};
	posthog.shutdown = async () => undefined;
	posthog.opt_in_capturing = () => undefined;
	posthog.opt_out_capturing = () => undefined;
	posthog.register = () => undefined;
});
test.beforeEach(() => {
	telemetry.shutdownTelemetry();
	telemetry.setFunMode(false);
	gpc = false;
	initCalls = 0;
	captured.length = 0;
	telemetry.setTelemetryContext({
		debate_style: 'policy',
		enabled_panels: ['tabsPanel'],
		theme: 'dark'
	});
});
test.afterEach(() => telemetry.shutdownTelemetry());
test.afterAll(() => {
	Object.assign(posthog, originals);
	for (const [key, descriptor] of Object.entries(globals)) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
		else Reflect.deleteProperty(globalThis, key);
	}
});
function error(message = 'Failed to load https://flew/app?join=PRIVATE#token') {
	browser.dispatchEvent(
		Object.assign(new Event('error'), {
			error: new Error(message),
			filename: 'https://flew/_app/immutable/app.js?secret=PRIVATE',
			lineno: 10,
			colno: 3
		})
	);
}

test('editing thousands of boxes produces one aggregate and no argument text or credential URLs', () => {
	telemetry.initTelemetry(2);
	for (let i = 0; i < 1000; i++) telemetry.trackBoxCreated(1);
	expect(captured.map((item) => item.event)).toEqual(['app_opened']);
	telemetry.flushTelemetry();
	expect(captured.map((item) => item.event)).toEqual(['app_opened', 'usage_summary']);
	expect(captured[1].properties.counts).toEqual({ responses_created: 1000 });
	expect(JSON.stringify(captured)).not.toContain('PRIVATE');
	expect(captured[1].properties).toMatchObject({
		app_version: '2.0.0',
		telemetry_schema: 2,
		debate_style: 'policy',
		enabled_panels: ['tabsPanel']
	});
});

test('no telemetry initializes before a choice, and GPC overrides an enabled choice', () => {
	telemetry.initTelemetry(0);
	telemetry.trackSharingStarted(true);
	error();
	expect(initCalls).toBe(0);
	gpc = true;
	telemetry.initTelemetry(2);
	telemetry.trackBoxCreated(0);
	expect(initCalls).toBe(0);
	expect(captured).toEqual([]);
});

test('opt-out and tier reductions discard pending usage instead of uploading it later', () => {
	telemetry.initTelemetry(2);
	telemetry.trackBoxCreated(0);
	telemetry.trackSettingChanged('notesPanel', 2);
	telemetry.initTelemetry(1);
	telemetry.flushTelemetry();
	error();
	expect(captured.map((item) => item.event)).toEqual(['app_opened', 'javascript_error']);
	telemetry.shutdownTelemetry();
	telemetry.initTelemetry(2);
	telemetry.flushTelemetry();
	expect(captured.filter((item) => item.event === 'usage_summary')).toEqual([]);
	expect(captured.filter((item) => item.event === 'settings_changed')).toEqual([]);
});

test('fun mode suppresses every helper and errors, and clears old buffers', () => {
	telemetry.initTelemetry(2);
	captured.length = 0;
	telemetry.trackBoxCreated(0);
	telemetry.setFunMode(true);
	telemetry.trackFileExported('json', 1);
	telemetry.trackFileImported('json', 1);
	telemetry.trackSharingStarted(true);
	telemetry.trackSettingChanged('notesPanel', 2);
	telemetry.trackOnboardingCompleted('completed', true);
	error();
	telemetry.setFunMode(false);
	telemetry.flushTelemetry();
	expect(captured).toEqual([]);
});

test('useful settings are batched; cosmetic values and arbitrary text are excluded', () => {
	telemetry.initTelemetry(2);
	captured.length = 0;
	for (let i = 0; i < 100; i++) telemetry.trackSettingChanged('padding', i);
	telemetry.trackSettingChanged('notesPanel', 2);
	telemetry.trackSettingChanged('notesPanel', 4);
	telemetry.trackSettingChanged('fontFamilyCustom', 'private user input');
	telemetry.flushSettingChanges();
	expect(captured).toHaveLength(1);
	expect(captured[0].properties.settings).toEqual({ notesPanel: 4 });
});

test('error-only mode deduplicates errors, scrubs URLs, and never serializes rejection objects', () => {
	telemetry.initTelemetry(1);
	error();
	error();
	browser.dispatchEvent(
		Object.assign(new Event('unhandledrejection'), { reason: { privateFlow: 'PRIVATE FLOW' } })
	);
	expect(captured.map((item) => item.event)).toEqual(['javascript_error', 'javascript_error']);
	expect(captured[0].properties).toMatchObject({
		filename: '/_app/immutable/app.js',
		line: 10,
		column: 3
	});
	expect(JSON.stringify(captured)).not.toContain('PRIVATE');
	telemetry.trackOnboardingCompleted('skipped', false);
	telemetry.flushTelemetry();
	expect(captured).toHaveLength(2);
});

test('the outbound allowlist rejects unexpected SDK events and properties', () => {
	telemetry.initTelemetry(2);
	expect(sanitize({ event: '$autocapture', properties: { text: 'PRIVATE' } })).toBeNull();
	const event = sanitize({
		event: 'file_exported',
		properties: {
			format: 'json',
			page_count: 2,
			filename: 'PRIVATE',
			notes: 'PRIVATE',
			$current_url: 'PRIVATE'
		}
	});
	expect(event?.properties).toEqual({ format: 'json', page_count: 2, $geoip_disable: true });
});
