import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Persisted native handles must use a regular browser profile. Chromium's temporary
// incognito storage crashes when restoring OPFS handles from IndexedDB after reload.
const nativeTest = test.extend({
	context: async ({ playwright, browserName }, use) => {
		test.skip(browserName !== 'chromium');
		const profile = await mkdtemp(path.join(tmpdir(), 'flew-persistancy-'));
		const context = await playwright.chromium.launchPersistentContext(profile, {
			baseURL: 'http://localhost:4173'
		});
		try {
			await use(context);
		} finally {
			await context.close();
			await rm(profile, { recursive: true, force: true });
		}
	}
});

const fixtures = path.resolve('test-files/persistancy');
const round = JSON.parse(await readFile(path.join(fixtures, 'Round.json'), 'utf8'));
const lib = (page: Page) => page.getByRole('region', { name: 'Flow library', exact: true });
const title = (page: Page) => page.getByRole('textbox', { name: 'Flow document title' });
const row = (page: Page, name: string) =>
	lib(page).locator(`[data-filename=${JSON.stringify(name)}]`);
async function closeFlow(page: Page) {
	await page.getByRole('button', { name: /^Close (?:flow|without saving)$/, exact: true }).click();
	const saveAndClose = page.getByRole('button', { name: 'Save and close', exact: true });
	await expect
		.poll(
			async () => (await saveAndClose.count()) || ((await title(page).inputValue()) === '' ? 1 : 0)
		)
		.toBe(1);
	if (await saveAndClose.count()) await saveAndClose.click();
	await expect(title(page)).toHaveValue('');
	await expect(page.getByRole('region', { name: 'Flow library setup', exact: true })).toBeVisible();
	await expect(
		page.getByRole('button', { name: /^Close (?:flow|without saving)$/, exact: true })
	).toHaveCount(0);
	await expect(page.locator('.popups')).toHaveCount(0);
}
async function open(page: Page, name: string) {
	if (!(await page.getByRole('region', { name: 'Flow library setup', exact: true }).count()))
		await closeFlow(page);
	await row(page, name).getByRole('button', { name: 'Open', exact: true }).click();
	await expect(
		page.getByRole('button', { name: /^Close (?:flow|without saving)$/, exact: true })
	).toBeEnabled();
}
async function nativeFolder(page: Page, mainScreen = false) {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'showDirectoryPicker', {
			value: async (options: { mode: string }) => {
				localStorage.setItem('picker-mode', options.mode);
				return (await navigator.storage.getDirectory()).getDirectoryHandle('Flows', {
					create: true
				});
			}
		});
		Object.defineProperty(window, 'showSaveFilePicker', {
			value: async (options: {
				startIn: FileSystemDirectoryHandle;
				suggestedName: string;
				types: unknown[];
			}) => {
				localStorage.setItem('save-types', JSON.stringify(options.types));
				localStorage.setItem(
					'save-count',
					String(Number(localStorage.getItem('save-count') ?? 0) + 1)
				);
				localStorage.setItem('save-start', options.startIn.name);
				localStorage.setItem('save-suggestion', options.suggestedName);
				localStorage.setItem('save-activation', String(navigator.userActivation.isActive));
				if (localStorage.getItem('cancel-save')) {
					localStorage.removeItem('cancel-save');
					throw new DOMException('Cancelled', 'AbortError');
				}
				const chosen = localStorage.getItem('save-as-path');
				if (chosen) {
					const parts = chosen.split('/');
					let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
					for (const part of parts.slice(0, -1))
						dir = await dir.getDirectoryHandle(part, { create: true });
					return dir.getFileHandle(parts[parts.length - 1], { create: true });
				}
				let name = options.suggestedName;
				let suffix = 2;
				for (;;) {
					try {
						await options.startIn.getFileHandle(name);
					} catch (error) {
						if ((error as DOMException).name === 'NotFoundError') break;
						throw error;
					}
					name = `${options.suggestedName.slice(0, -5)} (${suffix++}).json`;
				}
				return options.startIn.getFileHandle(name, { create: true });
			}
		});
		Object.defineProperty(FileSystemHandle.prototype, 'queryPermission', {
			configurable: true,
			value: async function (this: FileSystemHandle) {
				return localStorage.getItem('deny-folder') ||
					(this.kind === 'directory' && localStorage.getItem('deny-directory-only'))
					? 'prompt'
					: 'granted';
			}
		});
		Object.defineProperty(FileSystemHandle.prototype, 'requestPermission', {
			configurable: true,
			value: async () => {
				localStorage.setItem('requested-write', 'true');
				if (localStorage.getItem('reject-folder')) return 'denied';
				localStorage.removeItem('deny-folder');
				return 'granted';
			}
		});
	});
	await page.goto('/app');
	await page.evaluate(async (data) => {
		const root = await (
			await navigator.storage.getDirectory()
		).getDirectoryHandle('Flows', { create: true });
		for (const [dir, name, raw] of [
			[root, 'Round.json', JSON.stringify(data)],
			[
				await root.getDirectoryHandle('preflows', { create: true }),
				'Preflow.json',
				JSON.stringify({ ...data, title: 'Preflow', sideDocText: '' })
			]
		] as const) {
			const stream = await (await dir.getFileHandle(name, { create: true })).createWritable();
			await stream.write(raw);
			await stream.close();
		}
	}, round);
	if (mainScreen) {
		await page.evaluate(() => localStorage.setItem('deny-folder', 'true'));
		await page.getByRole('button', { name: 'Choose folder', exact: true }).click();
	} else await page.getByRole('button', { name: 'Choose folder', exact: true }).click();
	await expect(row(page, 'Round.json')).toBeVisible();
}
async function disk(page: Page, name: string) {
	return await page.evaluate(async (name) => {
		const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
		return JSON.parse(await (await (await dir.getFileHandle(name)).getFile()).text());
	}, name);
}

