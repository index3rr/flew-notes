# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: selection.spec.ts >> drag selects a cell range in either direction, persists after release and creates a group
- Location: tests/selection.spec.ts:81:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.flow .box.selected')
Expected: 3
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" locator('.flow .box.selected') with timeout 5000ms
  - waiting for locator('.flow .box.selected')
    14 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e10]:
          - tooltip [ref=e11]:
            - button "Help" [ref=e12]
          - tooltip [ref=e18]:
            - button [ref=e19]
          - tooltip [ref=e23]:
            - button "Save flow" [ref=e24]
          - tooltip [ref=e28]:
            - button [ref=e29]
        - generic [ref=e35]:
          - textbox "Flow document title" [ref=e37]:
            - /placeholder: new flow
            - text: Selection
          - tooltip [ref=e38]:
            - button "Close flow" [ref=e39]
      - generic [ref=e43]:
        - region "Flow pages" [ref=e46]:
          - generic [ref=e47]:
            - tooltip [ref=e48]:
              - heading "Tabs" [level=2] [ref=e49]
            - tooltip [ref=e51]:
              - button "Tabs menu" [ref=e52]
          - generic [ref=e57]:
            - list [ref=e58]:
              - listitem [ref=e59]:
                - button "aff" [ref=e61]
            - generic [ref=e63]:
              - tooltip [ref=e64]:
                - button "aff" [ref=e65]
              - tooltip [ref=e67]:
                - button "neg" [ref=e68]
        - tooltip [ref=e71]:
          - button "Timers" [ref=e72]
    - generic [ref=e79]:
      - textbox "type name here" [ref=e81]: aff
      - tooltip [ref=e83]:
        - button [ref=e84]
    - generic [ref=e92]:
      - tooltip [ref=e93]:
        - button [disabled] [ref=e94]
      - tooltip [ref=e98]:
        - button [disabled] [ref=e99]
      - tooltip [ref=e103]:
        - button [ref=e104]
      - tooltip [ref=e107]:
        - button [ref=e108]
      - tooltip [ref=e111]:
        - button [ref=e112]
      - tooltip [ref=e115]:
        - button "Delete selected cell" [ref=e116]
      - tooltip [ref=e120]:
        - button [ref=e121]
      - tooltip [ref=e125]:
        - button "Toggle starred argument" [ref=e126]
      - tooltip [ref=e129]:
        - button "Toggle crossed out" [ref=e130]
      - tooltip [ref=e134]:
        - button [ref=e135]
      - tooltip [ref=e139]:
        - button [disabled] [ref=e140]
    - generic [ref=e146]:
      - list [ref=e150]:
        - generic [ref=e151]:
          - generic [ref=e152]:
            - separator [ref=e153]
            - textbox "type here" [active] [ref=e155]: Card 1 alpha beta gamma
            - separator [ref=e156]
          - button [ref=e157]
          - list
        - generic [ref=e159]:
          - generic [ref=e160]:
            - separator [ref=e161]
            - textbox [ref=e163]: Card 2 alpha beta gamma
            - separator [ref=e164]
          - button [ref=e165]
          - list
        - generic [ref=e167]:
          - generic [ref=e168]:
            - separator [ref=e169]
            - textbox [ref=e171]: Card 3 alpha beta gamma
            - separator [ref=e172]
          - button [ref=e173]
          - list
        - generic [ref=e175]:
          - generic [ref=e176]:
            - separator [ref=e177]
            - textbox [ref=e179]: Card 4 alpha beta gamma
            - separator [ref=e180]
          - button [ref=e181]
          - list
      - generic [ref=e183]:
        - generic [ref=e185]:
          - generic [ref=e186]: AC
          - button [ref=e188]
        - generic [ref=e191]:
          - generic [ref=e192]: NC
          - button [ref=e194]
        - generic [ref=e197]:
          - generic [ref=e198]: AR
          - button [ref=e200]
```

# Test source

```ts
  1   | import { test, expect, type Page, type Locator } from '@playwright/test';
  2   | 
  3   | declare global {
  4   | 	interface Window {
  5   | 		selectionCopy?: string;
  6   | 	}
  7   | }
  8   | 
  9   | const cells = (page: Page) => page.locator('.flow .box textarea');
  10  | const selected = (page: Page) => page.locator('.flow .box.selected');
  11  | 
  12  | async function setup(page: Page, count = 4) {
  13  | 	await page.addInitScript(() => {
  14  | 		localStorage.setItem(
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
> 86  | 	await expect(selected(page)).toHaveCount(3);
      |                               ^ Error: expect(locator).toHaveCount(expected) failed
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
  115 | 	await expect(first).toBeFocused();
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
```