import { test, expect, type Page, type Locator } from '@playwright/test';

declare global {
	interface Window {
		selectionCopy?: string;
	}
}

const cells = (page: Page) => page.locator('.flow .box textarea');
const selected = (page: Page) => page.locator('.flow .box.selected');

async function setup(page: Page, count = 4) {
	await page.addInitScript(() => {
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 1,
				isSettings: true,
				settings: { telemetry: 0, transitionSpeed: 0 }
			})
		);
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (value: string) => {
					Object.assign(window, { selectionCopy: value });
				}
			}
		});
	});
	await page.goto('/app');
	const ids = Array.from({ length: count }, (_, i) => `box-${i}`);
	const data = {
		version: 1,
		title: 'Selection',
		nodes: {
			root: { value: { tag: 'root' }, parent: null, level: -1, children: ['flow-a'] },
			'flow-a': {
				value: { tag: 'flow', content: 'aff', invert: false, columns: ['AC', 'NC', 'AR'] },
				parent: 'root',
				level: 0,
				children: ids
			},
			...Object.fromEntries(
				ids.map((id, i) => [
					id,
					{
						value: { tag: 'box', content: `Card ${i + 1} alpha beta gamma`, flowId: 'flow-a' },
						parent: 'flow-a',
						level: 1,
						children: []
					}
				])
			)
		}
	};
	await page.locator('#uploadId').setInputFiles({
		name: 'Selection.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(data))
	});
	await expect(cells(page)).toHaveCount(count);
	await page.evaluate(() => new Promise(requestAnimationFrame));
}

async function point(cell: Locator, fraction = 0.3) {
	const rect = await cell.boundingBox();
	if (!rect) throw new Error('Cell is not visible');
	return { x: rect.x + rect.width * fraction, y: rect.y + Math.min(rect.height / 2, 10) };
}

async function drag(page: Page, from: Locator, to: Locator) {
	const start = await point(from);
	const end = await point(to);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(end.x, end.y, { steps: 16 });
	await page.mouse.up();
}

test('drag selects a cell range in either direction, persists after release and creates a group', async ({
	page
}) => {
	await setup(page);
	await drag(page, cells(page).nth(0), cells(page).nth(2));
	await expect(selected(page)).toHaveCount(3);
	const fourth = await point(cells(page).nth(3));
	await page.mouse.move(fourth.x, fourth.y);
	await expect(selected(page)).toHaveCount(3);
	await cells(page).nth(0).click();
	await expect(selected(page)).toHaveCount(0);
	await drag(page, cells(page).nth(2), cells(page).nth(0));
	await expect(selected(page)).toHaveCount(3);
	await page.keyboard.press('Shift+Enter');
	await expect(cells(page)).toHaveCount(5);
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
	await expect(selected(page)).toHaveCount(0);
});

test('cell selection can start in the padding and keeps keyboard actions available', async ({
	page
}) => {
	await setup(page);
	const first = cells(page).nth(0);
	const start = await first.evaluate((element) => {
		const rect = element.closest('[data-box-id]')!.getBoundingClientRect();
		return { x: rect.left + 1, y: rect.top + rect.height / 2 };
	});
	const end = await point(cells(page).nth(2));
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(end.x, end.y, { steps: 16 });
	await page.mouse.up();
	await expect(selected(page)).toHaveCount(3);
	await expect(first).toBeFocused();
	await page.keyboard.press('Shift+Enter');
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
});

test('dragged cells copy and cut through the existing selection actions', async ({ page }) => {
	await setup(page);
	await drag(page, cells(page).nth(0), cells(page).nth(2));
	await expect(selected(page)).toHaveCount(3);
	await page.keyboard.press('Control+c');
	const copy = await page.evaluate(() => window.selectionCopy ?? '');
	const payload = JSON.parse(copy);
	expect(payload.tag).toBe('flew-notes-boxes');
	expect(payload.boxes.map((box: { value: { content: string } }) => box.value.content)).toEqual([
		'Card 1 alpha beta gamma',
		'Card 2 alpha beta gamma',
		'Card 3 alpha beta gamma'
	]);
	await page.keyboard.press('Control+x');
	await expect(cells(page)).toHaveCount(1);
	await expect(cells(page)).toHaveValue('Card 4 alpha beta gamma');
	await page.keyboard.press('Control+z');
	await expect(cells(page)).toHaveCount(4);
});

