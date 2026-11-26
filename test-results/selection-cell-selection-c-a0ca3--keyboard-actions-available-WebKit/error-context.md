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
  72  | 
  73  | async function paddingPoint(cell: Locator) {
  74  |  return cell.evaluate(element=>{const rect=element.closest('[data-box-id]')!.getBoundingClientRect();return {x:rect.left+1,y:rect.top+rect.height/2};});
  75  | }
  76  | 
  77  | async function drag(page: Page, from: Locator, to: Locator) {
  78  | 	const start = await paddingPoint(from);
  79  | 	const end = await point(to);
  80  | 	await page.mouse.move(start.x, start.y);
  81  | 	await page.mouse.down();
  82  | 	await page.mouse.move(end.x, end.y, { steps: 16 });
  83  | 	await page.mouse.up();
  84  | }
  85  | 
  86  | test('drag selects a cell range in either direction, persists after release and creates a group', async ({
  87  | 	page
  88  | }) => {
  89  | 	await setup(page);
  90  | 	await drag(page, cells(page).nth(0), cells(page).nth(2));
  91  | 	await expect(selected(page)).toHaveCount(3);
  92  | 	const fourth = await point(cells(page).nth(3));
  93  | 	await page.mouse.move(fourth.x, fourth.y);
  94  | 	await expect(selected(page)).toHaveCount(3);
  95  | 	await cells(page).nth(0).click();
  96  | 	await expect(selected(page)).toHaveCount(0);
  97  | 	await drag(page, cells(page).nth(2), cells(page).nth(0));
  98  | 	await expect(selected(page)).toHaveCount(3);
  99  | 	await page.keyboard.press('Shift+Enter');
  100 | 	await expect(cells(page)).toHaveCount(5);
  101 | 	await expect(page.locator('.groupReplies path')).toHaveCount(1);
  102 | 	await expect(selected(page)).toHaveCount(0);
  103 | });
  104 | 
  105 | test('cell selection can start in the padding and keeps keyboard actions available', async ({
  106 | 	page
  107 | }) => {
  108 | 	await setup(page);
  109 | 	const first = cells(page).nth(0);
  110 | 	const start = await first.evaluate((element) => {
  111 | 		const rect = element.closest('[data-box-id]')!.getBoundingClientRect();
  112 | 		return { x: rect.left + 1, y: rect.top + rect.height / 2 };
  113 | 	});
  114 | 	const end = await point(cells(page).nth(2));
> 115 | 	await page.mouse.move(start.x, start.y);
      |                      ^ Error: expect(locator).toBeFocused() failed
  116 | 	await page.mouse.down();
  117 | 	await page.mouse.move(end.x, end.y, { steps: 16 });
  118 | 	await page.mouse.up();
  119 | 	await expect(selected(page)).toHaveCount(3);
  120 | 	await expect(first).toBeFocused();
  121 | 	await page.keyboard.press('Shift+Enter');
  122 | 	await expect(page.locator('.groupReplies path')).toHaveCount(1);
  123 | });
  124 | 
  125 | test('dragged cells copy and cut through the existing selection actions', async ({ page }) => {
  126 | 	await setup(page);
  127 | 	await drag(page, cells(page).nth(0), cells(page).nth(2));
  128 | 	await expect(selected(page)).toHaveCount(3);
  129 | 	await page.keyboard.press('Control+c');
  130 | 	const copy = await page.evaluate(() => window.selectionCopy ?? '');
  131 | 	const payload = JSON.parse(copy);
  132 | 	expect(payload.tag).toBe('flew-notes-boxes');
  133 | 	expect(payload.boxes.map((box: { value: { content: string } }) => box.value.content)).toEqual([
  134 | 		'Card 1 alpha beta gamma',
  135 | 		'Card 2 alpha beta gamma',
  136 | 		'Card 3 alpha beta gamma'
  137 | 	]);
  138 | 	await page.keyboard.press('Control+x');
  139 | 	await expect(cells(page)).toHaveCount(1);
  140 | 	await expect(cells(page)).toHaveValue('Card 4 alpha beta gamma');
  141 | 	await page.keyboard.press('Control+z');
  142 | 	await expect(cells(page)).toHaveCount(4);
  143 | });
  144 | 
  145 | test('dragging within one cell still selects text and single clicks still place the caret', async ({
  146 | 	page
  147 | }) => {
  148 | 	await setup(page);
  149 | 	const first = cells(page).nth(0);
  150 | 	const start = await point(first, 0.1);
  151 | 	const end = await point(first, 0.65);
  152 | 	await page.mouse.move(start.x, start.y);
  153 | 	await page.mouse.down();
  154 | 	await page.mouse.move(end.x, end.y, { steps: 12 });
  155 | 	await page.mouse.up();
  156 | 	await expect(selected(page)).toHaveCount(0);
  157 | 	expect(
  158 | 		await first.evaluate(
  159 | 			(element) =>
  160 | 				(element as HTMLTextAreaElement).selectionEnd -
  161 | 				(element as HTMLTextAreaElement).selectionStart
  162 | 		)
  163 | 	).toBeGreaterThan(0);
  164 | 	await first.click();
  165 | 	expect(
  166 | 		await first.evaluate(
  167 | 			(element) =>
  168 | 				(element as HTMLTextAreaElement).selectionEnd -
  169 | 				(element as HTMLTextAreaElement).selectionStart
  170 | 		)
  171 | 	).toBe(0);
  172 | 	await expect(selected(page)).toHaveCount(0);
  173 | });
  174 | 
  175 | test('drag selection spans speech columns without changing cell text', async ({ page }) => {
  176 | 	await setup(page);
  177 | 	await cells(page).nth(0).press('Shift+Enter');
  178 | 	await page.keyboard.type('Response in the next speech');
  179 | 
  180 | 	await drag(page, cells(page).nth(0), cells(page).nth(1));
  181 | 	await expect(selected(page)).toHaveCount(2);
  182 | 	await expect(cells(page).nth(0)).toHaveValue('Card 1 alpha beta gamma');
  183 | 	await expect(cells(page).nth(1)).toHaveValue('Response in the next speech');
  184 | });
  185 | 
  186 | test('drag selection scrolls at the edge and ends when released outside the flow', async ({
  187 | 	page
  188 | }) => {
  189 | 	await page.setViewportSize({ width: 900, height: 500 });
  190 | 	await setup(page, 30);
  191 | 	const start = await paddingPoint(cells(page).nth(0));
  192 | 	const second = await point(cells(page).nth(1));
  193 | 	await page.mouse.move(start.x, start.y);
  194 | 	await page.mouse.down();
  195 | 	await page.mouse.move(second.x, second.y, { steps: 8 });
  196 | 	await expect(selected(page)).toHaveCount(2);
  197 | 	const scroll = page.locator('.flow .viewer > .content');
  198 | 	const bounds = await scroll.boundingBox();
  199 | 	if (!bounds) throw new Error('Flow is not visible');
  200 | 	await page.mouse.move(second.x, bounds.y + bounds.height - 4, { steps: 8 });
  201 | 	await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);
  202 | 	await expect.poll(() => selected(page).count()).toBeGreaterThan(3);
  203 | 	await page.mouse.move(second.x, bounds.y - 10);
  204 | 	await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0);
  205 | 	await expect(selected(page)).toHaveCount(1);
  206 | 	await page.mouse.move(10, 10);
  207 | 	await page.mouse.up();
  208 | 	const stopped = await scroll.evaluate((element) => element.scrollTop);
  209 | 	await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 150)));
  210 | 	expect(await scroll.evaluate((element) => element.scrollTop)).toBe(stopped);
  211 | });
  212 | 
  213 | test('Escape cancels a cell drag and touch gestures keep their native behavior', async ({
  214 | 	page
  215 | }) => {
```