# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: consistency.spec.ts >> pasted CardMirror cards keep complete evidence and native drag HTML
- Location: tests/consistency.spec.ts:47:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: locator('.flow textarea').first()
Timeout: 5000ms
Expected: "Transit improves access
Rivera 2026, transport research"
Received: ""

Call log:
  - Expect "toHaveValue" locator('.flow textarea').first() with timeout 5000ms
  - waiting for locator('.flow textarea').first()
    14 × locator resolved to <textarea draggable="false" spellcheck="false" class="svelte-1ilfv2h" placeholder="type here"></textarea>
       - unexpected value ""

```

```yaml
- textbox "type here"
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import { readFile } from 'node:fs/promises';
  3   | import JSZip from 'jszip';
  4   | test.use({ serviceWorkers: 'block' });
  5   | async function setup(page: Page, values: Record<string, unknown> = {}) {
  6   | 	await page.addInitScript((values) => {
  7   | 		localStorage.setItem(
  8   | 			'settings',
  9   | 			JSON.stringify({
  10  | 				isSettings: true,
  11  | 				version: 3,
  12  | 				settings: { telemetry: 0, transitionSpeed: 0, ...values }
  13  | 			})
  14  | 		);
  15  | 	}, values);
  16  | 	await page.goto('/app');
  17  | }
  18  | const card =
  19  | 	'<div class="pmd-card"><h4 class="pmd-tag">Transit improves access</h4><p class="pmd-cite-para">Rivera 2026, transport research</p><p class="pmd-card-body">Complete <strong>evidence</strong> with <u>underlining</u> and <mark>highlighting</mark>.</p></div>';
  20  | 
  21  | test('fresh layout is left tabs and collapsed timers with no right sidebar', async ({ page }) => {
  22  | 	await setup(page);
  23  | 	await expect(page.locator('.right-sidebar')).toHaveCount(0);
  24  | 	await expect(page.locator('[data-panel="tabsPanel"]')).toBeVisible();
  25  | 	await expect(page.locator('.timer-panel')).not.toBeVisible();
  26  | 	await page.getByRole('button', { name: 'Timers', exact: true }).click();
  27  | 	await expect(page.locator('.timer-panel')).toBeVisible();
  28  | });
  29  | 
  30  | test('all panels share menus, tutorials and optional names', async ({ page }) => {
  31  | 	await setup(page, { notesPanel: 2, timersPanel: 1 });
  32  | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  33  | 	for (const name of ['Tabs', 'Notes', 'Timers']) {
  34  | 		await page.getByRole('button', { name: name + ' menu', exact: true }).click();
  35  | 		await expect(
  36  | 			page.getByRole('menuitem', { name: 'How to use ' + name, exact: true })
  37  | 		).toBeVisible();
  38  | 		await expect(page.getByRole('menuitem', { name: 'Settings', exact: true })).toBeVisible();
  39  | 		await page.getByRole('menuitem', { name: 'Hide panel name', exact: true }).click();
  40  | 		await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
  41  | 		await page.getByRole('button', { name: name + ' menu', exact: true }).click();
  42  | 		await page.getByRole('menuitem', { name: 'Show panel name', exact: true }).click();
  43  | 		await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  44  | 	}
  45  | });
  46  | 
  47  | test('pasted CardMirror cards keep complete evidence and native drag HTML', async ({ page }) => {
  48  | 	await setup(page, { timersPanel: 0 });
  49  | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  50  | 	await page
  51  | 		.locator('.flow textarea')
  52  | 		.first()
  53  | 		.evaluate((element, html) => {
  54  | 			const clipboardData = new DataTransfer();
  55  | 			clipboardData.setData('text/html', html);
  56  | 			clipboardData.setData('text/plain', 'Transit improves access');
  57  | 			element.dispatchEvent(
  58  | 				new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })
  59  | 			);
  60  | 		}, card);
  61  | 	const field = page.locator('.flow textarea').first();
