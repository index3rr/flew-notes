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
> 86  | test('drag selects a cell range in either direction, persists after release and creates a group', async ({
      |                               ^ Error: expect(locator).toHaveCount(expected) failed
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
  115 | 	await page.mouse.move(start.x, start.y);
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
```