# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: selection.spec.ts >> cell selection can start in the padding and keeps keyboard actions available
- Location: tests/selection.spec.ts:100:1

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator:  locator('.flow .box textarea').first()
Expected: focused
Received: inactive
Timeout:  5000ms

Call log:
  - Expect "toBeFocused" locator('.flow .box textarea').first() with timeout 5000ms
  - waiting for locator('.flow .box textarea').first()
    14 × locator resolved to <textarea draggable="true" spellcheck="false" class="svelte-1ilfv2h" placeholder="type here"></textarea>
       - unexpected value "inactive"

```

```yaml
- textbox "type here": Card 1 alpha beta gamma
```

# Test source

```ts
  15  | 			'settings',
  16  | 			JSON.stringify({
  17  | 				version: 1,
  18  | 				isSettings: true,
  19  | 				settings: { telemetry: 0, transitionSpeed: 0 }
  20  | 			})
  21  | 		);
  22  | 		Object.defineProperty(navigator, 'clipboard', {
  23  | 			configurable: true,
  24  | 			value: {
  25  | 				writeText: async (value: string) => {
  26  | 					Object.assign(window, { selectionCopy: value });
  27  | 				}
  28  | 			}
  29  | 		});
  30  | 	});
  31  | 	await page.goto('/app');
  32  | 	const ids = Array.from({ length: count }, (_, i) => `box-${i}`);
  33  | 	const data = {
  34  | 		version: 1,
  35  | 		title: 'Selection',
  36  | 		nodes: {
  37  | 			root: { value: { tag: 'root' }, parent: null, level: -1, children: ['flow-a'] },
  38  | 			'flow-a': {
  39  | 				value: { tag: 'flow', content: 'aff', invert: false, columns: ['AC', 'NC', 'AR'] },
  40  | 				parent: 'root',
  41  | 				level: 0,
  42  | 				children: ids
  43  | 			},
  44  | 			...Object.fromEntries(
  45  | 				ids.map((id, i) => [
  46  | 					id,
  47  | 					{
  48  | 						value: { tag: 'box', content: `Card ${i + 1} alpha beta gamma`, flowId: 'flow-a' },
  49  | 						parent: 'flow-a',
  50  | 						level: 1,
  51  | 						children: []
  52  | 					}
  53  | 				])
  54  | 			)
  55  | 		}
  56  | 	};
  57  | 	await page.locator('#uploadId').setInputFiles({
  58  | 		name: 'Selection.json',
  59  | 		mimeType: 'application/json',
  60  | 		buffer: Buffer.from(JSON.stringify(data))
  61  | 	});
  62  | 	await expect(cells(page)).toHaveCount(count);
  63  | 	await page.evaluate(() => new Promise(requestAnimationFrame));
  64  | }
  65  | 
  66  | async function point(cell: Locator, fraction = 0.3) {
  67  | 	const rect = await cell.boundingBox();
  68  | 	if (!rect) throw new Error('Cell is not visible');
  69  | 	return { x: rect.x + rect.width * fraction, y: rect.y + Math.min(rect.height / 2, 10) };
  70  | }
  71  | 
  72  | async function drag(page: Page, from: Locator, to: Locator) {
  73  | 	const start = await point(from);
  74  | 	const end = await point(to);
  75  | 	await page.mouse.move(start.x, start.y);
  76  | 	await page.mouse.down();
  77  | 	await page.mouse.move(end.x, end.y, { steps: 16 });
  78  | 	await page.mouse.up();
  79  | }
  80  | 
  81  | test('drag selects a cell range in either direction, persists after release and creates a group', async ({
  82  | 	page
  83  | }) => {
  84  | 	await setup(page);
  85  | 	await drag(page, cells(page).nth(0), cells(page).nth(2));
  86  | 	await expect(selected(page)).toHaveCount(3);
  87  | 	const fourth = await point(cells(page).nth(3));
  88  | 	await page.mouse.move(fourth.x, fourth.y);
  89  | 	await expect(selected(page)).toHaveCount(3);
  90  | 	await cells(page).nth(0).click();
  91  | 	await expect(selected(page)).toHaveCount(0);
  92  | 	await drag(page, cells(page).nth(2), cells(page).nth(0));
  93  | 	await expect(selected(page)).toHaveCount(3);
  94  | 	await page.keyboard.press('Shift+Enter');
  95  | 	await expect(cells(page)).toHaveCount(5);
  96  | 	await expect(page.locator('.groupReplies path')).toHaveCount(1);
  97  | 	await expect(selected(page)).toHaveCount(0);
  98  | });
  99  | 
  100 | test('cell selection can start in the padding and keeps keyboard actions available', async ({
  101 | 	page
  102 | }) => {
  103 | 	await setup(page);
  104 | 	const first = cells(page).nth(0);
  105 | 	const start = await first.evaluate((element) => {
  106 | 		const rect = element.closest('[data-box-id]')!.getBoundingClientRect();
  107 | 		return { x: rect.left + 1, y: rect.top + rect.height / 2 };
  108 | 	});
  109 | 	const end = await point(cells(page).nth(2));
  110 | 	await page.mouse.move(start.x, start.y);
  111 | 	await page.mouse.down();
  112 | 	await page.mouse.move(end.x, end.y, { steps: 16 });
  113 | 	await page.mouse.up();
  114 | 	await expect(selected(page)).toHaveCount(3);
> 115 | 	await expect(first).toBeFocused();
      |                      ^ Error: expect(locator).toBeFocused() failed
  116 | 	await page.keyboard.press('Shift+Enter');
  117 | 	await expect(page.locator('.groupReplies path')).toHaveCount(1);
  118 | });
  119 | 
  120 | test('dragged cells copy and cut through the existing selection actions', async ({ page }) => {
  121 | 	await setup(page);
  122 | 	await drag(page, cells(page).nth(0), cells(page).nth(2));
  123 | 	await expect(selected(page)).toHaveCount(3);
  124 | 	await page.keyboard.press('Control+c');
  125 | 	const copy = await page.evaluate(() => window.selectionCopy ?? '');
  126 | 	const payload = JSON.parse(copy);
  127 | 	expect(payload.tag).toBe('flew-notes-boxes');
  128 | 	expect(payload.boxes.map((box: { value: { content: string } }) => box.value.content)).toEqual([
  129 | 		'Card 1 alpha beta gamma',
  130 | 		'Card 2 alpha beta gamma',
  131 | 		'Card 3 alpha beta gamma'
  132 | 	]);
  133 | 	await page.keyboard.press('Control+x');
  134 | 	await expect(cells(page)).toHaveCount(1);
  135 | 	await expect(cells(page)).toHaveValue('Card 4 alpha beta gamma');
  136 | 	await page.keyboard.press('Control+z');
  137 | 	await expect(cells(page)).toHaveCount(4);
  138 | });
  139 | 
  140 | test('dragging within one cell still selects text and single clicks still place the caret', async ({
  141 | 	page
  142 | }) => {
  143 | 	await setup(page);
  144 | 	const first = cells(page).nth(0);
  145 | 	const start = await point(first, 0.1);
  146 | 	const end = await point(first, 0.65);
  147 | 	await page.mouse.move(start.x, start.y);
  148 | 	await page.mouse.down();
  149 | 	await page.mouse.move(end.x, end.y, { steps: 12 });
  150 | 	await page.mouse.up();
  151 | 	await expect(selected(page)).toHaveCount(0);
  152 | 	expect(
  153 | 		await first.evaluate(
  154 | 			(element) =>
  155 | 				(element as HTMLTextAreaElement).selectionEnd -
  156 | 				(element as HTMLTextAreaElement).selectionStart
  157 | 		)
  158 | 	).toBeGreaterThan(0);
  159 | 	await first.click();
  160 | 	expect(
  161 | 		await first.evaluate(
  162 | 			(element) =>
  163 | 				(element as HTMLTextAreaElement).selectionEnd -
  164 | 				(element as HTMLTextAreaElement).selectionStart
  165 | 		)
  166 | 	).toBe(0);
  167 | 	await expect(selected(page)).toHaveCount(0);
  168 | });
  169 | 
  170 | test('drag selection spans speech columns without changing cell text', async ({ page }) => {
  171 | 	await setup(page);
  172 | 	await cells(page).nth(0).press('Shift+Enter');
  173 | 	await page.keyboard.type('Response in the next speech');
  174 | 
  175 | 	await drag(page, cells(page).nth(0), cells(page).nth(1));
  176 | 	await expect(selected(page)).toHaveCount(2);
  177 | 	await expect(cells(page).nth(0)).toHaveValue('Card 1 alpha beta gamma');
  178 | 	await expect(cells(page).nth(1)).toHaveValue('Response in the next speech');
  179 | });
  180 | 
  181 | test('drag selection scrolls at the edge and ends when released outside the flow', async ({
  182 | 	page
  183 | }) => {
  184 | 	await page.setViewportSize({ width: 900, height: 500 });
  185 | 	await setup(page, 30);
  186 | 	const start = await point(cells(page).nth(0));
  187 | 	const second = await point(cells(page).nth(1));
  188 | 	await page.mouse.move(start.x, start.y);
  189 | 	await page.mouse.down();
  190 | 	await page.mouse.move(second.x, second.y, { steps: 8 });
  191 | 	await expect(selected(page)).toHaveCount(2);
  192 | 	const scroll = page.locator('.flow .viewer > .content');
  193 | 	const bounds = await scroll.boundingBox();
  194 | 	if (!bounds) throw new Error('Flow is not visible');
  195 | 	await page.mouse.move(second.x, bounds.y + bounds.height - 4, { steps: 8 });
  196 | 	await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);
  197 | 	await expect.poll(() => selected(page).count()).toBeGreaterThan(3);
  198 | 	await page.mouse.move(second.x, bounds.y - 10);
  199 | 	await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0);
  200 | 	await expect(selected(page)).toHaveCount(1);
  201 | 	await page.mouse.move(10, 10);
  202 | 	await page.mouse.up();
  203 | 	const stopped = await scroll.evaluate((element) => element.scrollTop);
  204 | 	await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 150)));
  205 | 	expect(await scroll.evaluate((element) => element.scrollTop)).toBe(stopped);
  206 | });
  207 | 
  208 | test('Escape cancels a cell drag and touch gestures keep their native behavior', async ({
  209 | 	page
  210 | }) => {
  211 | 	await setup(page);
  212 | 	const start = await point(cells(page).nth(0));
  213 | 	const end = await point(cells(page).nth(2));
  214 | 	await page.mouse.move(start.x, start.y);
  215 | 	await page.mouse.down();
```