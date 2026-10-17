import { test, expect, type Page } from '@playwright/test';
import { layout, parsePayload } from '../src/lib/integrations/cardmirror/protocol';
import type { Api, Definition } from '../integrations/cardmirror/api';

type Host = Window & {
	testDefinition: Definition;
	testApi: Api;
	toasts: string[];
	jumps: string[];
	selection: ReturnType<Api['extractSelection']>;
};
async function run(page: Page, name: string) {
	await page.evaluate(async (name) => {
		const w = window as unknown as Host;
		await w.testDefinition.commands
			.find((command) => command.id === `cardmirror-flew.${name}`)!
			.run(w.testApi);
	}, name);
}
async function mockHost(page: Page) {
	await page.route('**/cardmirror-test', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: '<!doctype html><title>CardMirror API v1 test host</title>'
		})
	);
	await page.goto('/cardmirror-test');
	await page.evaluate(() => {
		const w = window as unknown as Host;
		w.toasts = [];
		w.jumps = [];
		w.selection = {
			ok: true,
			docId: 'debate-doc',
			docTitle: 'Evidence — café',
			items: [
				{ kind: 'block', text: 'Climate policy', source: 'token:block' },
				{ kind: 'tag', text: 'Growth solves poverty 🌱', source: 'token:tag' },
				{ kind: 'cite', text: 'Author 2026', source: 'token:cite' },
				{ kind: 'analytic', text: 'Prefer comparative evidence', source: 'token:analytic' }
			]
		};
		const storage = new Map<string, unknown>();
		w.testApi = {
			extractSelection: () => w.selection,
			jumpToSource: async (token) => {
				w.jumps.push(token);
				return { ok: true };
			},
			showToast: (text) => w.toasts.push(text),
			storage: {
				get: (key) => storage.get(key),
				set: (key, value) => {
					storage.set(key, value);
				}
			},
			settings: {
				get: (key) =>
					(storage.get('__settings') as Record<string, unknown> | undefined)?.[key] ??
					(key === 'space' ? 0 : 'One cell per line')
			}
		};
		w.__registerCardMirrorPlugin = (definition) => {
			w.testDefinition = definition;
		};
	});
	await page.addScriptTag({ url: '/integrations/cardmirror/plugin.js' });
}
async function pair(flew: Page, host: Page) {
	await run(host, 'connect');
	await flew.getByRole('button', { name: 'Create connection key', exact: true }).click();
	const key = flew.getByRole('textbox', { name: 'Flew connection key', exact: true });
	await expect(key).toHaveValue(/^FLEWCM1\./, { timeout: 15_000 });
	await host
		.getByRole('textbox', { name: 'Flew connection key', exact: true })
		.fill(await key.inputValue());
	await host.getByRole('button', { name: 'Create reply key', exact: true }).click();
	const answer = host.getByRole('textbox', { name: 'CardMirror reply key', exact: true });
	await expect(answer).toHaveValue(/^FLEWCM1\./, { timeout: 15_000 });
	const mismatched = JSON.parse(
		Buffer.from((await answer.inputValue()).slice('FLEWCM1.'.length), 'base64').toString()
	);
	mismatched.session = 'different-pairing';
	await flew
		.getByRole('textbox', { name: 'CardMirror reply key', exact: true })
		.fill('FLEWCM1.' + Buffer.from(JSON.stringify(mismatched)).toString('base64'));
	await flew.getByRole('button', { name: 'Connect CardMirror', exact: true }).click();
	await expect(flew.getByRole('alert')).toContainText('different connection');
	await flew
		.getByRole('textbox', { name: 'CardMirror reply key', exact: true })
		.fill(await answer.inputValue());
	await flew.getByRole('button', { name: 'Connect CardMirror', exact: true }).click();
	await expect(flew.getByText('Connected to CardMirror', { exact: true })).toBeVisible({
		timeout: 20_000
	});
	await host.getByRole('button', { name: 'Done', exact: true }).click();
}
async function configure(page: Page, position = 2) {
	await page.addInitScript(
		(position) =>
			localStorage.setItem(
				'settings',
				JSON.stringify({
					isSettings: true,
					version: 2,
					settings: {
						telemetryTier: 0,
						cardMirrorPanel: position,
						timersPanel: 0,
						notesPanel: 0,
						collaborationPanel: 0
					}
				})
			),
		position
	);
}

