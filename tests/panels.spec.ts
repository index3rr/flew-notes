import { test, expect } from '@playwright/test';
import { compareSpeech } from '../src/lib/models/transcript';

async function settings(
	page: import('@playwright/test').Page,
	values: Record<string, number | boolean>,
	version = 2
) {
	await page.addInitScript(
		({ values, version }) => {
			if (localStorage.getItem('settings')) return;
			localStorage.setItem(
				'settings',
				JSON.stringify({ isSettings: true, version, settings: { telemetryTier: 0, ...values } })
			);
		},
		{ values, version }
	);
}

test('legacy visible notes migrate to the right and survive reload', async ({ page }) => {
	await settings(page, { showSideDoc: true, tabsPanel: 1, timersPanel: 0 }, 1);
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.right-sidebar')).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('settings')!).version))
		.toBe(2);
	await page.reload();
	await expect(page.locator('.right-sidebar')).toBeVisible();
});

test('collapsed panels expand one at a time and keep timer state', async ({ page }) => {
	await settings(page, { timersPanel: 3, transcriptPanel: 3, notesPanel: 0 });
	await page.goto('/app');
	await expect(page.locator('.timer-panel')).not.toBeVisible();
	await page.getByRole('button', { name: 'Timers', exact: true }).click();
	await expect(page.locator('.timer-panel')).toBeVisible();
	const minutes = page.locator('.timer-panel input').first();
	await minutes.fill('2');
	await minutes.press('Tab');
	await page.getByRole('button', { name: 'Transcript', exact: true }).click();
	await expect(page.locator('.timer-panel')).not.toBeVisible();
	await expect(page.getByRole('button', { name: 'Start transcription' })).toBeVisible();
	await page.getByRole('button', { name: 'Timers', exact: true }).click();
	await expect(minutes).toHaveValue('02');
});

test('right collapsed panels provide their tray and permanent timers show without a toggle', async ({
	page
}) => {
	await settings(page, { timersPanel: 1, collaborationPanel: 4, notesPanel: 0 });
	await page.goto('/app');
	await expect(page.locator('.timer-panel')).toBeVisible();
	await page.getByRole('button', { name: 'Collaboration', exact: true }).click();
	await page
		.getByRole('textbox', { name: 'Message your partner' })
		.fill('Please answer this argument');
	await page.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(
		page.getByText('Connect to a partner using Share before sending a message.')
	).toBeVisible();
});

test('document comparison flags new claims and tolerates capitalization', () => {
	expect(
		compareSpeech('Economic growth solves poverty', 'Economic growth solves poverty.')
	).toEqual({ matched: true, outside: false });
	expect(
		compareSpeech('Santa outweighs every single impact', 'Economic growth solves poverty.')
	).toEqual({ matched: false, outside: true });
	expect(compareSpeech('Santa outweighs', '')).toEqual({ matched: false, outside: false });
});

test('copy and drag saved pages preserve the source', async ({ page }) => {
	const { readFile } = await import('node:fs/promises');
	const raw = await readFile('test-files/persistancy/Round.json', 'utf8');
	const data = JSON.parse(raw);
	data.nodes[data.nodes.root.children[0]].value.content = 'Source page';
	const serialized = JSON.stringify(data);
	await settings(page, { notesPanel: 0, libraryPanel: 1 });
	await page.addInitScript((raw) => {
		localStorage.setItem('flow:source', raw);
		localStorage.setItem(
			'savedFlows',
			JSON.stringify({
				'flow:source': {
					title: 'Source round',
					created: new Date().toISOString(),
					modified: new Date().toISOString(),
					flowInfos: [{ content: 'Source page', invert: false }]
				}
			})
		);
	}, serialized);
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const sourceButton = page
		.locator('.library-panel')
		.getByRole('button', { name: 'Import Source page', exact: true });
	await sourceButton.click();
	await expect(page.locator('.tabs li')).toHaveCount(2);
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('flow:source')))
		.toBe(serialized);
	// Drag creates another independent page, with fresh IDs.
	await page.evaluate(
		({ data }) => {
			const transfer = new DataTransfer();
			transfer.setData(
				'application/x-flew-page',
				JSON.stringify({ nodes: data.nodes, id: data.nodes.root.children[0] })
			);
			window.dispatchEvent(
				new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })
			);
		},
		{ data }
	);
	await expect(page.locator('.tabs li')).toHaveCount(3);
	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveCount(1);
	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
		'Original argument'
	);
});

