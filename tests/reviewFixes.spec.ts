import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
test.use({ serviceWorkers: 'block' });
async function setup(page: Page, options: Record<string, unknown> = {}) {
	await page.addInitScript((options: Record<string, unknown>) => {
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 2,
				isSettings: true,
				settings: {
					telemetry: 0,
					transitionSpeed: 0,
					notesPanel: 0,
					timersPanel: 0,
					coveragePanel: 0,
					...options
				}
			})
		);
		class Socket extends EventTarget {
			send() {
				return undefined;
			}
			close() {
				return undefined;
			}
		}
		Object.defineProperty(window, 'WebSocket', { value: Socket });
	}, options);
	await page.goto('/app');
}

test('SpeechDrop pins every file in an upload batch to the original room', async ({ page }) => {
	await setup(page, { speechDropPanel: 1 });
	let release: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => (release = resolve));
	const rooms: string[] = [];
	await page.route('**/api/speechdrop/*', async (route) => {
		const room = route.request().url().split('/').at(-1)!;
		if (route.request().method() === 'POST') {
			rooms.push(room);
			if (rooms.length === 1) await gate;
			await route.fulfill({ json: { ok: true } });
		} else await route.fulfill({ json: { files: [] } });
	});
	await page.getByLabel('SpeechDrop room code').fill('original');
	await expect(page.locator('.speechdrop-panel')).toContainText('This room has no files.');
	await page.getByRole('button', { name: 'SpeechDrop menu', exact: true }).click();
	await expect(page.getByRole('menuitem', { name: 'Upload files', exact: true })).toBeEnabled();
	await page.keyboard.press('Escape');
	await page.locator('.speechdrop-panel input[type=file]').setInputFiles(
		['a', 'b'].map((name) => ({
			name: name + '.txt',
			mimeType: 'text/plain',
			buffer: Buffer.from(name)
		}))
	);
	await expect.poll(() => rooms.length).toBe(1);
	await page.getByLabel('SpeechDrop room code').fill('different');
	await expect(page.locator('.speechdrop-panel')).toContainText('This room has no files.');
	release();
	await expect.poll(() => rooms).toEqual(['original', 'original']);
});

test('the latest Autoflow document wins over an older in-flight drop', async ({ page }) => {
	await setup(page, { autoflowPanel: 2 });
	const original = await readFile('test-files/autoflow/headings.docx');
	const zip = await JSZip.loadAsync(original);
	zip.file(
		'word/document.xml',
		(await zip.file('word/document.xml')!.async('string')).replace('Economy', 'Newest block')
	);
	let release: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/api/speechdrop/old/0', async (route) => {
		await gate;
		await route.fulfill({ body: original }).catch(() => undefined);
	});
	await page.locator('.autoflow-panel').evaluate((element) => {
		const dataTransfer = new DataTransfer();
		dataTransfer.setData(
			'application/x-flew-speechdrop',
			JSON.stringify({ room: 'old', index: 0, name: 'old.docx' })
		);
		element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
	});
	await page.locator('.autoflow-panel input[type=file]').setInputFiles({
		name: 'new.docx',
		mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		buffer: await zip.generateAsync({ type: 'nodebuffer' })
	});
	await expect(page.locator('.autoflow-panel .blocks')).toContainText('Newest block');
	release();
	await expect(page.locator('.autoflow-panel .blocks')).not.toContainText('Economy');
	await expect(page.locator('.autoflow-panel [role=alert]')).toHaveCount(0);
});

test('panel menus are keyboard accessible and settings controls retain native keyboard operation', async ({
	page
}) => {
	await setup(page, { transcriptPanel: 2 });
	await page.getByRole('button', { name: 'Transcript menu', exact: true }).click();
	await expect(
		page.getByRole('menuitem', { name: 'Load speech document', exact: true })
	).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(
		page.getByRole('menuitem', { name: 'Paste speech text', exact: true })
	).toBeFocused();
	await page.keyboard.press('Escape');
	await page.locator('.header button').nth(1).click();
	const check = page.getByRole('checkbox', {
		name: 'Only show analytics while recording',
		exact: true
	});
	await check.focus();
	await page.keyboard.press('Space');
	await expect(check).toBeChecked();
	const mic = page.getByRole('radio', { name: 'Microphone', exact: true });
	await mic.focus();
	await page.keyboard.press('ArrowDown');
	await expect(page.getByRole('radio', { name: 'Tab audio', exact: true })).toBeChecked();
});