test('dragging within one cell still selects text and single clicks still place the caret', async ({
	page
}) => {
	await setup(page);
	const first = cells(page).nth(0);
	const start = await point(first, 0.1);
	const end = await point(first, 0.65);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(end.x, end.y, { steps: 12 });
	await page.mouse.up();
	await expect(selected(page)).toHaveCount(0);
	expect(
		await first.evaluate(
			(element) =>
				(element as HTMLTextAreaElement).selectionEnd -
				(element as HTMLTextAreaElement).selectionStart
		)
	).toBeGreaterThan(0);
	await first.click();
	expect(
		await first.evaluate(
			(element) =>
				(element as HTMLTextAreaElement).selectionEnd -
				(element as HTMLTextAreaElement).selectionStart
		)
	).toBe(0);
	await expect(selected(page)).toHaveCount(0);
});

test('drag selection spans speech columns without changing cell text', async ({ page }) => {
	await setup(page);
	await cells(page).nth(0).press('Shift+Enter');
	await page.keyboard.type('Response in the next speech');

	await drag(page, cells(page).nth(0), cells(page).nth(1));
	await expect(selected(page)).toHaveCount(2);
	await expect(cells(page).nth(0)).toHaveValue('Card 1 alpha beta gamma');
	await expect(cells(page).nth(1)).toHaveValue('Response in the next speech');
});

test('drag selection scrolls at the edge and ends when released outside the flow', async ({
	page
}) => {
	await page.setViewportSize({ width: 900, height: 500 });
	await setup(page, 30);
	const start = await point(cells(page).nth(0));
	const second = await point(cells(page).nth(1));
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(second.x, second.y, { steps: 8 });
	await expect(selected(page)).toHaveCount(2);
	const scroll = page.locator('.flow .viewer > .content');
	const bounds = await scroll.boundingBox();
	if (!bounds) throw new Error('Flow is not visible');
	await page.mouse.move(second.x, bounds.y + bounds.height - 4, { steps: 8 });
	await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);
	await expect.poll(() => selected(page).count()).toBeGreaterThan(3);
	await page.mouse.move(second.x, bounds.y - 10);
	await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0);
	await expect(selected(page)).toHaveCount(1);
	await page.mouse.move(10, 10);
	await page.mouse.up();
	const stopped = await scroll.evaluate((element) => element.scrollTop);
	await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 150)));
	expect(await scroll.evaluate((element) => element.scrollTop)).toBe(stopped);
});

test('Escape cancels a cell drag and touch gestures keep their native behavior', async ({
	page
}) => {
	await setup(page);
	const start = await point(cells(page).nth(0));
	const end = await point(cells(page).nth(2));
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(end.x, end.y, { steps: 12 });
	await expect(selected(page)).toHaveCount(3);
	await page.keyboard.press('Escape');
	await page.mouse.up();
	await expect(selected(page)).toHaveCount(0);
	await cells(page)
		.nth(0)
		.dispatchEvent('pointerdown', { pointerId: 100, pointerType: 'touch', button: 0, buttons: 1 });
	await cells(page)
		.nth(2)
		.dispatchEvent('pointermove', { pointerId: 100, pointerType: 'touch', buttons: 1 });
	await cells(page)
		.nth(2)
		.dispatchEvent('pointerup', { pointerId: 100, pointerType: 'touch', button: 0 });
	await expect(selected(page)).toHaveCount(0);
	await drag(page, cells(page).nth(0), cells(page).nth(2));
	await expect(selected(page)).toHaveCount(3);
});

test('shift-click formats every selected cell in one undo step', async ({ page }) => {
	await setup(page);
	await cells(page).nth(0).click();
	await cells(page)
		.nth(2)
		.click({ modifiers: ['Shift'] });
	await expect(selected(page)).toHaveCount(3);
	await page.keyboard.press('Control+b');
	await expect(page.locator('.flow .text.bold')).toHaveCount(3);
	await page.keyboard.press('Control+z');
	await expect(page.locator('.flow .text.bold')).toHaveCount(0);
});

