import { writable, get } from 'svelte/store';
import { tutorialStep } from './store';
import { settings } from './settings';
import { trackOnboardingCompleted, trackTutorialFinished } from './telemetry';
import type { PanelId } from './panels';

export const showTutorial = writable(false);
export const tutorialDocked = writable(false);
export const panelTutorial = writable<PanelId | null>(null);
export const panelTutorialStep = writable(0);
export function finishPanelTutorial(completed = false) {
	const guide = get(panelTutorial);
	if (guide) trackTutorialFinished(guide, completed, get(panelTutorialStep) + 1);
	panelTutorial.set(null);
	panelTutorialStep.set(0);
}
export function startPanelTutorial(panel: PanelId) {
	finishTutorial();
	const position = Number(settings.data[panel].value);
	if (position === 0 || position >= 3) {
		settings.setValue(panel, position === 4 ? 2 : 1);
		settings.saveToLocalStorage();
	}
	panelTutorialStep.set(0);
	panelTutorial.set(panel);
}
export function highlightPanelTutorial(node: HTMLElement, panel: PanelId) {
	const unsubscribe = panelTutorial.subscribe((active) =>
		node.toggleAttribute('data-panel-tutorial-active', active === panel)
	);
	return { destroy: unsubscribe };
}
function needsSetup() {
	try {
		return (
			!localStorage.getItem('onboardingComplete') &&
			!localStorage.getItem('settings') &&
			!localStorage.getItem('savedFlows')
		);
	} catch {
		return false;
	}
}
export const setupPending = writable(needsSetup());
let previousTabs: number | null = null;
let temporaryTabs: number | null = null;
export function startTutorial() {
	finishPanelTutorial();
	const position = Number(settings.data.tabsPanel.value);
	if (previousTabs === null && (position === 0 || position >= 3)) {
		previousTabs = position;
		temporaryTabs = position === 4 ? 2 : 1;
		settings.setValue('tabsPanel', temporaryTabs);
	}
	tutorialDocked.set(false);
	tutorialStep.set(0);
	showTutorial.set(true);
}
export function finishTutorial(completed = false) {
	if (get(showTutorial)) trackTutorialFinished('main', completed, get(tutorialStep) + 1);
	showTutorial.set(false);
	tutorialDocked.set(false);
	tutorialStep.set(0);
	if (previousTabs !== null && settings.data.tabsPanel.value === temporaryTabs) {
		settings.setValue('tabsPanel', previousTabs);
		settings.saveToLocalStorage();
	}
	previousTabs = temporaryTabs = null;
}
export function completeSetup(
	tutorial = false,
	outcome: 'completed' | 'skipped' | 'dismissed' | 'imported' = 'skipped'
) {
	trackOnboardingCompleted(outcome, tutorial);
	settings.saveToLocalStorage();
	try {
		localStorage.setItem('onboardingComplete', 'true');
	} catch {
		/* Setup still closes without storage. */
	}
	setupPending.set(false);
	if (tutorial) startTutorial();
}

// Highlight the control itself so starting/stopping a tutorial never changes its layout.
export function highlightTutorial(node: HTMLElement, step: number | null) {
	function updateHighlight() {
		node.toggleAttribute(
			'data-tutorial-active',
			step !== null && get(showTutorial) && get(tutorialStep) === step
		);
	}
	const subscriptions = [
		showTutorial.subscribe(updateHighlight),
		tutorialStep.subscribe(updateHighlight)
	];
	return {
		update(next: number | null) {
			step = next;
			updateHighlight();
		},
		destroy() {
			subscriptions.forEach((unsubscribe) => unsubscribe());
			node.removeAttribute('data-tutorial-active');
		}
	};
}
