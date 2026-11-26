# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: persistancy.spec.ts >> saved flows autosave argument and page-title typing without blur or another Save
- Location: tests/persistancy.spec.ts:715:1

# Error details

```
Error: page.evaluate: NotReadableError: The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.
```

# Test source

```ts
  53  | }
  54  | async function nativeFolder(page: Page, mainScreen = false) {
  55  | 	await page.addInitScript(() => {
  56  | 		Object.defineProperty(window, 'showDirectoryPicker', {
  57  | 			value: async (options: { mode: string }) => {
  58  | 				localStorage.setItem('picker-mode', options.mode);
  59  | 				return (await navigator.storage.getDirectory()).getDirectoryHandle('Flows', {
  60  | 					create: true
  61  | 				});
  62  | 			}
  63  | 		});
  64  | 		Object.defineProperty(window, 'showSaveFilePicker', {
  65  | 			value: async (options: {
  66  | 				startIn: FileSystemDirectoryHandle;
  67  | 				suggestedName: string;
  68  | 				types: unknown[];
  69  | 			}) => {
  70  | 				localStorage.setItem('save-types', JSON.stringify(options.types));
  71  | 				localStorage.setItem(
  72  | 					'save-count',
  73  | 					String(Number(localStorage.getItem('save-count') ?? 0) + 1)
  74  | 				);
  75  | 				localStorage.setItem('save-start', options.startIn.name);
  76  | 				localStorage.setItem('save-suggestion', options.suggestedName);
  77  | 				localStorage.setItem('save-activation', String(navigator.userActivation.isActive));
  78  | 				if (localStorage.getItem('cancel-save')) {
  79  | 					localStorage.removeItem('cancel-save');
  80  | 					throw new DOMException('Cancelled', 'AbortError');
  81  | 				}
  82  | 				const chosen = localStorage.getItem('save-as-path');
  83  | 				if (chosen) {
  84  | 					const parts = chosen.split('/');
  85  | 					let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
  86  | 					for (const part of parts.slice(0, -1))
  87  | 						dir = await dir.getDirectoryHandle(part, { create: true });
  88  | 					return dir.getFileHandle(parts[parts.length - 1], { create: true });
  89  | 				}
  90  | 				let name = options.suggestedName;
  91  | 				let suffix = 2;
  92  | 				for (;;) {
  93  | 					try {
  94  | 						await options.startIn.getFileHandle(name);
  95  | 					} catch (error) {
  96  | 						if ((error as DOMException).name === 'NotFoundError') break;
  97  | 						throw error;
  98  | 					}
  99  | 					name = `${options.suggestedName.slice(0, -5)} (${suffix++}).json`;
  100 | 				}
  101 | 				return options.startIn.getFileHandle(name, { create: true });
  102 | 			}
  103 | 		});
  104 | 		Object.defineProperty(FileSystemHandle.prototype, 'queryPermission', {
  105 | 			configurable: true,
  106 | 			value: async function (this: FileSystemHandle) {
  107 | 				return localStorage.getItem('deny-folder') ||
  108 | 					(this.kind === 'directory' && localStorage.getItem('deny-directory-only'))
  109 | 					? 'prompt'
  110 | 					: 'granted';
  111 | 			}
  112 | 		});
  113 | 		Object.defineProperty(FileSystemHandle.prototype, 'requestPermission', {
  114 | 			configurable: true,
  115 | 			value: async () => {
  116 | 				localStorage.setItem('requested-write', 'true');
  117 | 				if (localStorage.getItem('reject-folder')) return 'denied';
  118 | 				localStorage.removeItem('deny-folder');
  119 | 				return 'granted';
  120 | 			}
  121 | 		});
  122 | 	});
  123 | 	await page.goto('/app');
  124 | 	await page.evaluate(async (data) => {
  125 | 		const root = await (
  126 | 			await navigator.storage.getDirectory()
  127 | 		).getDirectoryHandle('Flows', { create: true });
  128 | 		for (const [dir, name, raw] of [
  129 | 			[root, 'Round.json', JSON.stringify(data)],
  130 | 			[
  131 | 				await root.getDirectoryHandle('preflows', { create: true }),
  132 | 				'Preflow.json',
  133 | 				JSON.stringify({ ...data, title: 'Preflow', sideDocText: '' })
  134 | 			]
  135 | 		] as const) {
  136 | 			const stream = await (await dir.getFileHandle(name, { create: true })).createWritable();
  137 | 			await stream.write(raw);
  138 | 			await stream.close();
  139 | 		}
  140 | 	}, round);
  141 | 	if (mainScreen) {
  142 | 		await page.evaluate(() => localStorage.setItem('deny-folder', 'true'));
  143 | 		await page
  144 | 			.getByRole('button', { name: 'link a folder for automatic disk saves', exact: true })
  145 | 			.click();
  146 | 	} else
  147 | 		await page
  148 | 			.getByRole('button', { name: 'link a folder for automatic disk saves', exact: true })
  149 | 			.click();
  150 | 	await expect(row(page, 'Round.json')).toBeVisible();
  151 | }
  152 | async function disk(page: Page, name: string) {
> 153 | 	return await page.evaluate(async (name) => {
      |                    ^ Error: page.evaluate: NotReadableError: The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.
  154 | 		const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
  155 | 		return JSON.parse(await (await (await dir.getFileHandle(name)).getFile()).text());
  156 | 	}, name);
  157 | }
  158 | 
  159 | async function diskNames(page: Page): Promise<string[]> {
  160 | 	return page.evaluate(async () => {
  161 | 		const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
  162 | 		const names: string[] = [];
  163 | 		for await (const entry of (
  164 | 			root as FileSystemDirectoryHandle & { values(): AsyncIterableIterator<FileSystemHandle> }
  165 | 		).values())
  166 | 			names.push(entry.name);
  167 | 		return names;
  168 | 	});
  169 | }
  170 | 
  171 | test('browser recovery saves final pending text and document title, and duplicate is independent', async ({
  172 | 	page
  173 | }) => {
  174 | 	await page.goto('/app');
  175 | 	await expect(
  176 | 		page.locator('.addTab').getByRole('button', { name: 'aff', exact: true })
  177 | 	).toBeDisabled();
  178 | 	await expect(
  179 | 		page.locator('.addTab').getByRole('button', { name: 'neg', exact: true })
  180 | 	).toBeDisabled();
  181 | 	await title(page).fill('Browser round');
  182 | 	expect(await page.evaluate(() => localStorage.getItem('savedFlows'))).toBeNull();
  183 | 	await title(page).press('Enter');
  184 | 	await expect(title(page)).toHaveValue('Browser round');
  185 | 	await expect(page.getByPlaceholder('type name here')).toHaveValue('');
  186 | 	await title(page).press('Enter');
  187 | 	await expect(
  188 | 		page.getByRole('button', { name: /^Close (?:flow|without saving)$/, exact: true })
  189 | 	).toBeEnabled();
  190 | 	await expect(page.locator('.tabs li')).toHaveCount(1);
  191 | 	await expect(page.locator('.save-status')).toHaveText(/Saved in browser(?: recovery)?/);
  192 | 	const created = await page
  193 | 		.evaluate(
  194 | 			() => Object.values(JSON.parse(localStorage.getItem('savedFlows')!))[0] as { created: string }
  195 | 		)
  196 | 		.then((data) => data.created);
  197 | 	expect(created).toBeTruthy();
  198 | 	await expect(
  199 | 		page.locator('.prelude').getByRole('region', { name: 'Flow library setup', exact: true })
  200 | 	).toHaveCount(0);
  201 | 	await expect(
  202 | 		page.locator('.addTab').getByRole('button', { name: 'neg', exact: true })
  203 | 	).toBeEnabled();
  204 | 	await page.getByPlaceholder('type here', { exact: true }).fill('Last typed argument');
  205 | 	await expect(page.locator('.save-status')).toHaveText(/Saved in browser(?: recovery)?/);
  206 | 	if (await page.evaluate(() => !('showDirectoryPicker' in window)))
  207 | 		page.once('dialog', (dialog) => dialog.accept());
  208 | 	await page.reload();
  209 | 	const saved = page
  210 | 		.locator('.prelude .flow')
  211 | 		.filter({ has: page.getByText(/^(Recovered )?Browser round$/) });
  212 | 	await saved.getByRole('button', { name: /^(open|view and save to disk)$/ }).click();
  213 | 	await expect(title(page)).toHaveValue('Browser round');
  214 | 	await closeFlow(page);
  215 | 	const modified = await page.evaluate(
  216 | 		() =>
  217 | 			(Object.values(JSON.parse(localStorage.getItem('savedFlows')!)) as { modified: string }[])[0]
  218 | 				.modified
  219 | 	);
  220 | 	await expect(saved.locator('.flow-heading time')).toHaveAttribute('datetime', modified);
  221 | 	const heading = saved.locator('.flow-heading');
  222 | 	const titleBounds = await heading.locator('strong').boundingBox();
  223 | 	const dateBounds = await heading.locator('time').boundingBox();
  224 | 	expect(dateBounds!.x).toBeGreaterThan(titleBounds!.x);
  225 | 	expect(dateBounds!.y).toBe(titleBounds!.y);
  226 | 	await saved.getByRole('button', { name: /^(open|view and save to disk)$/ }).click();
  227 | 	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
  228 | 		'Last typed argument'
  229 | 	);
  230 | 	await closeFlow(page);
  231 | 
  232 | 	await saved.getByRole('button', { name: 'duplicate', exact: true }).click();
  233 | 	await expect(title(page)).toHaveValue('Browser round copy');
  234 | 	await page.getByPlaceholder('type here', { exact: true }).fill('Copy argument');
  235 | 	await expect(page.locator('.save-status')).toHaveText(/Saved in browser(?: recovery)?/);
  236 | 	await closeFlow(page);
  237 | 	await saved.getByRole('button', { name: /^(open|view and save to disk)$/ }).click();
  238 | 	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
  239 | 		'Last typed argument'
  240 | 	);
  241 | });
  242 | 
  243 | test('folder import retains subfolders across reload and supports rename, duplicate and delete', async ({
  244 | 	page
  245 | }) => {
  246 | 	await page.goto('/app');
  247 | 	test.skip(
  248 | 		await page.evaluate(() => !('showDirectoryPicker' in window)),
  249 | 		'Covered by the snapshot import and recovery export tests in browsers without writable handles.'
  250 | 	);
  251 | 	await expect(
  252 | 		page.getByRole('button', { name: 'link a folder for automatic disk saves', exact: true })
  253 | 	).toBeEnabled();
```