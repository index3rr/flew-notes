import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
test.use({ serviceWorkers: 'block' });
async function setup(page: Page, values: Record<string, unknown> = {}) {
	await page.addInitScript((values) => {
		localStorage.setItem(
			'settings',
			JSON.stringify({
				isSettings: true,
				version: 3,
				settings: { telemetry: 0, transitionSpeed: 0, ...values }
			})
		);
	}, values);
	await page.goto('/app');
}
const card =
	'<div class="pmd-card"><h4 class="pmd-tag">Transit improves access</h4><p class="pmd-cite-para">Rivera 2026, transport research</p><p class="pmd-card-body">Complete <strong>evidence</strong> with <u>underlining</u> and <mark>highlighting</mark>.</p></div>';

test('fresh layout is left tabs and collapsed timers with no right sidebar', async ({ page }) => {
	await setup(page);
	await expect(page.locator('.right-sidebar')).toHaveCount(0);
	await expect(page.locator('[data-panel="tabsPanel"]')).toBeVisible();
	await expect(page.locator('.timer-panel')).not.toBeVisible();
	await page.getByRole('button', { name: 'Timers', exact: true }).click();
	await expect(page.locator('.timer-panel')).toBeVisible();
});

test('all panels share menus, tutorials and optional names', async ({ page }) => {
	await setup(page, { notesPanel: 2, timersPanel: 1 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	for (const name of ['Tabs', 'Notes', 'Timers']) {
		await page.getByRole('button', { name: name + ' menu', exact: true }).click();
		await expect(
			page.getByRole('menuitem', { name: 'How to use ' + name, exact: true })
		).toBeVisible();
		await expect(page.getByRole('menuitem', { name: 'Settings', exact: true })).toBeVisible();
		await page.getByRole('menuitem', { name: 'Hide panel name', exact: true }).click();
		await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
		await page.getByRole('menuitem', { name: 'Show panel name', exact: true }).click();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
	}
});

test('pasted CardMirror cards keep complete evidence and native drag HTML', async ({ page }) => {
	await setup(page, { timersPanel: 0 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page
		.locator('.flow textarea')
		.first()
		.evaluate((element, html) => {
			const clipboardData = new DataTransfer();
			clipboardData.setData('text/html', html);
			clipboardData.setData('text/plain', 'Transit improves access');
			const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
			Object.defineProperty(event, 'clipboardData', { value: clipboardData });
			element.dispatchEvent(event);
		}, card);
	const field = page.locator('.flow textarea').first();
	await expect(field).toHaveValue('Transit improves access\nRivera 2026, transport research');
	await expect(page.getByLabel('CardMirror card', { exact: true })).toBeVisible();
	const html = await page
		.locator('.flow [data-box-id]')
		.first()
		.evaluate((element) => {
			const dataTransfer = new DataTransfer();
			element.dispatchEvent(
				new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer })
			);
			return dataTransfer.getData('text/html');
		});
	expect(html).toContain('Complete');
	expect(html).toContain('underlining');
	expect(html).toContain('<strong>evidence</strong>');
	await page.keyboard.press('Control+z');
	await expect(page.locator('.flow textarea').first()).toHaveValue('');
});

test('Autoflow imports replace an empty page and full block text drops into Notes', async ({
	page
}) => {
	await setup(page, { timersPanel: 0, autoflowPanel: 1, notesPanel: 2 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page
		.locator('.autoflow-panel input[type=file]')
		.setInputFiles('test-files/autoflow/headings.docx');
	const block = page.locator('.autoflow-panel .blocks [draggable=true]').first();
	await expect(block).toBeVisible();
	await block.dragTo(page.getByLabel('Notes', { exact: true }));
	await expect(page.getByLabel('Notes', { exact: true })).not.toHaveValue('');
	const firstBlock = page.locator('.autoflow-panel .blocks > div').first();
	await firstBlock.getByRole('button').last().click();
	await expect(page.locator('.tabs li')).toHaveCount(1);
	await expect(page.locator('.flow textarea').first()).not.toHaveValue('');
	await page.keyboard.press('Control+z');
	await expect(page.locator('.flow textarea').first()).toHaveValue('');
});

test('flow page multi-selection deletes together and undo restores pages', async ({ page }) => {
	await setup(page, { timersPanel: 0 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
	const tabs = page.locator('.tabs li button');
	await tabs.first().click();
	await tabs.last().click({ modifiers: ['Shift'] });
	await page.getByRole('button', { name: 'Tabs menu', exact: true }).click();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('menuitem', { name: 'Delete selected pages', exact: true }).click();
	await expect(page.locator('.tabs li')).toHaveCount(0);
	await page.keyboard.press('Control+z');
	await expect(page.locator('.tabs li')).toHaveCount(2);
});

test('single-box selection mode supports dragging before editing', async ({ page }) => {
	await setup(page, { timersPanel: 0, clickToSelectBoxes: true });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const cells = page.locator('.flow textarea');
	await cells.first().fill('Move this');
	await cells.first().press('Enter');
	await cells.nth(1).fill('Target');
	await cells.first().click();
	await expect(page.locator('.flow .box.selected')).toHaveCount(1);
	await cells.first().dragTo(page.locator('.flow [data-box-id]').nth(1));
	await expect(page.locator('.flow .box:has(> [data-box-id])')).toHaveCount(2);
	await page.keyboard.press('Control+z');
	await cells.first().dblclick();
	await expect(cells.first()).toBeEditable();
});

test('selecting a speech model preloads once and panel changes keep it loaded', async ({
	page
}) => {
	await page.addInitScript(() => {
		const events: string[] = [];
		Object.assign(window, { modelEvents: events });
		class ModelWorker {
			onmessage: ((event: { data: { ready: boolean; model: string } }) => void) | null = null;
			onerror: ((event: Event) => void) | null = null;
			postMessage(data: { model?: number }) {
				events.push('load:' + data.model);
				queueMicrotask(() => this.onmessage?.({ data: { ready: true, model: 'Example' } }));
			}
			terminate() {
				events.push('terminate');
			}
		}
		Object.defineProperty(window, 'Worker', { value: ModelWorker });
	});
	await setup(page, { transcriptPanel: 2, timersPanel: 0 });
	await page.locator('.header button').nth(1).click();
	await page.getByRole('radio', { name: 'Fast', exact: true }).focus();
	await page.keyboard.press('Space');
	await expect(page.getByText('Model ready', { exact: true })).toBeVisible();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Transcript menu', exact: true }).click();
	await page.getByRole('button', { name: 'Hide panel', exact: true }).click();
	await page.keyboard.press('Escape');
	await page.locator('#uploadId').setInputFiles({
		name: 'settings.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({ isSettings: true, version: 3, settings: { transcriptPanel: 2 } })
		)
	});
	expect(
		await page.evaluate(() => (window as unknown as { modelEvents: string[] }).modelEvents)
	).toEqual(['load:1']);
	await page.locator('.header button').nth(1).click();
	await page.getByRole('radio', { name: 'Balanced', exact: true }).focus();
	await page.keyboard.press('Space');
	await expect(page.getByText('Model ready', { exact: true })).toBeVisible();
	expect(
		await page.evaluate(() => (window as unknown as { modelEvents: string[] }).modelEvents)
	).toEqual(['load:1', 'terminate', 'load:2']);
});

test('answering Coverage on another page focuses its new response', async ({ page }) => {
	await setup(page, { coveragePanel: 2, timersPanel: 0 });
	await page.locator('#uploadId').setInputFiles('test-files/tutorials/round.json');
	await page.locator('.coverage-panel').getByRole('button', { name: '1NC', exact: true }).click();
	const item = page
		.locator('.coverage-panel .panel-row')
		.filter({ hasText: 'Costs are already declining' });
	await item.getByRole('button', { name: 'Answer', exact: true }).click();
	await expect(page.locator('.flow textarea').last()).toBeFocused();
	await page.keyboard.type('Answer from Coverage');
	await expect(page.locator('.flow textarea').last()).toHaveValue('Answer from Coverage');
});

test('native text selection stays text when the pointer leaves the cell', async ({ page }) => {
	await setup(page, { timersPanel: 0 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const fields = page.locator('.flow textarea');
	await fields.first().fill('Select a few words without moving an argument.');
	await fields.first().press('Enter');
	await fields.nth(1).fill('Another argument');
	const first = await fields.first().boundingBox();
	const last = await fields.nth(1).boundingBox();
	if (!first || !last) throw new Error('Missing cell');
	await page.mouse.move(first.x + 5, first.y + first.height / 2);
	await page.mouse.down();
	await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2, { steps: 12 });
	await page.waitForFunction(() => {
		const field = document.querySelector('.flow textarea') as HTMLTextAreaElement;
		return field.selectionStart !== field.selectionEnd;
	});
	await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 12 });
	await page.mouse.up();
	await expect(page.locator('.flow .box.selected')).toHaveCount(0);
});

for (const include of [false, true])
	test(`Autoflow citations are optional (${include}) and evidence is retained`, async ({
		page
	}) => {
		await setup(page, { timersPanel: 0, autoflowPanel: 1, autoflowIncludeCites: include });
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		const docx = await JSZip.loadAsync(await readFile('test-files/autoflow/headings.docx'));
		docx.file(
			'word/document.xml',
			(await docx.file('word/document.xml')!.async('string')).replace(
				'Growth solves poverty</w:t></w:r></w:p>',
				'Growth solves poverty</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Cite"/></w:pPr><w:r><w:t>Author 2026</w:t></w:r></w:p><w:p><w:r><w:t>Complete evidence body.</w:t></w:r></w:p>'
			)
		);
		await page.locator('.autoflow-panel input').setInputFiles({
			name: 'cards.docx',
			mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			buffer: await docx.generateAsync({ type: 'nodebuffer' })
		});
		await page.locator('.autoflow-panel .blocks > div').first().getByRole('button').last().click();
		await expect(page.locator('.flow textarea').first()).toHaveValue(
			'Growth solves poverty' + (include ? '\nAuthor 2026' : '')
		);
		const html = await page
			.locator('.flow [data-box-id]')
			.first()
			.evaluate((element) => {
				const dataTransfer = new DataTransfer();
				element.dispatchEvent(
					new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer })
				);
				return dataTransfer.getData('text/html');
			});
		expect(html).toContain('Author 2026');
		expect(html).toContain('Complete evidence body.');
	});

test('a Flew paste preserves its branch when rich evidence HTML is also present', async ({
	page
}) => {
	await setup(page, { timersPanel: 0 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const payload = {
		tag: 'flew-notes-boxes',
		version: 1,
		boxes: [
			{
				value: { content: 'Parent', bold: true, starred: true },
				children: [{ value: { content: 'Child response' }, children: [] }]
			}
		]
	};
	await page
		.locator('.flow textarea')
		.first()
		.evaluate(
			(element, { payload, card }) => {
				const clipboardData = new DataTransfer();
				clipboardData.setData('text/plain', JSON.stringify(payload));
				clipboardData.setData('text/html', card);
				const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
				Object.defineProperty(event, 'clipboardData', { value: clipboardData });
				element.dispatchEvent(event);
			},
			{ payload, card }
		);
	await expect(page.locator('.flow textarea')).toHaveCount(2);
	await expect(page.locator('.flow textarea').first()).toHaveValue('Parent');
	await expect(page.locator('.flow textarea').last()).toHaveValue('Child response');
	await expect(page.locator('.flow .box .bold')).toHaveCount(1);
	await expect(page.getByLabel('Starred argument', { exact: true })).toHaveCount(1);
});

test('malformed structured clipboard data cannot break cell editing', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await setup(page, { timersPanel: 0 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	for (const text of [
		'null',
		'{"tag":"flew-notes-boxes","version":1}',
		'{"tag":"flew-notes-boxes","version":1,"boxes":[null]}'
	]) {
		await page
			.locator('.flow textarea')
			.first()
			.evaluate((element, text) => {
				const clipboardData = new DataTransfer();
				clipboardData.setData('text/plain', text);
				const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
				Object.defineProperty(event, 'clipboardData', { value: clipboardData });
				element.dispatchEvent(event);
			}, text);
	}
	await page.locator('.flow textarea').first().fill('Still editable');
	await page.locator('.flow textarea').first().press('Enter');
	await expect(page.locator('.flow textarea')).toHaveCount(2);
	expect(errors).toEqual([]);
});

test('panel tutorials guide real use in a temporary card without videos', async ({ page }) => {
	await setup(page, { notesPanel: 2, timersPanel: 0 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page.getByRole('button', { name: 'Notes menu', exact: true }).click();
	await page.getByRole('menuitem', { name: 'How to use Notes', exact: true }).click();
	const tutorial = page.getByRole('region', { name: 'Notes tutorial', exact: true });
	await expect(tutorial).toBeVisible();
	await expect(page.locator('video')).toHaveCount(0);
	await expect(page.locator('[data-panel=notesPanel]')).toHaveAttribute(
		'data-panel-tutorial-active',
		''
	);
	await expect(tutorial.getByRole('button', { name: 'back', exact: true })).toBeDisabled();
	await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Practice round notes');
	await tutorial.getByRole('button', { name: 'next', exact: true }).click();
	await expect(tutorial.getByRole('button', { name: 'back', exact: true })).toBeEnabled();
	await tutorial.getByRole('button', { name: 'next', exact: true }).click();
	await tutorial.getByRole('button', { name: 'finish', exact: true }).click();
	await expect(tutorial).toHaveCount(0);
	await expect(page.locator('.tutorial-card')).toHaveCount(0);
	await expect(page.locator('[data-panel-tutorial-active]')).toHaveCount(0);
	await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(
		'Practice round notes'
	);
});

test('a long tooltip keeps its size while the pointer moves', async ({ page }) => {
	await setup(page, { timersPanel: 0, coveragePanel: 2 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const button = page.locator('.coverage-panel .panel-header .name');
	await button.hover();
	const tooltip = page.locator('.tooltip').filter({ hasText: 'what the selected speech' }).first();
	await expect(tooltip).toBeVisible();
	const before = await tooltip.boundingBox();
	const bounds = await button.boundingBox();
	if (!before || !bounds) throw new Error('Missing tooltip');
	await page.mouse.move(bounds.x + 2, bounds.y + 2);
	await page.mouse.move(bounds.x + bounds.width - 2, bounds.y + bounds.height - 2, { steps: 15 });
	const after = await tooltip.boundingBox();
	expect(after?.width).toBeCloseTo(before.width, 0);
	expect(after?.height).toBeCloseTo(before.height, 0);
});

for (const side of [1, 2]) {
	test(`menu-only panels reclaim the title row on side ${side}`, async ({ page }) => {
		await setup(page, {
			tabsPanel: side,
			timersPanel: side,
			notesPanel: side,
			coveragePanel: side,
			speechDropPanel: side,
			transcriptPanel: side,
			sidebarWidth: 300,
			panelWidth: 300
		});
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		for (const [id, name, content] of [
			['tabsPanel', 'Tabs', '.tabScroll li:first-child'],
			['timersPanel', 'Timers', '.timer > :first-child'],
			['notesPanel', 'Notes', '.document'],
			['coveragePanel', 'Coverage', '.speeches'],
			['speechDropPanel', 'SpeechDrop', '.panel-leading'],
			['transcriptPanel', 'Transcript', '.panel-controls']
		]) {
			const panel = page.locator(`[data-panel="${id}"]`);
			await panel.getByRole('button', { name: name + ' menu', exact: true }).click();
			await page.getByRole('menuitem', { name: 'Hide panel name', exact: true }).click();
			const menu = panel.locator('.panel-header');
			const lead = panel.locator(content).first();
			await expect(lead).toBeVisible();
			const menuRect = await menu.boundingBox();
			const bodyRect = await lead.boundingBox();
			expect(Math.abs(bodyRect!.y - menuRect!.y), name).toBeLessThanOrEqual(1);
			if (id !== 'notesPanel')
				expect(bodyRect!.x + bodyRect!.width, name).toBeLessThanOrEqual(menuRect!.x);
			await page.getByRole('menuitem', { name: 'Show panel name', exact: true }).click();
			await page.keyboard.press('Escape');
		}
	});
}

test('Help buttons align icons and labels and fit narrow screens', async ({ page }) => {
	await setup(page);
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	for (const width of [1000, 390]) {
		await page.setViewportSize({ width, height: 900 });
		const measurements = await page.locator('.help button.top').evaluateAll((buttons) =>
			buttons.map((button) => {
				const rect = button.getBoundingClientRect();
				const icon = button.querySelector('svg')!.getBoundingClientRect();
				const style = getComputedStyle(button);
				return {
					left: rect.left,
					right: rect.right,
					iconOffset: icon.left - rect.left,
					padding: parseFloat(style.paddingLeft),
					align: style.textAlign
				};
			})
		);
		for (const row of measurements) {
			expect(row.iconOffset).toBeCloseTo(row.padding, 0);
			expect(row.align).toBe('left');
			expect(row.left).toBeGreaterThanOrEqual(0);
			expect(row.right).toBeLessThanOrEqual(width);
		}
	}
});

test('tutorial stays fullscreen until a page exists, then guides real editing in a temporary panel', async ({
	page
}) => {
	await setup(page, { notesPanel: 2, timersPanel: 0 });
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	await page.getByRole('button', { name: 'start tutorial', exact: true }).click();
	const tutorial = page.getByRole('region', { name: 'Getting started', exact: true });
	await expect(page.locator('.prelude .tutorial')).toBeVisible();
	await expect(tutorial.getByRole('button', { name: 'back', exact: true })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'New flow', exact: true })).toHaveAttribute(
		'data-tutorial-active',
		''
	);
	await expect(page.locator('.addTab [data-tutorial-active]')).toHaveCount(0);
	await page
		.getByRole('textbox', { name: 'Flow document title', exact: true })
		.fill('Tutorial round');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.right-sidebar .tutorial-card')).toBeVisible();
	await expect(tutorial.getByRole('heading', { level: 1 })).toHaveText('Add flow pages');
	await expect(page.getByRole('button', { name: 'Close flow', exact: true })).not.toHaveAttribute(
		'data-tutorial-active',
		''
	);
	await expect(page.locator('.addTab [data-tutorial-active]')).toHaveCount(2);
	const back = tutorial.getByRole('button', { name: 'back', exact: true });
	const next = tutorial.getByRole('button', { name: 'next', exact: true });
	await back.click();
	await expect(back).toBeDisabled();
	await next.click();
	await page.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
	await expect(page.locator('.tabs li')).toHaveCount(2);
	await next.click();
	await expect(tutorial.getByRole('heading', { level: 1 })).toHaveText('Start flowing');
	await expect(page.locator('.addTab [data-tutorial-active]')).toHaveCount(0);
	const cells = page.locator('.flow textarea');
	await cells.first().fill('First argument');
	await cells.first().press('Enter');
	await cells.last().fill('Second argument');
	await expect(cells).toHaveCount(2);
	await next.click();
	await cells.first().click({ modifiers: ['Control'] });
	await cells.last().click({ modifiers: ['Control'] });
	await expect(page.locator('.flow .box.selected')).toHaveCount(2);
	await page.keyboard.press('Shift+Enter');
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
	await next.click();
	await expect(tutorial.getByRole('heading', { level: 1 })).toHaveText('Flow management');
	await expect(tutorial).toContainText(
		"Click the X next to a flow title to close it, don’t worry, it's autosaved!"
	);
	await expect(tutorial).not.toContainText('walkthrough outline');
	await expect(page.getByRole('button', { name: 'Close flow', exact: true })).toHaveAttribute(
		'data-tutorial-active',
		''
	);
	await page.getByRole('button', { name: 'Close flow', exact: true }).click();
	await expect(page.locator('.prelude-content')).toHaveAttribute('data-tutorial-active', '');
	await page
		.locator('.prelude .flow')
		.filter({ hasText: 'Tutorial round' })
		.getByRole('button', { name: 'open', exact: true })
		.click();
	await page.locator('.tabs li button').last().click();
	await expect(cells).toHaveCount(3);
	for (let i = 0; i < 3; i++) await next.click();
	await expect(tutorial.getByRole('heading', { level: 1 })).toHaveText('Use the tooltips');
	await back.click();
	await expect(tutorial).toContainText('11 panels');
	await next.click();
	await tutorial.getByRole('button', { name: 'finish', exact: true }).click();
	await expect(tutorial).toHaveCount(0);
	await expect(page.locator('[data-tutorial-active]')).toHaveCount(0);
	await expect(page.locator('.notes-panel')).toBeVisible();
	await expect(cells).toHaveCount(3);
});

test('homepage keeps its original hero and scenes alongside panel feature cards', async ({
	page
}) => {
	await setup(page);
	await page.goto('/');
	await expect(page.locator('.words h1')).toHaveText('Flew Notes');
	await expect(page.locator('.words p')).not.toBeEmpty();
	for (const title of [
		'Super Spacing',
		'Simple Sharing',
		'Personal Panels',
		'Automatic Autoflow',
		'Total Transcription'
	]) {
		const heading = page.getByRole('heading', { name: title, exact: true });
		await heading.scrollIntoViewIfNeeded();
		await expect(heading).toBeVisible();
	}
	await expect(page.locator('.benefits h2').last()).toHaveText('Woke Wins');
});

test('Help and panel menus remain scrollable with large controls in a short window', async ({
	page
}) => {
	await setup(page, { buttonSize: 40, padding: 16, fontSize: 1.5, sidebarWidth: 300 });
	await page.setViewportSize({ width: 700, height: 400 });
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	const help = page.locator('.help');
	await expect(help).toBeVisible();
	const bounds = await help.boundingBox();
	expect(bounds!.y).toBeGreaterThanOrEqual(0);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(400);
	await page
		.getByRole('button', { name: 'report a bug or suggest a feature', exact: true })
		.scrollIntoViewIfNeeded();
	expect(await help.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Tabs menu', exact: true }).click();
	const menu = page.getByRole('menu', { exact: true });
	await expect(menu).toBeVisible();
	await page.keyboard.press('End');
	await expect(menu.getByRole('button', { name: 'Hide panel', exact: true })).toBeFocused();
	const menuBounds = await menu.boundingBox();
	expect(menuBounds!.y).toBeGreaterThanOrEqual(0);
	expect(menuBounds!.y + menuBounds!.height).toBeLessThanOrEqual(400);
	expect(await menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test('a fast text drag leaving the cell never turns into a cell selection', async ({ page }) => {
	await setup(page, { timersPanel: 0 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const fields = page.locator('.flow textarea');
	await fields.first().fill('Select these words');
	await fields.first().press('Enter');
	await fields.last().fill('Other argument');
	const first = await fields.first().boundingBox();
	const last = await fields.last().boundingBox();
	if (!first || !last) throw new Error('Missing flow fields');
	await page.mouse.move(first.x + 8, first.y + first.height / 2);
	await page.mouse.down();
	await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
	await page.mouse.up();
	await expect(page.locator('.flow .box.selected')).toHaveCount(0);
	await expect(fields.first()).toHaveValue('Select these words');
	await expect(fields.last()).toHaveValue('Other argument');
});

test('panel menu preferences survive reload without opening Settings', async ({ page }) => {
	await page.addInitScript(() => {
		if (!localStorage.getItem('settings'))
			localStorage.setItem(
				'settings',
				JSON.stringify({
					isSettings: true,
					version: 3,
					settings: { telemetry: 0, transitionSpeed: 0, notesPanel: 2 }
				})
			);
	});
	await page.goto('/app');
	const menu = page.getByRole('button', { name: 'Notes menu', exact: true });
	await menu.click();
	await page.getByRole('menuitem', { name: 'Hide panel name', exact: true }).click();
	await page.getByRole('button', { name: 'Move left', exact: true }).click();
	await expect(page.getByRole('menu')).toBeVisible();
	await page.reload();
	await expect(page.locator('.sidebar [data-panel=notesPanel]')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toHaveCount(0);
	await menu.click();
	await page.getByRole('button', { name: 'Collapse', exact: true }).click();
	await page.reload();
	await expect(page.locator('[data-panel=notesPanel]')).not.toBeVisible();
	await page.getByRole('button', { name: 'Notes', exact: true }).click();
	await expect(menu).toBeVisible();
	await menu.click();
	await page.getByRole('button', { name: 'Hide panel', exact: true }).click();
	await page.reload();
	await expect(page.locator('[data-panel=notesPanel]')).toHaveCount(0);
});

test('column plus controls are visible before hover and add unconnected arguments', async ({
	page
}) => {
	await setup(page, { timersPanel: 0 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const add = page.getByRole('button', { name: 'Add argument in 2AC', exact: true });
	await expect(add).toBeVisible();
	expect(
		await add.evaluate((element) => {
			let opacity = 1;
			for (let node: Element | null = element; node; node = node.parentElement)
				opacity *= Number(getComputedStyle(node).opacity);
			return opacity;
		})
	).toBe(1);
	await add.click();
	await expect(page.locator('.flow textarea')).toHaveCount(2);
	await expect(page.locator('.flow textarea:focus')).toHaveCount(1);
	await page.locator('.flow textarea:focus').fill('Unconnected argument');
});

test('panel walkthroughs use maintainer copy and real shortcut badges', async ({ page }) => {
	await setup(page, { timersPanel: 0 });
	await page.getByRole('button', { name: 'Tabs menu', exact: true }).click();
	await page.getByRole('menuitem', { name: 'How to use Tabs', exact: true }).click();
	const tabsGuide = page.getByRole('region', { name: 'Tabs tutorial', exact: true });
	await expect(tabsGuide).toContainText('to switch pages, or just click them.');
	await expect(tabsGuide.locator('kbd')).toHaveText([
		'cmd/ctrl',
		'alt',
		'↑',
		'cmd/ctrl',
		'alt',
		'↓',
		'cmd/ctrl',
		'alt',
		'N',
		'cmd/ctrl',
		'alt',
		'shift',
		'N'
	]);
	await tabsGuide.getByRole('button', { name: 'End tutorial', exact: true }).click();
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	await page.getByRole('button', { name: 'panel tutorials', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Starred arguments', exact: true }).click();
	const starGuide = page.getByRole('region', { name: 'Starred arguments tutorial', exact: true });
	await expect(starGuide.locator('kbd')).toHaveText(['cmd/ctrl', 'shift', '8']);
	await expect(page.locator('[data-panel=starredPanel]')).toHaveAttribute(
		'data-panel-tutorial-active',
		''
	);
	await expect(starGuide).not.toContainText('SHORTCUT');
});