test('a selection can be moved onto another argument and undone without changing its IDs', async ({
	page
}) => {
	await setup(page);
	await cells(page).nth(0).click();
	await cells(page)
		.nth(1)
		.click({ modifiers: ['Shift'] });
	await expect(selected(page)).toHaveCount(2);
	await page.evaluate(() => {
		const original = DataTransfer.prototype.setDragImage;
		DataTransfer.prototype.setDragImage = function (element, x, y) {
			Object.assign(window, {
				dragPreview: [...element.children].map((child) => ({
					id: (child as HTMLElement).dataset.dragBoxId,
					x: parseFloat((child as HTMLElement).style.left),
					y: parseFloat((child as HTMLElement).style.top)
				}))
			});
			original.call(this, element, x, y);
		};
	});
	const source = page.locator('[data-box-id="box-0"]');
	await source.dragTo(page.locator('[data-box-id="box-3"]'));
	await expect(
		page.locator('.box').filter({ has: page.locator('[data-box-id="box-3"]') })
	).not.toHaveCount(0);
	const preview = await page.evaluate(
		() => (window as unknown as { dragPreview: { id: string; x: number; y: number }[] }).dragPreview
	);
	expect(preview.map((cell) => cell.id)).toEqual(['box-0', 'box-1']);
	expect(preview[0].x).toBe(preview[1].x);
	expect(preview[1].y).toBeGreaterThan(preview[0].y);
	await expect(
		page.locator('.box:has(> [data-box-id="box-3"]) > .children [data-box-id]')
	).toHaveCount(2);
	await page.keyboard.press('Control+z');
	await expect(page.locator('.flow [data-box-id="box-0"]')).toHaveCount(1);
	await expect(page.locator('.flow [data-box-id="box-0"]')).toBeVisible();
	await expect(
		page.locator('.box:has(> [data-box-id="box-3"]) > .children [data-box-id]')
	).toHaveCount(0);
});

test('formatting a range skips extension spacers', async ({ page }) => {
	await setup(page);
	await cells(page).first().click();
	await page.keyboard.press('Control+e');
	await page.keyboard.type('Extended response');
	await cells(page).first().click();
	await cells(page)
		.nth(2)
		.click({ modifiers: ['Shift'] });
	await page.keyboard.press('Control+b');
	await expect(page.locator('.flow .text.bold')).toHaveCount(2);
	await page.keyboard.press('Control+c');
	const copied = JSON.parse(await page.evaluate(() => window.selectionCopy ?? ''));
	expect(copied.boxes[0].value.bold).toBe(true);
	expect(copied.boxes[0].children[0].value.isExtension).toBe(true);
	expect(copied.boxes[0].children[0].value.bold).toBeUndefined();
});

test('children across different parents form a column rectangle without selecting their parents', async ({
	page
}) => {
	await setup(page);
	const original = (id: string) => page.locator(`[data-box-id="${id}"] textarea`);
	await original('box-0').press('Shift+Enter');
	await page.keyboard.type('First child');
	await original('box-1').press('Shift+Enter');
	await page.keyboard.type('Second child');
	const responses = page.locator('.flow textarea');
	const firstResponse = responses.nth(1),
		secondResponse = responses.nth(3);
	await expect(firstResponse).toHaveValue('First child');
	await expect(secondResponse).toHaveValue('Second child');
	await drag(page, firstResponse, secondResponse);
	await expect(selected(page)).toHaveCount(2);
	expect(
		await selected(page)
			.locator(':scope > .content textarea')
			.evaluateAll((cells) => cells.map((cell) => (cell as HTMLTextAreaElement).value))
	).toEqual(['First child', 'Second child']);
	await original('box-3').click();
	await firstResponse.click();
	await secondResponse.click({ modifiers: ['Shift'] });
	await expect(selected(page)).toHaveCount(2);
	await page.keyboard.press('Control+b');
	await expect(page.locator('.flow .text.bold')).toHaveCount(2);
	await expect(page.locator('[data-box-id="box-1"] .text')).not.toHaveClass(/bold/);
});