async function diskNames(page: Page): Promise<string[]> {
	return page.evaluate(async () => {
		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
		const names: string[] = [];
		for await (const entry of (
			root as FileSystemDirectoryHandle & { values(): AsyncIterableIterator<FileSystemHandle> }
		).values())
			names.push(entry.name);
		return names;
	});
}

test('browser recovery saves final pending text and document title, and duplicate is independent', async ({
	page
}) => {
	await page.goto('/app');
	await expect(
		page.locator('.addTab').getByRole('button', { name: 'aff', exact: true })
	).toBeDisabled();
	await expect(
		page.locator('.addTab').getByRole('button', { name: 'neg', exact: true })
	).toBeDisabled();
	await title(page).fill('Browser round');
	expect(await page.evaluate(() => localStorage.getItem('savedFlows'))).toBeNull();
	await title(page).press('Enter');
	await expect(title(page)).toHaveValue('Browser round');
	await expect(page.getByPlaceholder('type name here')).toHaveValue('');
	await title(page).press('Enter');
	await expect(
		page.getByRole('button', { name: /^Close (?:flow|without saving)$/, exact: true })
	).toBeEnabled();
	await expect(page.locator('.tabs li')).toHaveCount(1);
	await expect(page.locator('.save-status')).toHaveText(/Saved in browser(?: recovery)?/);
	const created = await page
		.evaluate(
			() => Object.values(JSON.parse(localStorage.getItem('savedFlows')!))[0] as { created: string }
		)
		.then((data) => data.created);
	expect(created).toBeTruthy();
	await expect(page.getByRole('region', { name: 'Flow library setup', exact: true })).toHaveCount(
		0
	);
	await expect(
		page.locator('.addTab').getByRole('button', { name: 'neg', exact: true })
	).toBeEnabled();
	await page.getByPlaceholder('type here', { exact: true }).fill('Last typed argument');
	await expect(page.locator('.save-status')).toHaveText(/Saved in browser(?: recovery)?/);
	if (await page.evaluate(() => !('showDirectoryPicker' in window)))
		page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	const saved = page
		.locator('.prelude .flow')
		.filter({ has: page.getByText(/^(Recovered )?Browser round$/) });
	await saved.getByRole('button', { name: /^(open|view and save to disk)$/ }).click();
	await expect(title(page)).toHaveValue('Browser round');
	await closeFlow(page);
	const modified = await page.evaluate(
		() =>
			(Object.values(JSON.parse(localStorage.getItem('savedFlows')!)) as { modified: string }[])[0]
				.modified
	);
	await expect(saved.locator('.flow-heading time')).toHaveAttribute('datetime', modified);
	const heading = saved.locator('.flow-heading');
	const titleBounds = await heading.locator('strong').boundingBox();
	const dateBounds = await heading.locator('time').boundingBox();
	expect(dateBounds!.x).toBeGreaterThan(titleBounds!.x);
	expect(dateBounds!.y).toBe(titleBounds!.y);
	await saved.getByRole('button', { name: /^(open|view and save to disk)$/ }).click();
	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
		'Last typed argument'
	);
	await closeFlow(page);

	await saved.getByRole('button', { name: 'duplicate', exact: true }).click();
	await expect(title(page)).toHaveValue('Browser round copy');
	await page.getByPlaceholder('type here', { exact: true }).fill('Copy argument');
	await expect(page.locator('.save-status')).toHaveText(/Saved in browser(?: recovery)?/);
	await closeFlow(page);
	await saved.getByRole('button', { name: /^(open|view and save to disk)$/ }).click();
	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
		'Last typed argument'
	);
});

