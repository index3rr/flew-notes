import posthog from 'posthog-js';
import { CURRENT_VERSION } from './version';
import { panelIds } from './panels';

const POSTHOG_TOKEN = 'phc_Dhn9bh5xNJ2B6aTBsHpLdDXeFUnyfRZhVGxHegaYRa7P';
export type TelemetryTier = 0 | 1 | 2;
const TIER_NAMES = ['none', 'errors', 'usage'] as const;
const events: Record<string, string[]> = {
	app_opened: ['surface'],
	onboarding_completed: ['outcome', 'tutorial_requested'],
	tutorial_finished: ['guide', 'completed', 'step'],
	document_created: ['page_count'],
	document_opened: ['source', 'page_count'],
	file_imported: ['format', 'page_count'],
	file_exported: ['format', 'page_count'],
	sharing_started: ['role'],
	sharing_connected: ['role'],
	usage_summary: ['counts', 'window_seconds'],
	settings_changed: ['settings'],
	javascript_error: ['name', 'filename', 'line', 'column', 'stack']
};
const sdkProperties = [
	'token',
	'distinct_id',
	'$device_id',
	'$session_id',
	'$window_id',
	'$lib',
	'$lib_version',
	'$browser',
	'$browser_version',
	'$os',
	'$os_version',
	'$device_type',
	'$screen_height',
	'$screen_width',
	'$viewport_height',
	'$viewport_width',
	'$process_person_profile',
	'$is_identified',
	'$cookieless'
];
let initialized = false;
let currentTier: TelemetryTier = 0;
let funModeActive = false;
let listenersAdded = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let windowStarted = 0;
let counts: Record<string, number> = {};
let settingsBuffer: Record<string, boolean | number> = {};
let context: Record<string, unknown> = {};
const openedSurfaces = new Set<string>();
const errors = new Set<string>();

