import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'block' });

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
				JSON.stringify({
					isSettings: true,
					version,
					settings: { telemetry: 0, replaceEmptyPageOnImport: false, ...values }
				})
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
		.toBe(4);
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
		.getByRole('button', { name: 'Select Source page', exact: true });
	await sourceButton.click();
	await page
		.locator('.library-panel')
		.getByRole('button', { name: 'Add selected pages', exact: true })
		.first()
		.click();
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
		Object.assign(window, { workerCreations: 0 });
		class LocalWorker {
			constructor() {
				(window as unknown as { workerCreations: number }).workerCreations++;
			}
			onmessage:
				| ((event: { data: { ready?: boolean; text?: string; requestId?: string } }) => void)
				| null = null;
			count = 0;
			postMessage(data: { audio?: Float32Array; requestId?: string }) {
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
				queueMicrotask(() => {
					this.onmessage?.({
						data: { text: 'Old recording result', requestId: data.requestId + '-stale' }
					});
					this.onmessage?.({ data: { text, requestId: data.requestId } });
				});
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
	await expect(page.locator('.entries .outside')).toContainText('Santa', { timeout: 15000 });
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
	await page
		.getByRole('textbox', { name: 'Opponent speech document' })
		.fill('Santa outweighs every single impact.');
	await expect(page.locator('.entries .outside')).toContainText('Santa');
	await expect(page.locator('.entries')).not.toContainText('Economic growth solves poverty');
	await page.getByRole('button', { name: 'Start transcription', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Stop', exact: true }).click();
	expect(
		await page.evaluate(() => (window as unknown as { workerCreations: number }).workerCreations)
	).toBe(1);
	await expect(page.locator('.entries')).not.toContainText('Old recording result');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const analytic = page.locator('.entries .outside').first();
	const text = (await analytic.locator('.text').textContent())!.trim();
	await analytic.dragTo(page.locator('.flow [data-box-id]').first());
	await expect(page.locator('.flow textarea')).toHaveCount(1);
	await expect(page.locator('.flow textarea').first()).toHaveValue(text);
	await page.keyboard.press('Control+z');
	await expect(page.locator('.flow textarea').first()).toHaveValue('');
	await page.locator('.flow textarea').first().fill('Answer this argument');
	await analytic.dragTo(page.locator('.flow [data-box-id]').first());
	await expect(page.locator('.flow textarea')).toHaveCount(2);
	await expect(page.locator('.flow textarea').last()).toHaveValue(text);
	await page.keyboard.press('Control+z');
	await expect(page.locator('.flow textarea')).toHaveCount(1);
	await expect(page.locator('.flow textarea').first()).toHaveValue('Answer this argument');
	await expect(analytic).toContainText(text);
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
	const focusedTitle = page.locator('.title textarea:focus');
	await focusedTitle.fill('First');
	await page.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
	await focusedTitle.fill('Second');
	const chip = page
		.locator('.library-panel .flow.compact')
		.filter({ has: page.getByText('Drag source', { exact: true }) })
		.getByRole('button', { name: 'Select Imported page', exact: true });
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
	await expect(library.locator('.library-panel')).toBeVisible();
	await expect(notes).toBeVisible();
	await expect(page.getByRole('button', { name: 'Notes', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Flow library', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.right-sidebar').getByPlaceholder('type notes here')).toBeEditable();
	await expect(library.locator('.panel-placeholder')).toHaveCount(0);
	await page.getByRole('button', { name: 'Close flow', exact: true }).click();
	await expect(library.locator('.library-panel')).toBeVisible();
	await expect(notes).toBeVisible();
});

test('configured collapsed notes and library remain usable for viewing placeholders', async ({
	page
}) => {
	await settings(page, { notesPanel: 4, libraryPanel: 3, timersPanel: 0 });
	await page.goto('/app');
	await page.getByRole('button', { name: 'Flow library', exact: true }).click();
	await expect(page.locator('[data-panel="libraryPanel"] .library-panel')).toBeVisible();
	await page.getByRole('button', { name: 'Notes', exact: true }).click();
	await expect(page.locator('[data-panel="notesPanel"] .panel-placeholder')).toHaveText('Notes');
});

test('flow library panel is off by default', async ({ page }) => {
	await page.goto('/app');
	await page.getByRole('button', { name: 'skip tutorial', exact: true }).click();
	await expect(page.locator('.library-panel')).toHaveCount(0);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.library-panel')).toHaveCount(0);
});

for (const side of ['left', 'right'] as const) {
	test(`document panels show only compact placeholders on the ${side} without a flow`, async ({
		page
	}) => {
		const position = side === 'left' ? 1 : 2;
		const ids = ['notesPanel', 'starredPanel'] as const;
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
			await expect(panel.getByRole('button', { name: /Open a flow for/ })).toHaveCount(0);
		}
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		await expect(container.getByPlaceholder('type notes here')).toBeEditable();

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

test('deleting the last page shows creation choices and can be undone', async ({ page }) => {
	await settings(page, { notesPanel: 0, timersPanel: 0 });
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page.locator('.flow .box textarea').first().fill('Restore this argument');
	await page.locator('.title').getByRole('button').click();
	await expect(page.locator('.empty-document')).toBeVisible();
	const emptyBounds = await page.locator('.empty-flow').boundingBox();
	const sidebarBounds = await page.locator('.sidebar').boundingBox();
	expect(emptyBounds!.y).toBeCloseTo(sidebarBounds!.y, 0);
	expect(emptyBounds!.height).toBeCloseTo(sidebarBounds!.height, 0);
	await page.keyboard.press('Control+z');
	await expect(page.locator('.flow .box textarea').first()).toHaveValue('Restore this argument');
});

test('Autoflow loads a local DOCX and accepts document drops without navigating away', async ({
	page
}) => {
	await settings(page, { autoflowPanel: 2, notesPanel: 0, timersPanel: 0, transcriptPanel: 1 });
	await page.goto('/app');
	const panel = page.locator('[data-panel="autoflowPanel"]');
	await panel.locator('input[type=file]').setInputFiles('test-files/autoflow/headings.docx');
	await expect(panel.locator('.blocks .panel-row')).not.toHaveCount(0, { timeout: 15000 });
	await expect(panel.getByRole('alert')).toHaveCount(0);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await panel
		.locator('.blocks [draggable=true]')
		.first()
		.dragTo(page.locator('.flow [data-box-id]').first());
	await expect(page.locator('.flow .box textarea').first()).not.toHaveValue('');
	await page.keyboard.press('Control+z');
	const blocks = panel.locator('.blocks .panel-row .content');
	await blocks.first().click();
	await blocks.nth(1).click({ modifiers: ['Shift'] });
	await panel
		.locator('.blocks [draggable=true]')
		.first()
		.dragTo(page.locator('.flow [data-box-id]').first());
	await expect(page.locator('.flow .box textarea')).toHaveCount(3);
});

for (const side of [1, 2, 3, 4])
	test(`Autoflow is available at panel position ${side} without an open flow`, async ({ page }) => {
		await settings(page, { autoflowPanel: side, notesPanel: 0, timersPanel: 0 });
		await page.goto('/app');
		if (side >= 3) await page.getByRole('button', { name: 'Autoflow', exact: true }).click();
		await expect(page.locator('[data-panel="autoflowPanel"]')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Autoflow menu', exact: true })).toBeEnabled();
	});

test('SpeechDrop uploads and deletes files and drags a reference document into Transcript', async ({
	page
}) => {
	await settings(page, { speechDropPanel: 1, transcriptPanel: 2, notesPanel: 0, timersPanel: 0 });
	let removed = false,
		uploaded = false,
		dropped = false;
	await page.route('**/api/speechdrop/roomABC', async (route) => {
		if (route.request().method() === 'POST') {
			uploaded = route.request().postDataBuffer()?.includes(Buffer.from('new.txt')) ?? false;
			dropped ||= route.request().postDataBuffer()?.includes(Buffer.from('dropped.txt')) ?? false;
			await route.fulfill({ json: { ok: true } });
			return;
		}
		await route.fulfill({ json: { files: removed ? [] : [{ index: 0, name: 'speech.txt' }] } });
	});
	await page.route('**/api/speechdrop/roomABC/0', async (route) => {
		if (route.request().method() === 'DELETE') {
			removed = true;
			await route.fulfill({ json: { ok: true } });
		} else await route.fulfill({ body: 'Economic growth solves poverty.' });
	});
	await page.goto('/app');
	await page.getByRole('textbox', { name: 'SpeechDrop room code' }).fill('roomABC');
	await expect(
		page.locator('.speechdrop-panel').getByRole('button', { name: 'speech.txt', exact: true })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Use for transcript', exact: true })).toHaveCount(
		0
	);
	await page.locator('.speechdrop-panel li').dragTo(page.locator('.transcript'));
	await expect(page.getByRole('textbox', { name: 'Opponent speech document' })).toHaveValue(
		'Economic growth solves poverty.'
	);
	await page
		.locator('.speechdrop-panel input[type=file]')
		.setInputFiles({ name: 'new.txt', mimeType: 'text/plain', buffer: Buffer.from('New upload') });
	await expect.poll(() => uploaded).toBe(true);
	await page.locator('.speechdrop-panel').evaluate((element) => {
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(new File(['Dropped upload'], 'dropped.txt', { type: 'text/plain' }));
		element.dispatchEvent(
			new DragEvent('dragover', { dataTransfer, bubbles: true, cancelable: true })
		);
		element.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
	});
	await expect.poll(() => dropped).toBe(true);

	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Delete file', exact: true }).click();
	await expect(page.locator('.speechdrop-panel')).toContainText('This room has no files.');
});

test('multiple library pages drop as responses in a populated cell and replace a blank cell', async ({
	page
}) => {
	await settings(page, { libraryPanel: 1, notesPanel: 0, timersPanel: 0 });
	await page.addInitScript(() => {
		const source = {
			version: 1,
			nodes: {
				root: {
					value: { tag: 'root' },
					level: -1,
					parent: null,
					children: ['source-aff', 'source-neg']
				},
				'source-aff': {
					value: {
						tag: 'flow',
						content: 'First source',
						invert: false,
						columns: ['AC', 'NC', 'AR']
					},
					level: 0,
					parent: 'root',
					children: ['source-a']
				},
				'source-neg': {
					value: {
						tag: 'flow',
						content: 'Second source',
						invert: true,
						columns: ['NC', 'AR', 'NR']
					},
					level: 0,
					parent: 'root',
					children: ['source-b']
				},
				'source-a': {
					value: { tag: 'box', content: 'Source argument A', flowId: 'source-aff' },
					level: 1,
					parent: 'source-aff',
					children: []
				},
				'source-b': {
					value: { tag: 'box', content: 'Source argument B', flowId: 'source-neg' },
					level: 1,
					parent: 'source-neg',
					children: []
				}
			}
		};
		localStorage.setItem('flow:library-multi', JSON.stringify(source));
		localStorage.setItem(
			'savedFlows',
			JSON.stringify({
				'flow:library-multi': {
					title: 'Multi source',
					created: new Date().toISOString(),
					modified: new Date().toISOString(),
					flowInfos: [
						{ content: 'First source', invert: false },
						{ content: 'Second source', invert: true }
					]
				}
			})
		);
	});
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const first = page.getByRole('button', { name: 'Select First source', exact: true }),
		second = page.getByRole('button', { name: 'Select Second source', exact: true });
	await first.click({ modifiers: ['Control'] });
	await second.click({ modifiers: ['Control'] });
	await expect(first).toHaveAttribute('aria-pressed', 'true');
	await expect(second).toHaveAttribute('aria-pressed', 'true');
	const cells = page.locator('.flow .box textarea');
	await cells.first().fill('Target');
	await first.dragTo(page.locator('.flow [data-box-id]').first());
	await expect(cells).toHaveCount(3);
	expect(
		await cells.evaluateAll((elements) => elements.map((el) => (el as HTMLTextAreaElement).value))
	).toEqual(['Target', 'Source argument A', 'Source argument B']);
	await page.keyboard.press('Control+z');
	await expect(cells).toHaveCount(1);
	await cells.first().fill('');
	await first.dragTo(page.locator('.flow [data-box-id]').first());
	await expect(cells).toHaveCount(2);
	await expect(cells.first()).toHaveValue('Source argument A');
});

test('SpeechDrop optionally appends the promo to the uploaded DOCX copy', async ({ page }) => {
	const { default: JSZip } = await import('jszip');
	const { readFile } = await import('node:fs/promises');
	const { promoFooter } = await import('../src/lib/models/speechDropPromo');
	await settings(page, {
		speechDropPanel: 1,
		speechDropPromo: true,
		notesPanel: 0,
		timersPanel: 0
	});
	// WebKit's network debugging protocol omits multipart file bytes. Inspect the actual
	// File submitted to fetch, then let the mocked server acknowledge that same request.
	await page.addInitScript(() => {
		const fetcher = window.fetch.bind(window);
		window.fetch = async (input, init) => {
			if (
				typeof input === 'string' &&
				input.includes('/api/speechdrop/promoRoom') &&
				init?.body instanceof FormData
			) {
				const file = init.body.get('file');
				if (file instanceof File)
					Object.assign(window, {
						__uploadedDocx: Array.from(new Uint8Array(await file.arrayBuffer()))
					});
			}
			return fetcher(input, init);
		};
	});
	await page.route('**/api/speechdrop/promoRoom', (route) =>
		route.fulfill({ json: route.request().method() === 'POST' ? { ok: true } : { files: [] } })
	);
	await page.goto('/app');
	await page.getByLabel('SpeechDrop room code').fill('promoRoom');
	await expect(page.locator('.speechdrop-panel')).toContainText('This room has no files.');
	await page.getByRole('button', { name: 'SpeechDrop menu', exact: true }).click();
	await expect(page.getByRole('menuitem', { name: 'Upload files', exact: true })).toBeEnabled();
	await page.keyboard.press('Escape');
	await page
		.locator('.speechdrop-panel input[type=file]')
		.setInputFiles('test-files/autoflow/headings.docx');
	await expect
		.poll(() =>
			page.evaluate(
				() => (window as unknown as { __uploadedDocx?: number[] }).__uploadedDocx?.length ?? 0
			)
		)
		.toBeGreaterThan(0);
	const bytes = await page.evaluate(
		() => (window as unknown as { __uploadedDocx: number[] }).__uploadedDocx
	);
	const uploaded = await JSZip.loadAsync(Uint8Array.from(bytes));
	expect(await uploaded.file('word/document.xml')!.async('string')).toContain(promoFooter);
	const original = await JSZip.loadAsync(await readFile('test-files/autoflow/headings.docx'));
	expect(await original.file('word/document.xml')!.async('string')).not.toContain(promoFooter);
});

test('Transcript defaults to microphone controls without the explanatory paragraph', async ({
	page
}) => {
	await settings(page, { transcriptPanel: 2, notesPanel: 0, timersPanel: 0 });
	await page.goto('/app');
	await expect(
		page.getByRole('button', { name: 'Start transcription', exact: true })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Transcribe tab audio', exact: true })).toHaveCount(
		0
	);
	await expect(page.locator('.transcript')).not.toContainText('Transcribes on this device.');
});

test('each panel has its own settings section and saved audio controls still override the new default', async ({
	page
}) => {
	await settings(page, { transcriptPanel: 2, transcriptSource: 2, notesPanel: 0, timersPanel: 0 });
	await page.goto('/app');
	await expect(
		page.getByRole('button', { name: 'Transcribe tab audio', exact: true })
	).toBeVisible();
	await page.locator('.header button').nth(1).click();
	const groups = page.locator('.settings > ul > li.title h1');
	for (const name of [
		'Tabs',
		'Notes',
		'Coverage',
		'Starred arguments',
		'SpeechDrop',
		'Autoflow',
		'Timers',
		'Flow library',
		'Transcript',
		'Collaboration',
		'CardMirror'
	])
		await expect(groups.filter({ hasText: new RegExp('^' + name + '$') })).toHaveCount(1);
	const transcript = page.locator('.settings > ul > div').filter({
		has: page.getByRole('heading', { name: 'Transcription audio controls', exact: true })
	});
	await expect(transcript).toBeVisible();
});

test('Coverage filters dropped and extended arguments independently and extends with the short label', async ({
	page
}) => {
	await settings(page, { coveragePanel: 2, timersPanel: 0, notesPanel: 0, transitionSpeed: 0 });
	await page.goto('/app');
	const data = {
		version: 1,
		nodes: {
			root: { value: { tag: 'root' }, level: -1, parent: null, children: ['flow-a'] },
			'flow-a': {
				value: { tag: 'flow', content: 'Advantage', invert: false, columns: ['1AC', '1NC', '2AC'] },
				level: 0,
				parent: 'root',
				children: ['a', 'b']
			},
			a: {
				value: { tag: 'box', content: 'Costs are low', flowId: 'flow-a' },
				level: 1,
				parent: 'flow-a',
				children: []
			},
			b: {
				value: { tag: 'box', content: 'Plan solves', flowId: 'flow-a' },
				level: 1,
				parent: 'flow-a',
				children: []
			}
		}
	};
	await page.locator('#uploadId').setInputFiles({
		name: 'Coverage.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(data))
	});
	const panel = page.locator('.coverage-panel');
	await panel.getByRole('button', { name: '2AC', exact: true }).click();
	await expect(panel.locator('.tag')).toHaveText(['dropped', 'dropped']);
	await panel.getByRole('button', { name: 'Extend', exact: true }).first().click();
	await expect(panel.locator('.tag')).toHaveText(['extended', 'dropped']);
	await expect(page.locator('.flow textarea').nth(2)).toHaveValue('dropped');
	await page.getByRole('button', { name: 'Coverage menu', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
	const option = (name: string) =>
		page
			.locator('.settings > ul > div')
			.filter({ has: page.getByRole('heading', { name, exact: true }) })
			.locator('label');
	await option('Show extended arguments').click();
	await page.keyboard.press('Escape');
	await expect(panel.locator('.tag')).toHaveText(['dropped']);
	await page.getByRole('button', { name: 'Coverage menu', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
	await option('Show extended arguments').click();
	await option('Show dropped arguments').click();
	await page.keyboard.press('Escape');
	await expect(panel.locator('.tag')).toHaveText(['extended']);
	const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('settings')!));
	expect(saved.settings.coverageShowDropped).toBe(false);
});

async function dragThroughIcon(
	page: import('@playwright/test').Page,
	source: import('@playwright/test').Locator,
	icon: import('@playwright/test').Locator,
	target: import('@playwright/test').Locator
) {
	await source.scrollIntoViewIfNeeded();
	const start = await source.boundingBox(),
		hover = await icon.boundingBox();
	if (!start || !hover) throw new Error('Missing drag source or tray icon');
	// Start cell drags in their padding; textarea interiors retain native text selection.
	const startX = (await source.getAttribute('data-box-id'))
		? start.x + 2
		: start.x + start.width / 2;
	await page.mouse.move(startX, start.y + start.height / 2);
	await page.mouse.down();
	await page.mouse.move(hover.x + hover.width / 2, hover.y + hover.height / 2, { steps: 20 });
	await expect(target).toBeVisible();
	const end = await target.boundingBox();
	if (!end) throw new Error('Panel did not expand');
	await page.mouse.move(end.x + end.width / 2, end.y + Math.min(end.height / 2, 60), { steps: 10 });
	await page.mouse.up();
}

for (const position of [3, 4])
	test(`SpeechDrop drag opens the collapsed Transcript on side ${position} and loads its reference`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 1600, height: 1000 });
		await settings(page, {
			speechDropPanel: position === 3 ? 2 : 1,
			transcriptPanel: position,
			timersPanel: 0,
			notesPanel: 0,
			coveragePanel: 0,
			transitionSpeed: 0
		});
		await page.route('**/api/speechdrop/dragroom', (route) =>
			route.fulfill({ json: { files: [{ index: 0, name: 'speech.txt' }] } })
		);
		await page.route('**/api/speechdrop/dragroom/0', (route) =>
			route.fulfill({ body: 'Economic growth solves poverty.' })
		);
		await page.goto('/app');
		await page.getByLabel('SpeechDrop room code').fill('dragroom');
		const file = page.locator('.speechdrop-panel li');
		await expect(file).toBeVisible();
		await dragThroughIcon(
			page,
			file,
			page.getByRole('button', { name: 'Transcript', exact: true }),
			page.locator('.transcript')
		);
		await expect(page.getByLabel('Opponent speech document')).toHaveValue(
			'Economic growth solves poverty.'
		);
		await expect(page.locator('.transcript')).toContainText('Comparing with speech.txt');
	});

test('selected flow boxes reveal collapsed CardMirror and an unavailable drop closes it', async ({
	page
}) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await settings(page, {
		cardMirrorPanel: 4,
		timersPanel: 0,
		notesPanel: 0,
		coveragePanel: 0,
		transitionSpeed: 0
	});
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const cells = page.locator('.flow textarea');
	await cells.first().fill('First argument');
	await cells.first().press('Enter');
	await cells.nth(1).fill('Second argument');
	await cells.first().click({ modifiers: ['ControlOrMeta'] });
	await cells.nth(1).click({ modifiers: ['ControlOrMeta'] });
	await expect(page.locator('.flow .box.selected')).toHaveCount(2);
	await dragThroughIcon(
		page,
		page.locator('.flow [data-box-id]').first(),
		page.getByRole('button', { name: 'CardMirror', exact: true }),
		page.locator('.cardmirror-panel')
	);
	await expect(page.locator('.cardmirror-panel')).not.toBeVisible();
	await expect(page.locator('.flow .box.selected')).toHaveCount(2);
	await expect(
		page.getByRole('region', { name: 'Send to current document', exact: true })
	).toHaveCount(0);
});

test('library pages open collapsed Tabs and can be dropped to import a new page', async ({
	page
}) => {
	const { readFile } = await import('node:fs/promises');
	const data = JSON.parse(await readFile('test-files/persistancy/Round.json', 'utf8'));
	data.nodes[data.nodes.root.children[0]].value.content = 'Library source';
	await page.setViewportSize({ width: 1600, height: 1000 });
	await settings(page, {
		libraryPanel: 2,
		tabsPanel: 3,
		timersPanel: 0,
		notesPanel: 0,
		coveragePanel: 0,
		transitionSpeed: 0
	});
	await page.addInitScript((data) => {
		localStorage.setItem('flow:drag-source', JSON.stringify(data));
		localStorage.setItem(
			'savedFlows',
			JSON.stringify({
				'flow:drag-source': {
					title: 'Saved source',
					created: new Date().toISOString(),
					modified: new Date().toISOString(),
					flowInfos: [{ content: 'Library source', invert: false }]
				}
			})
		);
	}, data);
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await dragThroughIcon(
		page,
		page.getByRole('button', { name: 'Select Library source', exact: true }),
		page.getByRole('button', { name: 'Tabs', exact: true }),
		page.locator('.tabs')
	);
	await expect(page.locator('.tabs li')).toHaveCount(2);
	await expect(page.locator('.tabs')).toContainText('Library source');
});

for (const initial of ['default', 'granted'] as const)
	test(`partner notification permission ${initial} hides the enable button once granted and tests new permission once`, async ({
		page
	}) => {
		await settings(page, {
			collaborationPanel: 3,
			timersPanel: 0,
			notesPanel: 0,
			coveragePanel: 0
		});
		await page.addInitScript((initial) => {
			const notices: string[] = [];
			Object.assign(window, { testNotices: notices });
			class TestNotification {
				static permission = initial as NotificationPermission;
				static async requestPermission() {
					this.permission = 'granted';
					return 'granted';
				}
				constructor(title: string, options: { body: string }) {
					notices.push(title + ': ' + options.body);
				}
				close() {
					return undefined;
				}
			}
			Object.defineProperty(window, 'Notification', {
				value: TestNotification,
				configurable: true
			});
		}, initial);
		await page.goto('/app');
		await page.getByRole('button', { name: 'Collaboration', exact: true }).click();
		await page.getByRole('button', { name: 'Collaboration menu', exact: true }).click();
		const enable = page.getByRole('menuitem', {
			name: 'Enable partner notifications',
			exact: true
		});
		if (initial === 'default') await enable.click();
		else await page.keyboard.press('Escape');
		await expect(enable).toHaveCount(0);
		expect(
			await page.evaluate(() => (window as unknown as { testNotices: string[] }).testNotices)
		).toEqual(initial === 'default' ? ['Flew Notes: Partner notifications enabled.'] : []);
		await page.getByRole('button', { name: 'Collaboration', exact: true }).click();
		await page.getByRole('button', { name: 'Collaboration', exact: true }).click();
		await expect(enable).toHaveCount(0);
		expect(
			await page.evaluate(() => (window as unknown as { testNotices: string[] }).testNotices.length)
		).toBe(initial === 'default' ? 1 : 0);
	});

for (const colorTheme of [1, 2, 3])
	test(`panel settings and collapsed trays fit theme ${colorTheme} with larger controls`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 1600, height: 1100 });
		await settings(page, {
			colorTheme,
			accentHue: 55,
			accentSecondaryHue: 265,
			fontSize: 1.4,
			padding: 12,
			buttonSize: 28,
			borderRadius: 24,
			transitionSpeed: 0,
			sidebarWidth: 360,
			panelWidth: 360,
			coveragePanel: 2,
			transcriptPanel: 2,
			speechDropPanel: 1,
			autoflowPanel: 3,
			collaborationPanel: 4,
			cardMirrorPanel: 4,
			libraryPanel: 4,
			timersPanel: 0,
			notesPanel: 0
		});
		await page.goto('/app');
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		for (const side of ['.sidebar', '.right-sidebar']) {
			const column = page.locator(side + ' .panel-container');
			expect(await column.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
		}
		await page.getByRole('button', { name: 'Coverage menu', exact: true }).click();
		await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
		await expect(
			page
				.locator('.settings > ul > li.title')
				.filter({ has: page.getByRole('heading', { name: 'Coverage', exact: true }) })
		).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Show extended arguments', exact: true })
		).toBeVisible();
		await page.keyboard.press('Escape');
	});