test('folder import retains subfolders across reload and supports rename, duplicate and delete', async ({
	page
}) => {
	await page.goto('/app');
	test.skip(
		await page.evaluate(() => !('showDirectoryPicker' in window)),
		'Covered by the snapshot import and recovery export tests in browsers without writable handles.'
	);
	await expect(page.getByRole('button', { name: 'Choose folder', exact: true })).toBeEnabled();
	await page.getByLabel('Import flow folder').setInputFiles(fixtures);
	await expect(lib(page)).toContainText('Skipped 1 invalid JSON');
	await open(page, 'Round.json');
	await expect(title(page)).toHaveValue('Round');
	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
		'Original argument'
	);
	await title(page).fill('Updated round');
	await page.getByPlaceholder('type here', { exact: true }).fill('Updated argument');
	await expect(page.locator('.save-status')).toHaveText('Saved in browser library');
	await expect(row(page, 'Round.json')).toHaveCount(0);
	await closeFlow(page);
	await expect(row(page, 'Updated round.json')).toBeVisible();
	await row(page, 'Updated round.json').getByRole('button', { name: 'Duplicate' }).click();
	await expect(title(page)).toHaveValue('Updated round copy');
	await closeFlow(page);
	await expect(row(page, 'Updated round copy.json')).toBeVisible();
	await expect(
		row(page, 'Updated round copy.json').getByRole('button', { name: 'Download' })
	).toHaveCount(0);
	page.once('dialog', (dialog) => dialog.accept());
	await row(page, 'Updated round copy.json').getByRole('button', { name: 'Delete' }).click();
	await expect(row(page, 'Updated round copy.json')).toHaveCount(0);
	await page.reload();
	await expect(row(page, 'Updated round.json')).toBeVisible();
	await lib(page).getByRole('button', { name: 'preflows', exact: true }).click();
	await open(page, 'Preflow.json');
	await expect(title(page)).toHaveValue('Preflow');
	await closeFlow(page);
	await page.getByRole('button', { name: 'Up one folder' }).click();
	await open(page, 'Updated round.json');
	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue('Updated argument');
});

nativeTest(
	'native folder persists, saves pending edits and notes, preserves filenames and reconnects',
	async ({ page, browserName }) => {
		test.skip(
			browserName !== 'chromium',
			'Direct disk picker is Chromium only; uses real browser directory handles with an automated picker.'
		);
		await nativeFolder(page);
		await open(page, 'Round.json');
		await title(page).fill('Saved round');
		await page.getByPlaceholder('type here', { exact: true }).fill('Final disk argument');
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		expect((await disk(page, 'Round.json')).nodes['box-a'].value.content).toBe(
			'Final disk argument'
		);
		expect((await disk(page, 'Round.json')).title).toBe('Saved round');
		await page.evaluate(() => localStorage.setItem('deny-folder', 'yes'));
		page.once('dialog', (dialog) => dialog.accept());
		await page.reload();
		await expect(page.getByRole('button', { name: 'Reconnect folder' })).toBeVisible();
		await page.getByRole('button', { name: 'Reconnect folder' }).click();
		await expect(row(page, 'Round.json')).toBeVisible();
		await open(page, 'Round.json');
		await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
			'Final disk argument'
		);
		await closeFlow(page);
		await row(page, 'Round.json').getByRole('button', { name: 'Duplicate' }).click();
		await expect(title(page)).toHaveValue('Saved round copy');
		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		await closeFlow(page);
		await expect(row(page, 'Saved round copy.json')).toBeVisible();
		expect((await disk(page, 'Round.json')).title).toBe('Saved round');
		await lib(page).getByRole('button', { name: 'preflows', exact: true }).click();
		await open(page, 'Preflow.json');
		await title(page).fill('Nested');
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		await page
			.getByPlaceholder('type here', { exact: true })
			.fill('Save stays in original subfolder');
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		await closeFlow(page);
		await expect(row(page, 'Preflow.json')).toBeVisible();
		await page.getByRole('button', { name: 'Up one folder' }).click();
		await expect(row(page, 'Preflow.json')).toHaveCount(0);
		await lib(page).getByRole('button', { name: 'preflows', exact: true }).click();
		await open(page, 'Preflow.json');
		await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
			'Save stays in original subfolder'
		);
	}
);

nativeTest(
	'outside changes and revoked permission keep browser recovery without overwriting disk',
	async ({ page, browserName }) => {
		test.skip(browserName !== 'chromium');
		await nativeFolder(page);
		await open(page, 'Round.json');
		await page.evaluate(async (data) => {
			const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
			const stream = await (await dir.getFileHandle('Round.json')).createWritable();
			await stream.write(JSON.stringify({ ...data, sideDocText: 'Changed externally' }));
			await stream.close();
		}, round);
		await page.getByPlaceholder('type here', { exact: true }).fill('Recover this edit');
		await expect(page.locator('.save-status')).toContainText('changed outside Flew');
		expect((await disk(page, 'Round.json')).sideDocText).toBe('Changed externally');
		expect(
			await page.evaluate(() =>
				Object.keys(JSON.parse(localStorage.getItem('savedFlows')!))
					.map((key) => localStorage.getItem(key))
					.join('')
			)
		).toContain('Recover this edit');
		await closeFlow(page);
		await open(page, 'Round.json');
		await page.evaluate(() => localStorage.setItem('deny-folder', 'yes'));
		await page.getByPlaceholder('type here', { exact: true }).fill('Permission recovery');
		await expect(page.locator('.save-status')).toContainText('Reconnect your folder');
		await closeFlow(page);
		await page.getByRole('button', { name: 'Reconnect folder' }).click();
		await open(page, 'Round.json');
		await page.getByPlaceholder('type here', { exact: true }).fill('Permission restored');
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		expect((await disk(page, 'Round.json')).nodes['box-a'].value.content).toBe(
			'Permission restored'
		);
	}
);