> 62  | 	await expect(field).toHaveValue('Transit improves access\nRivera 2026, transport research');
      |                      ^ Error: expect(locator).toHaveValue(expected) failed
  63  | 	await expect(page.getByLabel('CardMirror card', { exact: true })).toBeVisible();
  64  | 	const html = await page
  65  | 		.locator('.flow [data-box-id]')
  66  | 		.first()
  67  | 		.evaluate((element) => {
  68  | 			const dataTransfer = new DataTransfer();
  69  | 			element.dispatchEvent(
  70  | 				new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer })
  71  | 			);
  72  | 			return dataTransfer.getData('text/html');
  73  | 		});
  74  | 	expect(html).toContain('Complete');
  75  | 	expect(html).toContain('underlining');
  76  | 	expect(html).toContain('<strong>evidence</strong>');
  77  | 	await page.keyboard.press('Control+z');
  78  | 	await expect(page.locator('.flow textarea').first()).toHaveValue('');
  79  | });
  80  | 
  81  | test('Autoflow imports replace an empty page and full block text drops into Notes', async ({
  82  | 	page
  83  | }) => {
  84  | 	await setup(page, { timersPanel: 0, autoflowPanel: 1, notesPanel: 2 });
  85  | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  86  | 	await page
  87  | 		.locator('.autoflow-panel input[type=file]')
  88  | 		.setInputFiles('test-files/autoflow/headings.docx');
  89  | 	const block = page.locator('.autoflow-panel .blocks [draggable=true]').first();
  90  | 	await expect(block).toBeVisible();
  91  | 	await block.dragTo(page.getByLabel('Notes', { exact: true }));
  92  | 	await expect(page.getByLabel('Notes', { exact: true })).not.toHaveValue('');
  93  | 	const firstBlock = page.locator('.autoflow-panel .blocks > div').first();
  94  | 	await firstBlock.getByRole('button').last().click();
  95  | 	await expect(page.locator('.tabs li')).toHaveCount(1);
  96  | 	await expect(page.locator('.flow textarea').first()).not.toHaveValue('');
  97  | 	await page.keyboard.press('Control+z');
  98  | 	await expect(page.locator('.flow textarea').first()).toHaveValue('');
  99  | });
  100 | 
  101 | test('flow page multi-selection deletes together and undo restores pages', async ({ page }) => {
  102 | 	await setup(page, { timersPanel: 0 });
  103 | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  104 | 	await page.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
  105 | 	const tabs = page.locator('.tabs li button');
  106 | 	await tabs.first().click();
  107 | 	await tabs.last().click({ modifiers: ['Shift'] });
  108 | 	await page.getByRole('button', { name: 'Tabs menu', exact: true }).click();
  109 | 	page.once('dialog', (dialog) => dialog.accept());
  110 | 	await page.getByRole('menuitem', { name: 'Delete selected pages', exact: true }).click();
  111 | 	await expect(page.locator('.tabs li')).toHaveCount(0);
  112 | 	await page.keyboard.press('Control+z');
  113 | 	await expect(page.locator('.tabs li')).toHaveCount(2);
  114 | });
  115 | 
  116 | test('single-box selection mode supports dragging before editing', async ({ page }) => {
  117 | 	await setup(page, { timersPanel: 0, clickToSelectBoxes: true });
  118 | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  119 | 	const cells = page.locator('.flow textarea');
  120 | 	await cells.first().fill('Move this');
  121 | 	await cells.first().press('Enter');
  122 | 	await cells.nth(1).fill('Target');
  123 | 	await cells.first().click();
  124 | 	await expect(page.locator('.flow .box.selected')).toHaveCount(1);
  125 | 	await cells.first().dragTo(page.locator('.flow [data-box-id]').nth(1));
  126 | 	await expect(page.locator('.flow .box:has(> [data-box-id])')).toHaveCount(2);
  127 | 	await page.keyboard.press('Control+z');
  128 | 	await cells.first().dblclick();
  129 | 	await expect(cells.first()).toBeEditable();
  130 | });
  131 | 
  132 | test('selecting a speech model preloads once and panel changes keep it loaded', async ({
  133 | 	page
  134 | }) => {
  135 | 	await page.addInitScript(() => {
  136 | 		const events: string[] = [];
  137 | 		Object.assign(window, { modelEvents: events });
  138 | 		class ModelWorker {
  139 | 			onmessage: ((event: { data: { ready: boolean; model: string } }) => void) | null = null;
  140 | 			onerror: ((event: Event) => void) | null = null;
  141 | 			postMessage(data: { model?: number }) {
  142 | 				events.push('load:' + data.model);
  143 | 				queueMicrotask(() => this.onmessage?.({ data: { ready: true, model: 'Example' } }));
  144 | 			}
  145 | 			terminate() {
  146 | 				events.push('terminate');
  147 | 			}
  148 | 		}
  149 | 		Object.defineProperty(window, 'Worker', { value: ModelWorker });
  150 | 	});
  151 | 	await setup(page, { transcriptPanel: 2, timersPanel: 0 });
  152 | 	await page.locator('.header button').nth(1).click();
  153 | 	await page.getByRole('radio', { name: 'Fast', exact: true }).focus();
  154 | 	await page.keyboard.press('Space');
  155 | 	await expect(page.getByText('Model ready', { exact: true })).toBeVisible();
  156 | 	await page.keyboard.press('Escape');
  157 | 	await page.getByRole('button', { name: 'Transcript menu', exact: true }).click();
  158 | 	await page.getByRole('menuitem', { name: 'Hide panel', exact: true }).click();
  159 | 	await page.locator('#uploadId').setInputFiles({
  160 | 		name: 'settings.json',
  161 | 		mimeType: 'application/json',
  162 | 		buffer: Buffer.from(
```