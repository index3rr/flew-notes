import posthog from 'posthog-js';
import type { Nodes } from './node';

const POSTHOG_TOKEN = 'phc_Dhn9bh5xNJ2B6aTBsHpLdDXeFUnyfRZhVGxHegaYRa7P';
const POSTHOG_HOST = 'https://us.i.posthog.com';

export type TelemetryTier = 0 | 1 | 2 | 3 | 4;
// 0 = none, 1 = error, 2 = usage, 3 = all, 4 = extra

const TIER_NAMES = ['none', 'error', 'usage', 'all', 'extra'] as const;

let initialized = false;
let currentTier: TelemetryTier = 0;
let errorListenersAdded = false;
let funModeActive = false;
const settingsBuffer: Record<string, unknown> = {};

export function getTierName(tier: TelemetryTier): string {
	return TIER_NAMES[tier];
}

export function initTelemetry(tier: TelemetryTier, ref?: string) {
	if (tier === 0) {
		shutdownTelemetry();
		return;
	}

	currentTier = tier;

	if (!initialized) {
		posthog.init(POSTHOG_TOKEN, {
			api_host: POSTHOG_HOST,
			cookieless_mode: 'always',
			autocapture: false,
			capture_pageview: false,
			capture_pageleave: false
		});
		initialized = true;
	}

	if (ref) {
		posthog.register({ referrer: ref });
	}

	posthog.register({
		app_version: '1.2',
		telemetry_tier: TIER_NAMES[tier]
	});

	if (!errorListenersAdded) {
		addErrorListeners();
		errorListenersAdded = true;
	}
}

export function shutdownTelemetry() {
	if (initialized) {
		posthog.shutdown();
		initialized = false;
	}
	currentTier = 0;
}

function isActive(): boolean {
	return initialized && currentTier > 0;
}

function isUsageOrAbove(): boolean {
	return initialized && currentTier >= 2;
}

function isAllOrAbove(): boolean {
	return initialized && currentTier >= 3;
}

function addErrorListeners() {
	window.addEventListener('error', (event) => {
		if (!isActive()) return;
		posthog.capture('javascript_error', {
			message: event.message,
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
			stack: event.error?.stack?.substring(0, 500)
		});
	});

	window.addEventListener('unhandledrejection', (event) => {
		if (!isActive()) return;
		posthog.capture('unhandled_promise_rejection', {
			reason: String(event.reason).substring(0, 500)
		});
	});
}

export function trackSettingChanged(key: string, value: unknown) {
	if (!isUsageOrAbove() || funModeActive) return;
	settingsBuffer[key] = value;
}

export function flushSettingChanges() {
	if (!isUsageOrAbove()) return;
	const keys = Object.keys(settingsBuffer);
	if (keys.length === 0) return;
	posthog.capture('settings_changed', { settings: { ...settingsBuffer } });
	for (const key of keys) {
		delete settingsBuffer[key];
	}
}

export function setFunMode(active: boolean) {
	funModeActive = active;
}

export function trackFlowCreated(debateStyle: string, flowCount: number) {
	if (!isUsageOrAbove()) return;
	posthog.capture('flow_created', {
		debate_style: debateStyle,
		flow_count: flowCount
	});
}

export function trackFlowDeleted(flowCount: number) {
	if (!isUsageOrAbove()) return;
	posthog.capture('flow_deleted', { flow_count: flowCount });
}

export function trackBoxCreated(level: number) {
	if (!isUsageOrAbove()) return;
	posthog.capture('box_created', { level });
}

export function trackBoxEdited(level: number, hadContent: boolean) {
	if (!isUsageOrAbove()) return;
	posthog.capture('box_edited', { level, had_content_before: hadContent });
}

export function trackFileImported(format: string, flowCount: number) {
	if (!isUsageOrAbove()) return;
	posthog.capture('file_imported', { format, flow_count: flowCount });
}

export function trackFileExported(format: string, flowCount: number) {
	if (!isUsageOrAbove()) return;
	posthog.capture('file_exported', { format, flow_count: flowCount });
}

export function trackSharingStarted(isHost: boolean) {
	if (!isUsageOrAbove()) return;
	posthog.capture('sharing_started', { is_host: isHost });
}

export function trackFlowDataUpload(nodes: Nodes) {
	if (!isAllOrAbove()) return;
	const flowCount = nodes.root.children.length;
	const flows = nodes.root.children.map((flowId) => {
		const flow = nodes[flowId];
		if (!flow) return null;
		return {
			name: flow.value.content,
			invert: flow.value.invert,
			columns: flow.value.columns,
			boxes: collectBoxes(nodes, flowId as string)
		};
	}).filter(Boolean);
	posthog.capture('flow_data_upload', {
		flow_count: flowCount,
		flows
	});
}

function collectBoxes(nodes: Nodes, id: string): { content: string; children: ReturnType<typeof collectBoxes> }[] {
	const node = nodes[id as keyof Nodes];
	if (!node) return [];
	return node.children.map((childId) => {
		const child = nodes[childId as keyof Nodes];
		if (!child || child.value.tag !== 'box') return null;
		return {
			content: child.value.content,
			children: collectBoxes(nodes, childId as string)
		};
	}).filter(Boolean) as { content: string; children: ReturnType<typeof collectBoxes> }[];
}

export function shouldShowExtraPopup(): boolean {
	return currentTier === 4 && localStorage.getItem('extra_popup_shown') !== 'true';
}

export function markExtraPopupShown() {
	localStorage.setItem('extra_popup_shown', 'true');
}

export function getCurrentTier(): TelemetryTier {
	return currentTier;
}