test('notes, manual pending-text save, and legacy imports remain compatible', async ({ page }) => {
	await page.addInitScript(() =>
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 1,
				isSettings: true,
				settings: { showSideDoc: true, telemetry: 0 }
			})
		)
	);
	await page.goto('/app');
	test.skip(
		await page.evaluate(() => !('showDirectoryPicker' in window)),
		'Covered by the snapshot import and recovery export tests in browsers without writable handles.'
	);
	await expect(page.getByRole('button', { name: 'Choose folder', exact: true })).toBeEnabled();
	await page.getByLabel('Import flow folder').setInputFiles(fixtures);
	await open(page, 'Round.json');
	await expect(page.getByPlaceholder('type notes here')).toHaveValue('Round notes');
	await page.getByPlaceholder('type notes here').fill('New notes only');
	await expect(page.locator('.save-status')).toHaveText('Saved in browser library');
	await open(page, 'Round.json');
	await expect(page.getByPlaceholder('type notes here')).toHaveValue('New notes only');
	await page.getByPlaceholder('type here', { exact: true }).fill('Manual save without blur');
	await page.getByPlaceholder('type here', { exact: true }).press('Control+s');
	const pending = await page.evaluate(() =>
		Object.keys(JSON.parse(localStorage.getItem('savedFlows') ?? '{}'))
			.map((key) => localStorage.getItem(key))
			.join('')
	);
	expect(pending).toContain('Manual save without blur');
	await expect(page.locator('.save-status')).toHaveText('Saved in browser library');
	await closeFlow(page);
	await lib(page).getByRole('button', { name: 'preflows', exact: true }).click();
	await open(page, 'Preflow.json');
	await expect(page.getByPlaceholder('type notes here')).toHaveValue('');
	await closeFlow(page);
	await page.locator('#uploadId').setInputFiles(path.resolve('test-files/flowCalzone.json'));
	await expect(page.getByPlaceholder('type name here')).toHaveValue('AC: Calzones have bread');
	await expect(title(page)).toHaveValue('');
});

nativeTest(
	'first native save chooses a unique file and preserves that location on title edits',
	async ({ page }) => {
		await nativeFolder(page);
		for (const [name, expected] of [
			['Round', 'Round (2).json'],
			['NUL: / name?', 'NUL- - name-.json'],
			['🔥'.repeat(70), null],
			['', null]
		] as const) {
			await title(page).fill(name);
			await page.getByRole('button', { name: 'New flow', exact: true }).click();
			await page.getByRole('button', { name: 'Save flow', exact: true }).click();
			await expect(page.locator('.save-status')).toHaveText('Saved to folder');
			const suggestion = await page.evaluate(() => localStorage.getItem('save-suggestion'));
			const filename = expected ?? suggestion!;
			expect(Buffer.byteLength(filename)).toBeLessThan(255);
			if (!name) expect(filename).toMatch(/^Flow \d{4}-\d{2}-\d{2}T.*\.json$/);
			expect((await disk(page, filename)).title).toBe(name);
			await title(page).fill('Edited title');
			await expect(page.locator('.save-status')).toHaveText('Saved to folder');
			expect((await disk(page, filename)).title).toBe('Edited title');
			await closeFlow(page);
			page.once('dialog', (dialog) => dialog.accept());
			await row(page, filename).getByRole('button', { name: 'Delete' }).click();
			await expect(row(page, filename)).toHaveCount(0);
		}
		expect((await disk(page, 'Round.json')).nodes['box-a'].value.content).toBe('Original argument');
	}
);

test('failed recovery storage keeps unsaved work when switching documents', async ({ page }) => {
	await page.goto('/app');
	await page.evaluate(() => {
		const nativeSet = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key, value) {
			if (key.startsWith('flow:')) throw new DOMException('Storage full', 'QuotaExceededError');
			return nativeSet.call(this, key, value);
		};
	});
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await title(page).fill('Keep unsaved round');
	await page.getByPlaceholder('type here', { exact: true }).fill('Do not discard this');
	await expect(page.locator('.save-status')).toContainText('Browser recovery save failed');
	await page.getByRole('button', { name: /^Close (?:flow|without saving)$/, exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('could not be saved');
	await expect(title(page)).toHaveValue('Keep unsaved round');
	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
		'Do not discard this'
	);
});