test('library clicks preview and select, and the plus imports the selected pages', async ({
	page
}) => {
	const source = JSON.parse(await readFile('test-files/persistancy/Round.json', 'utf8'));
	await page.addInitScript((data) => {
		localStorage.setItem('flow:source', JSON.stringify(data));
		localStorage.setItem(
			'savedFlows',
			JSON.stringify({
				'flow:source': {
					title: 'Saved source',
					created: new Date().toISOString(),
					modified: new Date().toISOString(),
					flowInfos: [
						{ content: data.nodes[data.nodes.root.children[0]].value.content, invert: false }
					]
				}
			})
		);
	}, source);
	await setup(page, { libraryPanel: 2 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const library = page.locator('.library-panel .flow.compact').filter({ hasText: 'Saved source' });
	await library
		.getByRole('button', { name: /^Select / })
		.first()
		.click();
	await expect(page.locator('.tabs li')).toHaveCount(1);
	await expect(library.locator('.preview')).toContainText('Original argument');
	await library.getByRole('button', { name: 'Add selected pages', exact: true }).first().click();
	await expect(page.locator('.tabs li')).toHaveCount(1);
});

test('local DOCX cards keep evidence when flowed, saved and reopened', async ({ page }) => {
	await setup(page, { autoflowPanel: 2 });
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const zip = await JSZip.loadAsync(await readFile('test-files/autoflow/headings.docx'));
	zip.file(
		'word/document.xml',
		(await zip.file('word/document.xml')!.async('string')).replace(
			'Growth solves poverty</w:t></w:r></w:p>',
			'Growth solves poverty</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Saved full evidence body.</w:t></w:r></w:p>'
		)
	);
	await page.locator('.autoflow-panel input').setInputFiles({
		name: 'cards.docx',
		mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		buffer: await zip.generateAsync({ type: 'nodebuffer' })
	});
	await page.locator('.autoflow-panel .blocks .panel-row .content').first().click();
	await page
		.locator('.autoflow-panel .blocks button')
		.filter({ has: page.locator('svg') })
		.first()
		.click();
	await page.locator('.tabs').getByRole('button', { name: 'Economy', exact: true }).click();
	await expect(page.locator('.flow textarea').first()).toHaveValue('Growth solves poverty');
	await page.getByRole('button', { name: 'File menu', exact: true }).click();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download JSON copy', exact: true }).click();
	const raw = await readFile((await (await download).path())!, 'utf8');
	expect(raw).toContain('Saved full evidence body.');
	expect(raw).toContain('"type":"bold"');
	await page
		.locator('#uploadId')
		.setInputFiles({ name: 'saved.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
	await expect(page.getByLabel('CardMirror card', { exact: true })).toHaveCount(2);
});

test('pacing updates while a cell is being edited and when word weighting changes', async ({
	page
}) => {
	await setup(page, {
		timersPanel: 1,
		pacingEnabled: true,
		pacingWordWeight: true,
		pacingGracePeriod: 0
	});
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const cells = page.locator('.flow textarea');
	await cells.first().fill('one');
	await cells.first().press('Enter');
	await cells.nth(1).fill('one two three four');
	await cells.first().click();
	await expect(page.locator('.pacing .time')).toHaveText('01:36');
	await cells.first().fill('one :30');
	await expect(page.locator('.pacing .time')).toHaveText('00:30');
	await cells.first().fill('one');
	await expect(page.locator('.pacing .time')).toHaveText('01:36');
	await page.locator('.header button').nth(1).click();
	const weight = page.getByRole('checkbox', {
		name: 'Weight pacing by cell word count',
		exact: true
	});
	await weight.focus();
	await weight.press('Space');
	await expect(weight).not.toBeChecked();
	await page.locator('.upper > .element > .top').click();
	await cells.first().click();
	await expect(page.locator('.pacing .time')).toHaveText('04:00');
});

test('dropping an argument on an empty cell preserves the responses already under it', async ({
	page
}) => {
	await setup(page);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const cells = page.locator('.flow textarea');
	await cells.first().fill('Parent');
	await cells.first().press('Shift+Enter');
	await cells.nth(1).fill('Existing response');
	await cells.first().fill('');
	const target = page.locator('.flow [data-box-id]').first();
	await target.evaluate((element) => {
		const dataTransfer = new DataTransfer();
		dataTransfer.setData(
			'application/x-flew-boxes',
			JSON.stringify({ boxes: [{ value: { content: 'New response' }, children: [] }] })
		);
		element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
	});
	await expect(cells).toHaveCount(3);
	await expect(cells.nth(1)).toHaveValue('New response');
	await expect(cells.nth(2)).toHaveValue('Existing response');
});

test('typing a reference wins over an in-flight transcript document drop', async ({ page }) => {
	await setup(page, { transcriptPanel: 2 });
	let finish = () => undefined as void;
	const gate = new Promise<void>((resolve) => (finish = resolve));
	await page.route('**/api/speechdrop/old/0', async (route) => {
		await gate;
		await route.fulfill({ body: 'Old file text' }).catch(() => undefined);
	});
	const request = page.waitForRequest('**/api/speechdrop/old/0');
	await page.locator('.transcript').evaluate((element) => {
		const dataTransfer = new DataTransfer();
		dataTransfer.setData(
			'application/x-flew-speechdrop',
			JSON.stringify({ room: 'old', index: 0, name: 'old.txt' })
		);
		element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
	});
	await request;
	const reference = page.getByRole('textbox', { name: 'Opponent speech document' });
	await reference.fill('Current speech reference');
	finish();
	await expect(reference).toHaveValue('Current speech reference');
	await expect(page.getByText('Comparing with old.txt', { exact: true })).toHaveCount(0);
});

test('opening the next round clears round tools while closing allows post-round review', async ({
	page
}) => {
	await setup(page, { timersPanel: 1, transcriptPanel: 2, speechDropPanel: 1 });
	await page.route('**/api/speechdrop/*', (route) => route.fulfill({ json: { files: [] } }));
	const room = page.getByLabel('SpeechDrop room code');
	const reference = page.getByRole('textbox', { name: 'Opponent speech document' });
	const newFlow = page.getByRole('button', { name: 'New flow', exact: true });
	await room.fill('preflight');
	await newFlow.click();
	await expect(room).toHaveValue('preflight');
	await reference.fill('First-round setup');
	const prep = page.locator('.timer-panel input.minutes').first();
	await prep.fill('03');
	await prep.press('Tab');
	await expect(prep).toHaveValue('03');
	await page.getByRole('button', { name: 'Close flow', exact: true }).click();
	await expect(reference).toHaveValue('First-round setup');
	await page.getByRole('button', { name: 'open', exact: true }).click();
	await expect(prep).toHaveValue('03');
	await expect(reference).toHaveValue('First-round setup');
	await expect(room).toHaveValue('preflight');
	await page.getByRole('button', { name: 'Close flow', exact: true }).click();
	await newFlow.click();
	await expect(prep).toHaveValue('08');
	await expect(reference).toHaveValue('');
	await expect(room).toHaveValue('');
});

test('round layouts persist and restore panel and toolbar choices without changing the document', async ({
	page
}) => {
	await setup(page, { notesPanel: 2, showBoxFormatButtons: false });
	const open = async () => {
		await page.getByRole('button', { name: 'Settings', exact: true }).click();
		await page.getByRole('button', { name: 'Round layouts', exact: true }).click();
	};
	const formats = page.getByRole('button', { name: 'Toggle crossed out', exact: true });
	const newFlow = page.getByRole('button', { name: 'New flow', exact: true });
	await page.evaluate(() => {
		localStorage.setItem('flewRoundLayouts', JSON.stringify({ Flowing: { notesPanel: 1 } }));
	});
	await open();
	await page.getByRole('textbox', { name: 'New layout name', exact: true }).fill('CX prep');
	await page.getByRole('button', { name: 'Save current layout', exact: true }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Saved CX prep.' })).toBeVisible();
	await page.getByRole('button', { name: 'Rename CX prep layout', exact: true }).click();
	const rename = page.getByRole('textbox', { name: 'Layout name', exact: true });
	await expect(rename).toBeFocused();
	await rename.fill('Partner prep');
	await rename.press('Enter');
	await expect(
		page.getByRole('button', { name: 'Apply Partner prep layout', exact: true })
	).toBeVisible();
	await page.keyboard.press('Escape');
	await page.reload();
	await page.locator('#uploadId').setInputFiles({
		name: 'layout-settings.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({
				isSettings: true,
				version: 4,
				settings: { notesPanel: 0, showBoxFormatButtons: true }
			})
		)
	});
	await newFlow.click();
	await expect(formats).toBeVisible();
	await expect(page.locator('[data-panel=notesPanel]')).toHaveCount(0);
	const cell = page.locator('.flow textarea').first();
	await cell.fill('Keep this argument');
	await open();
	await page.getByRole('button', { name: 'Apply Flowing layout' }).click();
	await expect(page.locator('.sidebar [data-panel=notesPanel]')).toBeVisible();
	await open();
	await page.getByRole('button', { name: 'Apply Partner prep layout' }).click();
	await expect(cell).toHaveValue('Keep this argument');
	await expect(page.locator('.right-sidebar [data-panel=notesPanel]')).toBeVisible();
	await expect(formats).toHaveCount(0);
});

test('built-in layouts work out of the box and can all be removed', async ({ page }) => {
	await setup(page);
	const header = page.locator('.sidebar .header');
	const buttons = header.getByRole('button');
	await expect(buttons).toHaveCount(4);
	expect(
		await buttons.evaluateAll(
			(items) => new Set(items.map((item) => item.getBoundingClientRect().top)).size
		)
	).toBe(1);
	const open = async () => {
		await page.getByRole('button', { name: 'Settings', exact: true }).click();
		await page.getByRole('button', { name: 'Round layouts', exact: true }).click();
	};
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await open();
	await page.getByRole('button', { name: 'Apply Prep layout', exact: true }).click();
	await expect(page.locator('.sidebar [data-panel=timersPanel]')).toBeVisible();
	await expect(page.locator('.right-sidebar [data-panel=coveragePanel]')).toBeVisible();
	await open();
	await page.getByRole('button', { name: 'Apply Review layout', exact: true }).click();
	await expect(page.locator('.right-sidebar [data-panel=starredPanel]')).toBeVisible();
	await expect(page.locator('.sidebar [data-panel=timersPanel]')).toBeHidden();
	await open();
	for (const name of ['Flowing', 'Prep', 'Review']) {
		page.once('dialog', (dialog) => dialog.accept());
		await page.getByRole('button', { name: `Delete ${name} layout`, exact: true }).click();
	}
	await expect(page.getByText('No saved layouts.', { exact: true })).toBeVisible();
	await page.reload();
	await open();
	await expect(page.getByText('No saved layouts.', { exact: true })).toBeVisible();
});

test('an incomplete collaboration link leaves the app usable and shows an error', async ({
	page
}) => {
	const query = new URLSearchParams({
		join: JSON.stringify({ localOffer: 'incomplete', broadcastId: 'round' })
	});
	await page.goto(`/app?${query}`);
	await expect(
		page.getByText('This collaboration link is incomplete.', { exact: false })
	).toBeVisible();
	await expect(page.getByRole('region', { name: 'Set up Flew' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.flow textarea').first()).toBeVisible();
});
