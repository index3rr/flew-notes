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
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page.getByRole('button', { name: 'Collaboration', exact: true }).click();
	await page.getByRole('button', { name: 'Enable collaboration', exact: true }).click();
	await page.getByRole('button', { name: 'host new room', exact: true }).click();
	await page.locator('.upper > .element > .top').click();
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
					const gate = context.createGain();
					const output = context.createMediaStreamDestination();
					// Bursts of tone with pauses, so the segmenter sees utterances to cut.
					for (let second = 0; second < 120; second += 2)
						gate.gain
							.setValueAtTime(0.5, context.currentTime + second)
							.setValueAtTime(0, context.currentTime + second + 1.2);
					oscillator.connect(gate).connect(output);
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
	const library = page.locator('.sidebar [data-panel="libraryPanel"]');
	const notes = page.locator('.right-sidebar [data-panel="notesPanel"] .panel-placeholder');
	await expect(library).toBeVisible();
	await expect(library.locator('.panel-placeholder')).toHaveText('Flow library');
	await expect(notes).toBeVisible();
	await expect(page.getByRole('button', { name: 'Notes', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Flow library', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.right-sidebar').getByPlaceholder('type notes here')).toBeEditable();
	await expect(library.locator('.panel-placeholder')).toHaveCount(0);
	await page.getByRole('button', { name: 'Close flow', exact: true }).click();
	await expect(library.locator('.panel-placeholder')).toHaveText('Flow library');
	await expect(notes).toBeVisible();
});

test('configured collapsed notes and library remain usable for viewing placeholders', async ({
	page
}) => {
	await settings(page, { notesPanel: 4, libraryPanel: 3, timersPanel: 0 });
	await page.goto('/app');
	await page.getByRole('button', { name: 'Flow library', exact: true }).click();
	await expect(page.locator('[data-panel="libraryPanel"] .panel-placeholder')).toHaveText(
		'Flow library'
	);
	await page.getByRole('button', { name: 'Notes', exact: true }).click();
	await expect(page.locator('[data-panel="notesPanel"] .panel-placeholder')).toHaveText('Notes');
});

test('flow library panel is off by default', async ({ page }) => {
	await page.goto('/app');
	await expect(page.locator('.library-panel')).toHaveCount(0);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.library-panel')).toHaveCount(0);
});

for (const side of ['left', 'right'] as const) {
	test(`document panels show only compact placeholders on the ${side} without a flow`, async ({
		page
	}) => {
		const position = side === 'left' ? 1 : 2;
		const ids = ['libraryPanel', 'notesPanel', 'starredPanel', 'collaborationPanel'] as const;
		await settings(page, {
			...Object.fromEntries(ids.map((id) => [id, position])),
			timersPanel: 0
		});
		await page.goto('/app');
		const container = page.locator(side === 'left' ? '.sidebar' : '.right-sidebar');
		for (const id of ids) {
			const panel = container.locator(`[data-panel="${id}"]`);
			await expect(panel.locator('.panel-placeholder')).toHaveText(
				{
					libraryPanel: 'Flow library',
					notesPanel: 'Notes',
					starredPanel: 'Starred arguments',
					collaborationPanel: 'Collaboration'
				}[id]!
			);
			// The card holds only the name: its content box is exactly the placeholder.
			const size = await panel.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					panel:
						element.getBoundingClientRect().height -
						parseFloat(style.paddingTop) -
						parseFloat(style.paddingBottom),
					text: element.querySelector('.panel-placeholder')!.getBoundingClientRect().height
				};
			});
			expect(Math.abs(size.panel - size.text)).toBeLessThan(1);
			await expect(panel.locator('textarea, input, button')).toHaveCount(0);
			await panel.locator('.panel-placeholder').hover();
			await expect(panel.getByText('No flow is open.', { exact: true })).toBeVisible();
			await page.mouse.move(0, 0);
		}
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		await expect(container.getByPlaceholder('type notes here')).toBeEditable();
		await expect(
			container.getByRole('button', { name: 'Enable collaboration', exact: true })
		).toBeVisible();
		for (const id of ['libraryPanel', 'notesPanel']) {
			await expect(container.locator(`[data-panel="${id}"]`)).not.toHaveClass(/auto-size/);
		}
		await page.getByRole('button', { name: 'Close flow', exact: true }).click();
		for (const id of ids)
			await expect(container.locator(`[data-panel="${id}"] .panel-placeholder`)).toBeVisible();
	});
}

for (const side of ['left', 'right'] as const) {
	test(`collapsed panels add no empty card on the ${side}`, async ({ page }) => {
		const position = side === 'left' ? 1 : 2;
		await settings(page, {
			tabsPanel: position + 2,
			speechDropPanel: position,
			notesPanel: 0,
			timersPanel: 0,
			libraryPanel: 0,
			coveragePanel: 0
		});
		await page.goto('/app');
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		const container = page.locator(
			side === 'left' ? '.sidebar .panel-container' : '.right-sidebar .panel-container'
		);
		const cards = container.locator('.panel:visible');
		await expect(container.locator('.speechdrop-panel')).toBeVisible();
		// SpeechDrop and the tray of collapsed buttons.
		await expect(cards).toHaveCount(2);
		await container.getByRole('button', { name: 'Tabs', exact: true }).click();
		await expect(container.locator('.tabs')).toBeVisible();
		await expect(cards).toHaveCount(3);
		await container.getByRole('button', { name: 'Tabs', exact: true }).click();
		await expect(container.locator('.tabs')).not.toBeVisible();
		await expect(cards).toHaveCount(2);
		await page.evaluate(() => {
			const saved = JSON.parse(localStorage.getItem('settings')!);
			saved.settings.tabsPanel = 0;
			localStorage.setItem('settings', JSON.stringify(saved));
		});
		await page.reload();
		await expect(container.locator('.speechdrop-panel')).toBeVisible();
		await expect(cards).toHaveCount(1);
	});
}

test('switching starred notes preserves both edits and starred links reveal folded ancestors', async ({
	page
}) => {
	await settings(page, { starredPanel: 1, timersPanel: 0, notesPanel: 0 });
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const cells = page.locator('.box textarea');
	await cells.first().fill('Case advantage');
	await page.getByRole('button', { name: 'Toggle starred argument', exact: true }).click();
	await cells.first().press('Shift+Enter');
	await cells.nth(1).fill('Their response');
	await page.getByRole('button', { name: 'Toggle starred argument', exact: true }).click();
	const notes = page.getByLabel('Note for starred argument');
	await expect(notes).toHaveCount(2);
	await notes.first().fill('Partner covers the case');
	await notes.nth(1).fill('I cover this response');
	await cells.first().press('Control+l');
	await expect(page.locator('.children.isFolded')).toHaveCount(1);
	await page
		.locator('.starred-panel')
		.getByRole('button', { name: 'Their response', exact: true })
		.click();
	await expect(page.locator('.children.isFolded')).toHaveCount(0);
	await expect(cells.nth(1)).toBeFocused();
	await expect(notes.first()).toHaveValue('Partner covers the case');
	await expect(notes.nth(1)).toHaveValue('I cover this response');
});
