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
	await expect(
		page.getByRole('button', { name: 'Upload to SpeechDrop', exact: true })
	).toBeEnabled();
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
	await expect(page.locator('.tabs li')).toHaveCount(2);
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
	await page.getByRole('button', { name: 'Save flow', exact: true }).click();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'download as JSON', exact: true }).click();
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