nativeTest('disk write failures report errors and retain recovery copies', async ({ page }) => {
	await nativeFolder(page);
	await open(page, 'Round.json');
	await page.evaluate(() => {
		FileSystemFileHandle.prototype.createWritable = async () => {
			throw new DOMException('Disk is full', 'QuotaExceededError');
		};
	});
	await page.getByPlaceholder('type here', { exact: true }).fill('Disk failure recovery');
	await expect(page.locator('.save-status')).toContainText('Disk is full');
	expect((await disk(page, 'Round.json')).nodes['box-a'].value.content).toBe('Original argument');
	expect(
		await page.evaluate(() =>
			Object.keys(JSON.parse(localStorage.getItem('savedFlows') ?? '{}'))
				.map((key) => localStorage.getItem(key))
				.join('')
		)
	).toContain('Disk failure recovery');
});

test('reload immediately after typing flushes pending text to browser recovery', async ({
	page
}) => {
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await title(page).fill('Immediate reload');
	await page.getByPlaceholder('type here', { exact: true }).fill('Last edit before closing');
	page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	const saved = page
		.locator('.prelude .flow')
		.filter({ has: page.getByText(/^(Recovered )?Immediate reload$/) });
	await saved.getByRole('button', { name: /^(open|view and save to disk)$/ }).click();
	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
		'Last edit before closing'
	);
});

nativeTest(
	'selected folder replaces browser recovery entries in the saved flows list',
	async ({ page }) => {
		await nativeFolder(page);
		await page.getByRole('button', { name: 'Disconnect' }).click();
		await title(page).fill('Browser-only round');
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		await expect(page.locator('.save-status')).toHaveText(/Saved in browser(?: recovery)?/);
		await closeFlow(page);
		const browserCard = page
			.locator('.prelude .flow')
			.filter({ has: page.getByText(/^(Recovered )?Browser-only round$/) });
		await expect(browserCard).toBeVisible();
		await page.getByRole('button', { name: 'Choose folder', exact: true }).click();
		await expect(row(page, 'Round.json')).toBeVisible();
		await expect(page.locator('.prelude .flows [data-filename="Round.json"]')).toBeVisible();
		await expect(browserCard).toHaveCount(0);
		await expect(
			page.getByText('up to 20 recovery copies in this browser; clearing site data removes them', {
				exact: true
			})
		).toHaveCount(0);
		await expect(page.locator('.sidebar .library')).toHaveCount(0);
		await page.getByRole('button', { name: 'Disconnect' }).click();
		await expect(browserCard).toBeVisible();
	}
);

nativeTest(
	'main folder button requests write permission and saves a new named flow to that folder',
	async ({ page }) => {
		await nativeFolder(page, true);
		expect(await page.evaluate(() => localStorage.getItem('picker-mode'))).toBe('readwrite');
		expect(await page.evaluate(() => localStorage.getItem('requested-write'))).toBe('true');
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		await title(page).fill('Picked folder round');
		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		await expect(page.locator('.sidebar .library')).toHaveCount(0);
		await closeFlow(page);
		await expect(row(page, 'Picked folder round.json')).toBeVisible();
		await expect(
			page.locator('.prelude').getByRole('region', { name: 'Flow library', exact: true })
		).toBeVisible();
		await expect(
			row(page, 'Picked folder round.json').getByRole('button', { name: 'Open', exact: true })
		).toHaveClass(/top/);
		const data = await disk(page, 'Picked folder round.json');
		expect(data.title).toBe('Picked folder round');
		await expect(row(page, 'Picked folder round.json').locator('time')).toHaveAttribute(
			'datetime',
			data.created
		);
		await expect(page.locator('.document-date')).toHaveCount(0);
	}
);