test('Ctrl/Cmd click picks individual cells and joined corners follow the selected surfaces', async ({
	page
}) => {
	await setup(page);
	await cells(page).nth(0).click();
	await cells(page)
		.nth(2)
		.click({ modifiers: ['ControlOrMeta'] });
	await expect(selected(page)).toHaveCount(1);
	// Ctrl/Cmd-click toggles independent cells; the focused cell is added explicitly.
	await cells(page)
		.nth(0)
		.click({ modifiers: ['ControlOrMeta'] });
	await expect(selected(page)).toHaveCount(2);
	await cells(page)
		.nth(2)
		.click({ modifiers: ['ControlOrMeta'] });
	await expect(selected(page)).toHaveCount(1);
	await cells(page).nth(1).click();
	await cells(page).nth(1).press('Shift+Enter');
	await page.keyboard.type('Adjacent child');
	const parent = page.locator('[data-box-id="box-1"]');
	const response = page.locator('.flow textarea').nth(2);
	await drag(page, parent.locator('textarea'), response);
	await expect(selected(page)).toHaveCount(2);
	await expect
		.poll(() => parent.evaluate((el) => getComputedStyle(el).borderTopRightRadius))
		.toBe('0px');
	expect(
		await parent.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))
	).toBeGreaterThan(0);
	const childContent = response.locator('xpath=ancestor::*[@data-box-id]');
	await expect
		.poll(() => childContent.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))
		.toBe('0px');
	expect(
		await childContent.evaluate((el) => parseFloat(getComputedStyle(el).borderTopRightRadius))
	).toBeGreaterThan(0);
});

test('selection surfaces follow themes and resized typography, padding and corner settings', async ({
	page
}) => {
	await setup(page);
	await cells(page).nth(0).press('Shift+Enter');
	await page.keyboard.type('Adjacent response');
	await drag(page, cells(page).nth(0), cells(page).nth(1));
	const parent = page.locator('.flow [data-box-id="box-0"]');
	for (const theme of ['light', 'dark', 'custom']) {
		await page.evaluate((theme) => {
			document.body.classList.toggle('dark', theme === 'dark');
			document.body.classList.toggle('custom', theme === 'custom');
			document.body.style.setProperty('--padding', '12px');
			document.body.style.setProperty('--border-radius', '36px');
			document.body.style.fontSize = '24px';
			document.body.style.setProperty('--custom-background-accent-active', '#ffccff');
			document.body.style.setProperty('--custom-background-accent-secondary-active', '#ccffcc');
		}, theme);
		await expect(selected(page)).toHaveCount(2);
		await expect
			.poll(() => parent.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))
			.toBe('18px');
		await expect
			.poll(() => parent.evaluate((el) => getComputedStyle(el).borderTopRightRadius))
			.toBe('0px');
		expect(await parent.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
			'rgba(0, 0, 0, 0)'
		);
	}
});

test('dragging a multiselection from its textarea inserts between siblings and keeps its children', async ({
	page
}) => {
	await setup(page);
	await cells(page).first().press('Shift+Enter');
	await page.keyboard.type('Child response');
	const first = page.locator('[data-box-id="box-0"] textarea');
	const second = page.locator('[data-box-id="box-1"] textarea');
	await first.click();
	await first.click({ modifiers: ['ControlOrMeta'] });
	await second.click({ modifiers: ['ControlOrMeta'] });
	await expect(selected(page)).toHaveCount(2);
	const target = page.locator('[data-box-id="box-3"]');
	await first.dragTo(target, { targetPosition: { x: 30, y: 1 } });
	const roots = page.locator('.flow .boxes > .box > .children > .box > .content');
	await expect
		.poll(() =>
			roots.evaluateAll((elements) => elements.map((el) => (el as HTMLElement).dataset.boxId))
		)
		.toEqual(['box-2', 'box-0', 'box-1', 'box-3']);
	await expect(page.locator('.box:has(> [data-box-id="box-0"]) > .children textarea')).toHaveValue(
		'Child response'
	);
	await page.keyboard.press('Control+z');
	await expect
		.poll(() =>
			roots.evaluateAll((elements) => elements.map((el) => (el as HTMLElement).dataset.boxId))
		)
		.toEqual(['box-0', 'box-1', 'box-2', 'box-3']);
});