test('companion plugin exchanges real WebRTC messages with Flew, persists sources and reconnects', async ({
	page,
	browser,
	baseURL
}) => {
	test.setTimeout(120_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await configure(page);
	await page.goto('/app');
	await expect(page.locator('[data-panel="cardMirrorPanel"]')).toContainText('CardMirror');
	await expect(page.getByRole('button', { name: 'Create connection key' })).toHaveCount(0);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const context = await browser.newContext({ baseURL });
	const host = await context.newPage();
	try {
		await mockHost(host);
		await run(host, 'send');
		await expect
			.poll(() => host.evaluate(() => (window as unknown as Host).toasts.at(-1)))
			.toContain('Connect CardMirror');
		await pair(page, host);
		await run(host, 'sendColumn');
		await expect
			.poll(() => host.evaluate(() => (window as unknown as Host).toasts.at(-1)))
			.toContain('Sent to Flew');
		const cells = page.locator('.box textarea');
		await expect(cells.first()).toHaveValue('Climate policy');
		await expect(page.getByLabel('CardMirror card', { exact: true })).toHaveCount(1);
		await expect
			.poll(() =>
				cells.evaluateAll((elements) => elements.map((el) => (el as HTMLTextAreaElement).value))
			)
			.toEqual([
				'Climate policy',
				'Growth solves poverty 🌱\nAuthor 2026',
				'Prefer comparative evidence'
			]);
		await run(host, 'reveal');
		await expect(cells.nth(0)).toBeFocused();
		await run(host, 'reveal');
		await expect(cells.nth(1)).toBeFocused();
		await expect(page.getByText('Evidence — café', { exact: true })).toHaveCount(2);
		await page.getByRole('button', { name: 'Jump to source', exact: true }).first().click();
		await expect
			.poll(() => host.evaluate(() => (window as unknown as Host).jumps))
			.toEqual(['token:tag']);
		// A whole received selection is one undo operation, and redo retains provenance.
		await cells.nth(1).press('ControlOrMeta+z');
		await expect(cells).toHaveCount(1);
		await expect(cells.first()).toHaveValue('');
		await cells.first().press('ControlOrMeta+Shift+z');
		await expect(cells).toHaveCount(3);
		await run(host, 'reveal');
		await expect(cells.nth(2)).toBeFocused();
		// Imported metadata is included by the normal autosave, not a parallel save path.
		await expect
			.poll(
				() =>
					page.evaluate(() =>
						Object.keys(localStorage).some(
							(key) => key.startsWith('flow:') && localStorage.getItem(key)?.includes('token:tag')
						)
					),
				{ timeout: 12_000 }
			)
			.toBe(true);
		await run(host, 'toggleMode');
		await run(host, 'send');
		await expect(cells).toHaveCount(4);
		await expect(cells.last()).toHaveValue(
			'Climate policy\nGrowth solves poverty 🌱\nAuthor 2026\nPrefer comparative evidence'
		);
		await page.getByRole('button', { name: 'Disconnect CardMirror', exact: true }).click();
		await expect(page.getByText('Not connected', { exact: true })).toBeVisible();
		await pair(page, host);
		await run(host, 'sendCell');
		await expect(cells).toHaveCount(5);
		await host.evaluate(() => {
			const w = window as unknown as Host;
			w.testApi.storage.set('__settings', { space: 2 });
			w.selection = {
				ok: true,
				docId: 'doc',
				docTitle: 'Evidence',
				items: [{ kind: 'analytic', text: 'Spaced argument', source: 'spacing-token' }]
			};
		});
		await run(host, 'send');
		await expect(cells).toHaveCount(8);
		await run(host, 'send');
		await expect(cells).toHaveCount(11);
		await expect(cells.nth(6)).toHaveValue('');
		await expect(cells.nth(7)).toHaveValue('');
		await expect(cells.nth(8)).toHaveValue('Spaced argument');
		await page.getByPlaceholder('type name here', { exact: true }).fill('Aff destination');
		await page.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
		await run(host, 'choosePage');
		await expect
			.poll(() => host.evaluate(() => (window as unknown as Host).toasts.at(-1)))
			.toBe('Flew destination: Aff destination.');
		await expect(cells).toHaveCount(11);
		await host.addScriptTag({ url: '/integrations/cardmirror/plugin.js' });
		await expect(page.getByText('Not connected', { exact: true })).toBeVisible();
		await pair(page, host);
		expect(errors).toEqual([]);
	} finally {
		await context.close();
	}
});

test('collapsed panel stays connected; large selections are framed; no flow rejects sends', async ({
	page,
	browser,
	baseURL
}) => {
	test.setTimeout(120_000);
	await configure(page, 4);
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page.getByRole('button', { name: 'CardMirror', exact: true }).click();
	const context = await browser.newContext({ baseURL });
	const host = await context.newPage();
	try {
		await mockHost(host);
		await pair(page, host);
		await page.getByRole('button', { name: 'CardMirror', exact: true }).click();
		await host.evaluate(() => {
			(window as unknown as Host).selection = {
				ok: true,
				docId: 'long',
				docTitle: 'Large selection',
				items: [{ kind: 'tag', text: '界🌱'.repeat(5000), source: 'long-token' }]
			};
		});
		await run(host, 'sendCell');
		await expect
			.poll(() => host.evaluate(() => (window as unknown as Host).toasts.at(-1)))
			.toContain('Sent to Flew');
		await expect(page.locator('.box textarea').first()).toHaveValue('界🌱'.repeat(5000));
		await page.getByRole('button', { name: 'CardMirror', exact: true }).click();
		await expect(page.getByText('Connected to CardMirror', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Close flow', exact: true }).click();
		await run(host, 'send');
		await expect
			.poll(() => host.evaluate(() => (window as unknown as Host).toasts.at(-1)))
			.toContain('Open a flow page');
	} finally {
		await context.close();
	}
});

test('layout matches Ebb headings, citation folding, spacing and malformed limits', () => {
	const payload = parsePayload({
		mode: 'column',
		docTitle: 'Round',
		space: 2,
		items: [
			{ kind: 'cite', text: 'Standalone', source: '1', key: '1' },
			{ kind: 'hat', text: 'Heading', source: '2', key: '2' },
			{ kind: 'cite', text: 'Citation', source: '3', key: '3' }
		]
	});
	const cells = layout(payload);
	expect(cells.map((c) => c.content)).toEqual(['Standalone', 'Heading\nCitation', '', '']);
	expect(cells[1].bold).toBe(true);
	expect(cells[1].cardMirror?.sources.map((s) => s.token)).toEqual(['2', '3']);
	expect(() => parsePayload({ ...payload, space: 11 })).toThrow();
	expect(() => parsePayload({ ...payload, items: [] })).toThrow();
	expect(() =>
		parsePayload({ ...payload, items: [{ kind: 'html', text: '<script>', key: 'x', source: 'x' }] })
	).toThrow();
});

test('source references survive JSON import/export, cell copying and page import', async ({
	page
}) => {
	const { readFile } = await import('node:fs/promises');
	const data = JSON.parse(await readFile('test-files/persistancy/Round.json', 'utf8'));
	const source = {
		kind: 'tag',
		sources: [
			{
				key: 'doc|argument',
				token: 'opaque-source-token',
				documentTitle: 'Evidence',
				excerpt: 'Argument'
			}
		]
	};
	data.nodes['box-a'].value.cardMirror = source;
	data.nodes['box-a'].value.content = 'Argument\nCitation';
	await configure(page);
	await page.goto('/app');
	await page.locator('#uploadId').setInputFiles({
		name: 'Round.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(data))
	});
	const cells = page.locator('.box textarea');
	await expect(cells.first()).toHaveValue('Argument\nCitation');
	await cells.first().click();
	await expect(page.getByText('Evidence', { exact: true })).toBeVisible();
	await page.evaluate(() =>
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (text: string) => {
					Object.assign(window, { copied: text });
				}
			}
		})
	);
	await cells.first().press('ArrowRight');
	await cells.first().press('ControlOrMeta+c');
	const copied = await page.evaluate(() => (window as unknown as { copied: string }).copied);
	expect(JSON.parse(copied).boxes[0].value.cardMirror).toEqual(source);
	await cells.first().press('Shift+Enter');
	await expect(cells).toHaveCount(2);
	await expect(cells.last()).toBeFocused();
	await cells.last().evaluate((el, text) => {
		const clipboardData = new DataTransfer();
		clipboardData.setData('text/plain', text);
		// Firefox does not preserve constructor-supplied clipboard data on
		// untrusted paste events. Supply the same payload as a real paste.
		const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'clipboardData', { value: clipboardData });
		el.dispatchEvent(event);
	}, copied);
	await expect(cells.last()).toHaveValue('Argument\nCitation');
	await expect(page.getByLabel('CardMirror card', { exact: true })).toHaveCount(2);
	await page.getByRole('button', { name: 'Save flow', exact: true }).click();
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'download as JSON', exact: true }).click();
	const download = await downloadPromise;
	const raw = await readFile((await download.path())!, 'utf8');
	const saved = JSON.parse(raw);
	const boxes = Object.values(
		saved.nodes as Record<string, { value: { tag: string; cardMirror: unknown } }>
	).filter((n) => n.value.tag === 'box') as {
		value: { cardMirror: unknown };
	}[];
	expect(boxes.map((box) => box.value.cardMirror)).toEqual([source, source]);
	await page.evaluate((data) => {
		const dataTransfer = new DataTransfer();
		dataTransfer.setData(
			'application/x-flew-page',
			JSON.stringify({ nodes: data.nodes, id: data.nodes.root.children[0] })
		);
		window.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
	}, saved);
	await expect(page.locator('.tabs li')).toHaveCount(2);
	await expect(cells).toHaveCount(2);
	await cells.last().click();
	await expect(page.getByText('Evidence', { exact: true })).toBeVisible();
	page.once('dialog', (dialog) => dialog.accept());
	await page
		.locator('#uploadId')
		.setInputFiles({ name: 'Round.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
	await expect(page.locator('.tabs li')).toHaveCount(1);
	await expect(page.getByLabel('CardMirror card', { exact: true })).toHaveCount(2);
	await expect(cells.last()).toHaveValue('Argument\nCitation');
});