nativeTest('denied folder permission leaves browser recovery available', async ({ page }) => {
	await nativeFolder(page);
	await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
	await title(page).fill('Recovery round');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await closeFlow(page);
	await page.evaluate(() => {
		localStorage.setItem('deny-folder', 'true');
		localStorage.setItem('reject-folder', 'true');
	});
	await page.getByRole('button', { name: 'Choose folder', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Folder write permission was not granted');
	await expect(
		page.locator('.prelude .flow').filter({ has: page.getByText(/^(Recovered )?Recovery round$/) })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Choose folder', exact: true })).toBeEnabled();
});

test('library controls, alternating rows, and Help tutorial follow the main-screen layout', async ({
	page
}) => {
	await page.goto('/app');
	test.skip(
		await page.evaluate(() => !('showDirectoryPicker' in window)),
		'Covered by the snapshot import and recovery export tests in browsers without writable handles.'
	);
	await expect(page.getByRole('button', { name: 'Choose folder', exact: true })).toBeEnabled();
	await page.getByLabel('Import flow folder').setInputFiles(fixtures);
	const setup = page.getByRole('region', { name: 'Flow library setup', exact: true });
	await expect(setup.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
	await expect(setup.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Choose folder', exact: true })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'persistancy' })).toBeVisible();
	await expect(lib(page).getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0);
	await row(page, 'Round.json').getByRole('button', { name: 'Duplicate', exact: true }).click();
	await expect(page.getByRole('button', { name: 'New flow', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Save flow', exact: true }).click();
	await expect(
		page
			.locator('.popups')
			.getByRole('button', { name: /^Close (?:flow|without saving)$/, exact: true })
	).toHaveCount(0);
	await page.keyboard.press('Escape');
	await closeFlow(page);
	const cards = lib(page).locator('[data-filename]');
	await expect(cards).toHaveCount(2);
	const backgrounds = await cards.evaluateAll((elements) =>
		elements.map((element) => getComputedStyle(element).backgroundColor)
	);
	expect(backgrounds[0]).not.toBe(backgrounds[1]);
	const tabs = await cards.first().locator('.infoView').boundingBox();
	const controls = await cards.first().locator('.fixed').boundingBox();
	expect(controls!.x).toBeGreaterThanOrEqual(tabs!.x + tabs!.width);
	expect(Math.abs(controls!.y + controls!.height / 2 - (tabs!.y + tabs!.height / 2))).toBeLessThan(
		1
	);

	await lib(page).getByRole('button', { name: 'preflows', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'preflows' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Up one folder' })).toBeVisible();
	await page.getByRole('button', { name: 'Up one folder' }).click();
	await expect(page.getByRole('heading', { name: 'persistancy' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'restart tutorial', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	await page.getByRole('button', { name: 'restart tutorial', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'persistancy' })).toHaveCount(0);
	await expect(page.locator('.prelude')).toContainText('click to start tutorial');
});

nativeTest(
	'new and duplicate flows pick a save location once; cancellation keeps recovery and retries',
	async ({ page }) => {
		await nativeFolder(page);
		await title(page).fill('First save');
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		await page.getByPlaceholder('type here', { exact: true }).fill('Latest pending text');
		await expect(page.locator('.save-status')).toHaveText('Not saved to disk');
		expect(await page.evaluate(() => localStorage.getItem('save-count'))).toBeNull();
		expect(await diskNames(page)).not.toContain('First save.json');
		await page.evaluate(() => localStorage.setItem('cancel-save', 'true'));
		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
		await expect.poll(() => page.evaluate(() => localStorage.getItem('save-count'))).toBe('1');
		await expect(page.locator('.save-status')).toHaveText('Not saved to disk');
		expect(await diskNames(page)).not.toContain('First save.json');
		expect(
			await page.evaluate(() =>
				Object.keys(JSON.parse(localStorage.getItem('savedFlows')!))
					.map((key) => localStorage.getItem(key))
					.join('')
			)
		).toContain('Latest pending text');
		await page.evaluate(() => localStorage.setItem('save-as-path', 'preflows/Chosen name.json'));
		await page.getByPlaceholder('type here', { exact: true }).press('Control+s');
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		expect(await page.evaluate(() => localStorage.getItem('save-start'))).toBe('Flows');
		expect(await page.evaluate(() => localStorage.getItem('save-suggestion'))).toBe(
			'First save.json'
		);
		expect(await page.evaluate(() => localStorage.getItem('save-activation'))).toBe('true');
		await page.getByPlaceholder('type here', { exact: true }).fill('Later edit');
		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		expect(await page.evaluate(() => localStorage.getItem('save-count'))).toBe('2');
		await closeFlow(page);
		await lib(page).getByRole('button', { name: 'preflows', exact: true }).click();
		await expect(row(page, 'Chosen name.json')).toBeVisible();
		await open(page, 'Chosen name.json');
		await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue('Later edit');
		await closeFlow(page);
		await row(page, 'Chosen name.json').getByRole('button', { name: 'Duplicate' }).click();
		await expect(title(page)).toHaveValue('First save copy');
		expect(await page.evaluate(() => localStorage.getItem('save-count'))).toBe('2');
		await page.evaluate(() => localStorage.setItem('save-as-path', 'preflows/Copy chosen.json'));
		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		expect(await page.evaluate(() => localStorage.getItem('save-start'))).toBe('preflows');
		expect(await page.evaluate(() => localStorage.getItem('save-count'))).toBe('3');
		await page.getByPlaceholder('type here', { exact: true }).fill('Independent copy');
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		await closeFlow(page);
		await open(page, 'Chosen name.json');
		await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue('Later edit');
	}
);

nativeTest(
	'saved flows autosave argument and page-title typing without blur or another Save',
	async ({ page }) => {
		await nativeFolder(page);
		await title(page).fill('Autosave round');
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
		await expect(page.locator('.save-status')).toHaveText('Saved to folder');
		const filename = 'Autosave round.json';
		const argument = page.getByPlaceholder('type here', { exact: true });
		const readArgument = async () => {
			const saved = await disk(page, filename);
			const flow = saved.nodes[saved.nodes.root.children[0]];
			return saved.nodes[flow.children[0]].value.content;
		};
		await argument.fill('Typed without leaving the argument');
		await expect.poll(readArgument).toBe('Typed without leaving the argument');
		await expect(argument).toBeFocused();
		await argument.press('End');
		await argument.pressSequentially(' and kept typing');
		await expect.poll(readArgument).toBe('Typed without leaving the argument and kept typing');
		await expect(argument).toBeFocused();
		const pageTitle = page.getByPlaceholder('type name here');
		await pageTitle.fill('Renamed page without blur');
		await expect
			.poll(async () => {
				const saved = await disk(page, filename);
				return saved.nodes[saved.nodes.root.children[0]].value.content;
			})
			.toBe('Renamed page without blur');
		await expect(pageTitle).toBeFocused();
		expect(await page.evaluate(() => localStorage.getItem('save-count'))).toBe('1');
	}
);

test('local-only browsers import folders into local flows and autosave without close or save prompts', async ({
	page,
	browserName
}) => {
	test.skip(browserName === 'chromium');
	await page.addInitScript(() =>
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 1,
				isSettings: true,
				settings: { showSideDoc: true, telemetry: 0 }
			})
		)
	);
	await page.goto('/app');
	await expect(page.getByText(/Folder importing will be buggy/)).toHaveCount(0);
	await page.getByLabel('Import flow folder').setInputFiles(fixtures);
	await expect(page.getByRole('heading', { name: 'Local flows' })).toBeVisible();
	const cards = page.locator('.prelude .flows .flow');
	await expect(cards).toHaveCount(2);
	const local = (name: string) => cards.filter({ has: page.getByText(name, { exact: true }) });
	await expect(local('Round')).toBeVisible();
	await expect(local('Preflow')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Import folder', exact: true })).toBeEnabled();
	await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toHaveCount(0);
	await expect(page.getByText('recovered', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Flow library', exact: true })).toHaveCount(0);
	const dialogs: string[] = [];
	let downloads = 0;
	page.on('dialog', (dialog) => {
		dialogs.push(dialog.message());
		void dialog.dismiss();
	});
	page.on('download', () => {
		downloads++;
	});
	await local('Round').getByRole('button', { name: 'open', exact: true }).click();
	await title(page).fill('Edited local round');
	await page.getByPlaceholder('type here', { exact: true }).fill('Autosaved local argument');
	await page.getByPlaceholder('type notes here').fill('Local round notes');
	await expect(page.locator('.save-status')).toHaveText('Saved in browser');
	await expect
		.poll(() =>
			page.evaluate(() =>
				Object.keys(JSON.parse(localStorage.getItem('savedFlows')!))
					.map((key) => localStorage.getItem(key))
					.join('')
			)
		)
		.toContain('Autosaved local argument');
	await page.getByRole('button', { name: 'Save flow', exact: true }).click();
	await page.keyboard.press('Escape');
	await closeFlow(page);
	expect(dialogs).toEqual([]);
	expect(downloads).toBe(0);
	await expect(local('Round')).toHaveCount(0);
	await expect(local('Edited local round').getByRole('button')).toHaveCount(4);
	await page.reload();
	await local('Edited local round').getByRole('button', { name: 'open', exact: true }).click();
	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
		'Autosaved local argument'
	);
	await expect(page.getByPlaceholder('type notes here')).toHaveValue('Local round notes');
	await closeFlow(page);
	await local('Edited local round').getByRole('button', { name: 'duplicate', exact: true }).click();
	await expect(title(page)).toHaveValue('Edited local round copy');
	await closeFlow(page);
	await expect(cards).toHaveCount(3);
	const downloadEvent = page.waitForEvent('download');
	await local('Edited local round copy')
		.getByRole('button', { name: 'download', exact: true })
		.click();
	const downloaded = await downloadEvent;
	const raw = JSON.parse(await readFile((await downloaded.path())!, 'utf8'));
	expect(raw.title).toBe('Edited local round copy');
	expect(raw.sideDocText).toBe('Local round notes');
	// Local deletion removes only the browser document.
	page.removeAllListeners('dialog');
	page.once('dialog', (dialog) => dialog.accept());
	await local('Edited local round copy')
		.getByRole('button', { name: 'delete', exact: true })
		.click();
	await expect(cards).toHaveCount(2);
	await expect(local('Edited local round')).toBeVisible();
});

test('local folder imports retain more than twenty flows and existing local saves', async ({
	page,
	browserName
}) => {
	test.skip(browserName === 'chromium');
	const folder = await mkdtemp(path.join(tmpdir(), 'flew-local-import-'));
	try {
		await Promise.all(
			Array.from({ length: 24 }, (_, index) =>
				writeFile(
					path.join(folder, `Round ${index}.json`),
					JSON.stringify({ ...round, title: `Imported ${index}` })
				)
			)
		);
		await page.goto('/app');
		await title(page).fill('Existing local');
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		await closeFlow(page);
		await page.getByLabel('Import flow folder').setInputFiles(folder);
		const cards = page.locator('.prelude .flows .flow');
		await expect(cards).toHaveCount(25);
		const existing = cards.filter({ has: page.getByText('Existing local', { exact: true }) });
		await existing.getByRole('button', { name: 'open', exact: true }).click();
		await page
			.getByPlaceholder('type here', { exact: true })
			.fill('Autosave keeps the entire local library');
		await closeFlow(page);
		await page.reload();
		await expect(cards).toHaveCount(25);
		await expect(existing).toBeVisible();
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
});

test('previous imported-folder snapshots migrate into local flows without dropping browser saves', async ({
	page,
	browserName
}) => {
	test.skip(browserName === 'chromium');
	await page.goto('/app');
	await page.evaluate(async (data) => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('flew-flow-library', 1);
			request.onupgradeneeded = () => request.result.createObjectStore('library');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction('library', 'readwrite');
			tx.objectStore('library').put(
				{
					name: 'Old folder',
					id: 'old-folder',
					files: {
						'Round.json': JSON.stringify(data),
						'nested/Other.json': JSON.stringify({ ...data, title: 'Other imported round' })
					}
				},
				'folder'
			);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
		localStorage.setItem('flow:existing', JSON.stringify({ ...data, title: 'Existing recovery' }));
		localStorage.setItem(
			'savedFlows',
			JSON.stringify({
				'flow:existing': {
					title: 'Existing recovery',
					created: new Date().toISOString(),
					modified: new Date().toISOString(),
					flowInfos: []
				}
			})
		);
	}, round);
	await page.reload();
	const cards = page.locator('.prelude .flows .flow');
	await expect(cards).toHaveCount(3);
	await expect(
		cards.filter({ has: page.getByText('Existing recovery', { exact: true }) })
	).toBeVisible();
	await expect(
		cards.filter({ has: page.getByText('Other imported round', { exact: true }) })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Local flows' })).toBeVisible();
	await page.reload();
	await expect(cards).toHaveCount(3);
});

nativeTest(
	'native Save offers Excel and exports a workbook without binding it as JSON',
	async ({ page }) => {
		await nativeFolder(page);
		await title(page).fill('Excel export');
		await page.getByRole('button', { name: 'New flow', exact: true }).click();
		await expect(
			page.getByRole('button', { name: 'Close without saving', exact: true })
		).toBeEnabled();
		await page.getByPlaceholder('type here', { exact: true }).fill('Exported argument');
		await page.evaluate(() => localStorage.setItem('save-as-path', 'Export.xlsx'));
		await page.getByPlaceholder('type here', { exact: true }).press('Control+s');
		await expect
			.poll(async () =>
				page.evaluate(async () => {
					const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
					try {
						return (await (await dir.getFileHandle('Export.xlsx')).getFile()).size;
					} catch {
						return 0;
					}
				})
			)
			.toBeGreaterThan(0);
		const types = JSON.parse((await page.evaluate(() => localStorage.getItem('save-types')))!);
		expect(
			types.flatMap((type: { accept: Record<string, string[]> }) =>
				Object.values(type.accept).flat()
			)
		).toEqual(['.json', '.xlsx']);
		const bytes = await page.evaluate(async () => {
			const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
			return Array.from(
				new Uint8Array(
					await (await (await dir.getFileHandle('Export.xlsx')).getFile()).arrayBuffer()
				)
			);
		});
		const { default: ExcelJS } = await import('exceljs');
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(new Uint8Array(bytes).buffer);
		expect(JSON.stringify(workbook.worksheets[0].getSheetValues())).toContain('Exported argument');
		await page.getByPlaceholder('type here', { exact: true }).fill('Later browser edit');
		await expect
			.poll(() =>
				page.evaluate(() =>
					Object.keys(JSON.parse(localStorage.getItem('savedFlows')!))
						.map((key) => localStorage.getItem(key))
						.join('')
				)
			)
			.toContain('Later browser edit');
		await expect(page.locator('.save-status')).toHaveText('Not saved to disk');
		await closeFlow(page);
		await expect(lib(page).getByRole('button', { name: 'Download', exact: true })).toHaveCount(0);
	}
);

nativeTest(
	'large folders keep header padding and sort files by latest modification',
	async ({ page }) => {
		await nativeFolder(page);
		await page.evaluate(async (data) => {
			const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
			for (let index = 0; index < 35; index++) {
				const handle = await dir.getFileHandle(`A${index}.json`, { create: true });
				const stream = await handle.createWritable();
				await stream.write(JSON.stringify(data));
				await stream.close();
			}
			const handle = await dir.getFileHandle('Z newest.json', { create: true });
			const stream = await handle.createWritable();
			await stream.write(JSON.stringify(data));
			await stream.close();
		}, round);
		await page.getByRole('button', { name: 'Refresh', exact: true }).click();
		await expect(lib(page).locator('[data-filename]').first()).toHaveAttribute(
			'data-filename',
			'Z newest.json'
		);
		await expect(page.getByRole('heading', { name: 'Flows', exact: true })).toBeVisible();
		const above = page.locator('.prelude .above');
		const dimensions = await above.evaluate((element) => ({
			height: element.getBoundingClientRect().height,
			minimum: parseFloat(getComputedStyle(element).minHeight)
		}));
		expect(dimensions.height).toBeGreaterThanOrEqual(dimensions.minimum);
		await expect(lib(page).getByRole('button', { name: 'Download', exact: true })).toHaveCount(0);
	}
);