test('expired speech selects the next speech without running it', async ({ page }) => {
	await settings(page, { notesPanel: 0, timersPanel: 1, timerAutoAdvance: true });
	await page.goto('/app');
	const timer = page.locator('.timer-panel').locator('.over + .timer');
	const inputs = timer.locator('input');
	await inputs.nth(0).fill('0');
	await inputs.nth(0).press('Tab');
	await inputs.nth(1).fill('1');
	await inputs.nth(1).press('Tab');
	await timer.getByRole('button').first().click();
	await expect(page.locator('.speech.selected')).toHaveText('CX');
	await expect(inputs.nth(0)).toHaveValue('03');
	await expect(inputs.nth(1)).toHaveValue('00');
	await expect.poll(() => timer.getByRole('button').first().locator('svg').count()).toBe(1);
	await page.waitForTimeout(1200);
	await expect(inputs.nth(1)).toHaveValue('00');
});

test('microphone capture sends PCM to local worker, flags new claims and starts only the speech timer', async ({
	page,
	browserName
}) => {
	test.skip(
		browserName !== 'chromium',
		'The deterministic microphone fixture uses Chromium Web Audio.'
	);
	await settings(page, {
		transcriptPanel: 2,
		notesPanel: 0,
		timersPanel: 1,
		timerStartOnSpeech: true
	});
	await page.addInitScript(() => {
		class LocalWorker {
			onmessage: ((event: { data: { ready?: boolean; text?: string } }) => void) | null = null;
			count = 0;
			postMessage(data: { audio?: Float32Array }) {
				if (!data.audio) {
					queueMicrotask(() => this.onmessage?.({ data: { ready: true } }));
					return;
				}
				if (!(data.audio instanceof Float32Array) || !data.audio.length)
					throw new Error('Expected PCM');
				const text =
					this.count++ === 0
						? 'Economic growth solves poverty'
						: 'Santa outweighs every single impact';
				queueMicrotask(() => this.onmessage?.({ data: { text } }));
			}
			terminate() {
				this.onmessage = null;
			}
		}
		Object.defineProperty(window, 'Worker', { value: LocalWorker });
		Object.defineProperty(navigator, 'mediaDevices', {
			value: {
				async getUserMedia() {
					const context = new AudioContext();
					const oscillator = context.createOscillator();
					const output = context.createMediaStreamDestination();
					oscillator.connect(output);
					oscillator.start();
					await context.resume();
					Object.defineProperty(window, '__transcriptTracks', {
						configurable: true,
						value: output.stream.getTracks()
					});
					return output.stream;
				}
			}
		});
	});
	await page.goto('/app');
	await page
		.getByRole('textbox', { name: 'Opponent speech document' })
		.fill('Economic growth solves poverty.');
	await page.getByRole('button', { name: 'Start transcription', exact: true }).click();
	await expect(page.locator('.entries')).toContainText('Economic growth solves poverty', {
		timeout: 15000
	});
	const timer = page.locator('.timer-panel .over + .timer');
	await expect(timer.locator('input').nth(1)).not.toHaveValue('00');
	await expect(page.locator('.entries')).toContainText('Outside document', { timeout: 15000 });
	await page.getByRole('button', { name: 'Stop', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Start transcription', exact: true })
	).toBeEnabled();
	expect(
		await page.evaluate(() =>
			(window as unknown as { __transcriptTracks: MediaStreamTrack[] }).__transcriptTracks.every(
				(track) => track.readyState === 'ended'
			)
		)
	).toBe(true);
	await expect(page.getByRole('button', { name: 'Export transcript', exact: true })).toBeEnabled();
});

test('library page drops insert before, between, and after existing tabs', async ({ page }) => {
	const { readFile } = await import('node:fs/promises');
	const source = JSON.parse(await readFile('test-files/persistancy/Round.json', 'utf8'));
	source.nodes[source.nodes.root.children[0]].value.content = 'Imported page';
	await settings(page, { notesPanel: 0, timersPanel: 0, libraryPanel: 1 });
	await page.addInitScript((source) => {
		localStorage.setItem('flow:drag-source', JSON.stringify(source));
		localStorage.setItem(
			'savedFlows',
			JSON.stringify({
				'flow:drag-source': {
					title: 'Drag source',
					created: new Date().toISOString(),
					modified: new Date().toISOString(),
					flowInfos: [{ content: 'Imported page', invert: false }]
				}
			})
		);
	}, source);
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page.getByPlaceholder('type name here').fill('First');
	await page.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
	await page.getByPlaceholder('type name here').fill('Second');
	const chip = page
		.locator('.library-panel')
		.getByRole('button', { name: 'Import Imported page', exact: true });
	await expect(chip).toHaveAttribute('draggable', 'true');
	async function dropAt(index: number, after: boolean) {
		const tab = page.locator('.tabs li').nth(index);
		await tab.hover();
		const bounds = (await tab.boundingBox())!;
		await chip.dragTo(tab, {
			targetPosition: { x: bounds.width / 2, y: bounds.height * (after ? 0.8 : 0.2) }
		});
	}

	await dropAt(0, false);
	await expect(page.locator('.tabs li button')).toHaveText(['Imported page', 'First', 'Second']);
	await dropAt(1, true);
	await expect(page.locator('.tabs li button')).toHaveText([
		'Imported page',
		'First',
		'Imported page',
		'Second'
	]);
	await dropAt(3, true);
	await expect(page.locator('.tabs li button')).toHaveText([
		'Imported page',
		'First',
		'Imported page',
		'Second',
		'Imported page'
	]);
	await expect(page.locator('.tabs .overFirst, .tabs .overSecond')).toHaveCount(0);
});

test('notes and library keep their positions and show placeholders without a flow', async ({
	page
}) => {
	await settings(page, { notesPanel: 2, libraryPanel: 1, timersPanel: 0 });
	await page.goto('/app');
	const library = page.locator('.sidebar .library-panel');
	const notes = page
		.locator('.right-sidebar')
		.getByPlaceholder('Notes are not editable when a flow is not open');
	await expect(library).toBeVisible();
	await expect(library).toHaveText('Open a flow to import pages from the library.');
	await expect(notes).toBeVisible();
	await expect(notes).toHaveAttribute('readonly', '');
	await expect(page.getByRole('button', { name: 'Notes', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Flow library', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.right-sidebar').getByPlaceholder('type notes here')).toBeEditable();
	await expect(library).not.toHaveText('Open a flow to import pages from the library.');
	await page.getByRole('button', { name: 'Close flow', exact: true }).click();
	await expect(library).toHaveText('Open a flow to import pages from the library.');
	await expect(notes).toBeVisible();
});

test('configured collapsed notes and library remain usable for viewing placeholders', async ({
	page
}) => {
	await settings(page, { notesPanel: 4, libraryPanel: 3, timersPanel: 0 });
	await page.goto('/app');
	await page.getByRole('button', { name: 'Flow library', exact: true }).click();
	await expect(page.locator('.library-panel')).toHaveText(
		'Open a flow to import pages from the library.'
	);
	await page.getByRole('button', { name: 'Notes', exact: true }).click();
	await expect(
		page.getByPlaceholder('Notes are not editable when a flow is not open')
	).toBeVisible();
});

test('flow library panel is off by default', async ({ page }) => {
	await page.goto('/app');
	await expect(page.locator('.library-panel')).toHaveCount(0);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.library-panel')).toHaveCount(0);
});