export function isGlobalPrivacyControlEnabled() {
	return (
		typeof navigator !== 'undefined' &&
		(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
	);
}
function active(usage = false) {
	return (
		initialized &&
		!funModeActive &&
		!isGlobalPrivacyControlEnabled() &&
		currentTier >= (usage ? 2 : 1)
	);
}
function clearBuffers() {
	clearTimeout(flushTimer);
	flushTimer = undefined;
	counts = {};
	settingsBuffer = {};
	windowStarted = 0;
}
export function setTelemetryContext(value: {
	debate_style: string;
	enabled_panels: string[];
	theme: string;
}) {
	context = value;
}
function capture(event: string, properties: Record<string, unknown> = {}, usage = true) {
	if (!active(usage)) return;
	posthog.capture(event, {
		...context,
		...properties,
		app_version: CURRENT_VERSION,
		telemetry_schema: 2,
		telemetry_tier: TIER_NAMES[currentTier]
	});
}
export function initTelemetry(tier: TelemetryTier, ref?: string) {
	if (![1, 2].includes(tier) || isGlobalPrivacyControlEnabled()) {
		shutdownTelemetry();
		return;
	}
	if (currentTier !== tier) {
		clearBuffers();
		if (initialized) posthog.opt_out_capturing();
	}
	currentTier = tier;
	if (!initialized) {
		posthog.init(POSTHOG_TOKEN, {
			api_host: 'https://us.i.posthog.com',
			persistence: 'memory',
			request_batching: false,
			opt_out_capturing_persistence_type: 'localStorage',
			person_profiles: 'never',
			ip: false,
			autocapture: false,
			capture_pageview: false,
			capture_pageleave: false,
			capture_dead_clicks: false,
			capture_exceptions: false,
			disable_session_recording: true,
			disable_surveys: true,
			disable_external_dependency_loading: true,
			advanced_disable_feature_flags: true,
			advanced_disable_flags: true,
			save_campaign_params: false,
			save_referrer: false,
			before_send: (event) => {
				// SDK defaults include URLs, which can contain collaboration credentials.
				if (!event || !events[event.event] || !active(event.event !== 'javascript_error'))
					return null;
				const allowed = new Set([
					...sdkProperties,
					...events[event.event],
					'app_version',
					'telemetry_schema',
					'telemetry_tier',
					'debate_style',
					'enabled_panels',
					'theme',
					'referrer'
				]);
				event.properties = Object.fromEntries(
					Object.entries(event.properties ?? {}).filter(([key]) => allowed.has(key))
				);
				event.properties.$geoip_disable = true;
				delete event.$set;
				delete event.$set_once;
				delete event.$unset;
				return event;
			}
		});
		initialized = true;
	}
	if (!funModeActive) posthog.opt_in_capturing({ captureEventName: false });
	if (ref && ['github', 'reddit', 'discord', 'cardmirror'].includes(ref.toLowerCase()))
		posthog.register({ referrer: ref.toLowerCase() });
	if (!listenersAdded) {
		window.addEventListener('error', (event) =>
			reportError(
				event.error instanceof Error ? event.error : new Error(event.message),
				event.filename,
				event.lineno,
				event.colno
			)
		);
		window.addEventListener('unhandledrejection', (event) =>
			reportError(
				event.reason instanceof Error
					? event.reason
					: new Error(`Unhandled rejection (${typeof event.reason})`)
			)
		);
		window.addEventListener('pagehide', flushTelemetry);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') flushTelemetry();
		});
		listenersAdded = true;
	}
	trackAppOpened(window.location.pathname === '/app' ? 'app' : 'home');
}
export function shutdownTelemetry() {
	currentTier = 0;
	clearBuffers();
	openedSurfaces.clear();
	errors.clear();
	// shutdown() flushes queued requests; opting out discards them instead.
	if (initialized) posthog.opt_out_capturing();
}
export function setFunMode(value: boolean) {
	funModeActive = value;
	if (value) clearBuffers();
}
export function trackAppOpened(surface: 'app' | 'home') {
	if (!active(true) || openedSurfaces.has(surface)) return;
	openedSurfaces.add(surface);
	capture('app_opened', { surface });
}
export function countUsage(key: string, amount = 1) {
	if (!active(true) || !Number.isFinite(amount) || amount <= 0) return;
	if (!windowStarted) windowStarted = Date.now();
	counts[key] = (counts[key] ?? 0) + amount;
	if (!flushTimer) flushTimer = setTimeout(flushTelemetry, 60_000);
}
export function flushTelemetry() {
	clearTimeout(flushTimer);
	flushTimer = undefined;
	if (active(true) && Object.keys(counts).length)
		capture('usage_summary', {
			counts,
			window_seconds: Math.round((Date.now() - windowStarted) / 1000)
		});
	counts = {};
	windowStarted = 0;
	flushSettingChanges();
}
export function trackSettingChanged(key: string, value: unknown) {
	if (!active(true)) return;
	if (
		![
			...panelIds,
			'debateStyle',
			'LDSubstyle',
			'colorTheme',
			'pacingEnabled',
			'transcriptModel',
			'transcriptSource',
			'timerAutoAdvance',
			'timerStartOnSpeech',
			'partnerNotifications',
			'showUndoRedoButtons',
			'showBoxCreationButtons',
			'showQuickExtensionButtons',
			'showBoxFormatButtons'
		].includes(key)
	)
		return;
	if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))
		settingsBuffer[key] = value;
	if (!flushTimer) flushTimer = setTimeout(flushTelemetry, 60_000);
}
export function flushSettingChanges() {
	if (active(true) && Object.keys(settingsBuffer).length)
		capture('settings_changed', { settings: settingsBuffer });
	settingsBuffer = {};
}
function appSource(url: string) {
	try {
		const source = new URL(url, window.location.href);
		return source.origin === window.location.origin &&
			/^\/(?:_app\/immutable|src|node_modules\/\.vite)\/[\w./-]+\.(?:js|ts|svelte)$/.test(
				source.pathname
			)
			? source.pathname
			: '';
	} catch {
		return '';
	}
}
function reportError(error: Error, filename = '', line = 0, column = 0) {
	if (!active()) return;
	const name = [
		'TypeError',
		'ReferenceError',
		'SyntaxError',
		'RangeError',
		'AbortError',
		'NotAllowedError',
		'QuotaExceededError'
	].includes(error.name)
		? error.name
		: 'Error';
	// Use source locations for grouping. Messages can contain user input or share keys.
	const source = filename ? appSource(filename) : '';
	const stack = [...(error.stack ?? '').matchAll(/(https?:\/\/[^\s)]+?):(\d+):(\d+)/g)]
		.flatMap(([, url, row, col]) => {
			const path = appSource(url);
			return path ? [`${path}:${row}:${col}`] : [];
		})
		.slice(0, 8)
		.join('\n');
	const key = `${name}:${source}:${line}:${column}:${stack}`;
	if (errors.has(key) || errors.size >= 30) {
		countUsage('repeated_errors');
		return;
	}
	errors.add(key);
	capture('javascript_error', { name, filename: source, line, column, stack }, false);
}
export function trackFlowCreated() {
	countUsage('pages_created');
}
export function trackFlowDeleted() {
	countUsage('pages_deleted');
}
export function trackBoxCreated(level: number) {
	countUsage(level > 0 ? 'responses_created' : 'arguments_created');
}
export function trackBoxEdited() {
	countUsage('arguments_edited');
}
export function trackFileImported(format: string, page_count: number) {
	capture('file_imported', { format, page_count });
}
export function trackFileExported(format: string, page_count: number) {
	capture('file_exported', { format, page_count });
}
export function trackSharingStarted(isHost: boolean) {
	capture('sharing_started', { role: isHost ? 'host' : 'guest' });
}
export function trackSharingConnected(isHost: boolean) {
	capture('sharing_connected', { role: isHost ? 'host' : 'guest' });
}
export function trackDocumentCreated(page_count: number) {
	capture('document_created', { page_count });
}
export function trackDocumentOpened(
	source: 'browser' | 'folder' | 'file' | 'copy',
	page_count: number
) {
	capture('document_opened', { source, page_count });
}
export function trackOnboardingCompleted(
	outcome: 'completed' | 'skipped' | 'dismissed' | 'imported',
	tutorial_requested: boolean
) {
	capture('onboarding_completed', { outcome, tutorial_requested });
}
export function trackTutorialFinished(guide: string, completed: boolean, step: number) {
	capture('tutorial_finished', { guide, completed, step });
}

export function trackFeatureUsed(
	feature: 'autoflow' | 'library' | 'transcript' | 'speechdrop' | 'cardmirror' | 'timer',
	action: 'started' | 'completed' | 'connected' | 'uploaded' | 'imported'
) {
	countUsage(`${feature}_${action}`);
}
