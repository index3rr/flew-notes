# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: selection.spec.ts >> drag selection scrolls at the edge and ends when released outside the flow
- Location: tests/selection.spec.ts:181:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.flow .box.selected')
Expected: 2
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
          - generic [ref=e184]:
            - separator [ref=e185]
            - textbox [ref=e187]: Card 5 alpha beta gamma
            - separator [ref=e188]
          - button [ref=e189]
          - list
        - generic [ref=e191]:
          - generic [ref=e192]:
            - separator [ref=e193]
            - textbox [ref=e195]: Card 6 alpha beta gamma
            - separator [ref=e196]
          - button [ref=e197]
          - list
        - generic [ref=e199]:
          - generic [ref=e200]:
            - separator [ref=e201]
            - textbox [ref=e203]: Card 7 alpha beta gamma
            - separator [ref=e204]
          - button [ref=e205]
          - list
        - generic [ref=e207]:
          - generic [ref=e208]:
            - separator [ref=e209]
            - textbox [ref=e211]: Card 8 alpha beta gamma
            - separator [ref=e212]
          - button [ref=e213]
          - list
        - generic [ref=e215]:
          - generic [ref=e216]:
            - separator [ref=e217]
            - textbox [ref=e219]: Card 9 alpha beta gamma
            - separator [ref=e220]
          - button [ref=e221]
          - list
        - generic [ref=e223]:
          - generic [ref=e224]:
            - separator [ref=e225]
            - textbox [ref=e227]: Card 10 alpha beta gamma
            - separator [ref=e228]
          - button [ref=e229]
          - list
        - generic [ref=e231]:
          - generic [ref=e232]:
            - separator [ref=e233]
            - textbox [ref=e235]: Card 11 alpha beta gamma
            - separator [ref=e236]
          - button [ref=e237]
          - list
        - generic [ref=e239]:
          - generic [ref=e240]:
            - separator [ref=e241]
            - textbox [ref=e243]: Card 12 alpha beta gamma
            - separator [ref=e244]
          - button [ref=e245]
          - list
        - generic [ref=e247]:
          - generic [ref=e248]:
            - separator [ref=e249]
            - textbox [ref=e251]: Card 13 alpha beta gamma
            - separator [ref=e252]
          - button [ref=e253]
          - list
        - generic [ref=e255]:
          - generic [ref=e256]:
            - separator [ref=e257]
            - textbox [ref=e259]: Card 14 alpha beta gamma
            - separator [ref=e260]
          - button [ref=e261]
          - list
        - generic [ref=e263]:
          - generic [ref=e264]:
            - separator [ref=e265]
            - textbox [ref=e267]: Card 15 alpha beta gamma
            - separator [ref=e268]
          - button [ref=e269]
          - list
        - generic [ref=e271]:
          - generic [ref=e272]:
            - separator [ref=e273]
            - textbox [ref=e275]: Card 16 alpha beta gamma
            - separator [ref=e276]
          - button [ref=e277]
          - list
        - generic [ref=e279]:
          - generic [ref=e280]:
            - separator [ref=e281]
            - textbox [ref=e283]: Card 17 alpha beta gamma
            - separator [ref=e284]
          - button [ref=e285]
          - list
        - generic [ref=e287]:
          - generic [ref=e288]:
            - separator [ref=e289]
            - textbox [ref=e291]: Card 18 alpha beta gamma
            - separator [ref=e292]
          - button [ref=e293]
          - list
        - generic [ref=e295]:
          - generic [ref=e296]:
            - separator [ref=e297]
            - textbox [ref=e299]: Card 19 alpha beta gamma
            - separator [ref=e300]
          - button [ref=e301]
          - list
        - generic [ref=e303]:
          - generic [ref=e304]:
            - separator [ref=e305]
            - textbox [ref=e307]: Card 20 alpha beta gamma
            - separator [ref=e308]
          - button [ref=e309]
          - list
        - generic [ref=e311]:
          - generic [ref=e312]:
            - separator [ref=e313]
            - textbox [ref=e315]: Card 21 alpha beta gamma
            - separator [ref=e316]
          - button [ref=e317]
          - list
        - generic [ref=e319]:
          - generic [ref=e320]:
            - separator [ref=e321]
            - textbox [ref=e323]: Card 22 alpha beta gamma
            - separator [ref=e324]
          - button [ref=e325]
          - list
        - generic [ref=e327]:
          - generic [ref=e328]:
            - separator [ref=e329]
            - textbox [ref=e331]: Card 23 alpha beta gamma
            - separator [ref=e332]
          - button [ref=e333]
          - list
        - generic [ref=e335]:
          - generic [ref=e336]:
            - separator [ref=e337]
            - textbox [ref=e339]: Card 24 alpha beta gamma
            - separator [ref=e340]
          - button [ref=e341]
          - list
        - generic [ref=e343]:
          - generic [ref=e344]:
            - separator [ref=e345]
            - textbox [ref=e347]: Card 25 alpha beta gamma
            - separator [ref=e348]
          - button [ref=e349]
          - list
        - generic [ref=e351]:
          - generic [ref=e352]:
            - separator [ref=e353]
            - textbox [ref=e355]: Card 26 alpha beta gamma
            - separator [ref=e356]
          - button [ref=e357]
          - list
        - generic [ref=e359]:
          - generic [ref=e360]:
            - separator [ref=e361]
            - textbox [ref=e363]: Card 27 alpha beta gamma
            - separator [ref=e364]
          - button [ref=e365]
          - list
        - generic [ref=e367]:
          - generic [ref=e368]:
            - separator [ref=e369]
            - textbox [ref=e371]: Card 28 alpha beta gamma
            - separator [ref=e372]
          - button [ref=e373]
          - list
        - generic [ref=e375]:
          - generic [ref=e376]:
            - separator [ref=e377]
            - textbox [ref=e379]: Card 29 alpha beta gamma
            - separator [ref=e380]
          - button [ref=e381]
          - list
        - generic [ref=e383]:
          - generic [ref=e384]:
            - separator [ref=e385]
            - textbox [ref=e387]: Card 30 alpha beta gamma
            - separator [ref=e388]
          - button [ref=e389]
          - list
      - generic [ref=e391]:
        - generic [ref=e393]:
          - generic [ref=e394]: AC
          - button [ref=e396]
        - generic [ref=e399]:
          - generic [ref=e400]: NC
          - button [ref=e402]
        - generic [ref=e405]:
          - generic [ref=e406]: AR
          - button [ref=e408]
```

# Test source

```ts
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
  187 | 	page
  188 | }) => {
  189 | 	await page.setViewportSize({ width: 900, height: 500 });
  190 | 	await setup(page, 30);
> 191 | 	const start = await paddingPoint(cells(page).nth(0));
      |                               ^ Error: expect(locator).toHaveCount(expected) failed
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
  216 | 	await setup(page);
  217 | 	const start = await paddingPoint(cells(page).nth(0));
  218 | 	const end = await point(cells(page).nth(2));
  219 | 	await page.mouse.move(start.x, start.y);
  220 | 	await page.mouse.down();
  221 | 	await page.mouse.move(end.x, end.y, { steps: 12 });
  222 | 	await expect(selected(page)).toHaveCount(3);
  223 | 	await page.keyboard.press('Escape');
  224 | 	await page.mouse.up();
  225 | 	await expect(selected(page)).toHaveCount(0);
  226 | 	await cells(page)
  227 | 		.nth(0)
  228 | 		.dispatchEvent('pointerdown', { pointerId: 100, pointerType: 'touch', button: 0, buttons: 1 });
  229 | 	await cells(page)
  230 | 		.nth(2)
  231 | 		.dispatchEvent('pointermove', { pointerId: 100, pointerType: 'touch', buttons: 1 });
  232 | 	await cells(page)
  233 | 		.nth(2)
  234 | 		.dispatchEvent('pointerup', { pointerId: 100, pointerType: 'touch', button: 0 });
  235 | 	await expect(selected(page)).toHaveCount(0);
  236 | 	await drag(page, cells(page).nth(0), cells(page).nth(2));
  237 | 	await expect(selected(page)).toHaveCount(3);
  238 | });
  239 | 
  240 | test('shift-click formats every selected cell in one undo step', async ({ page }) => {
  241 | 	await setup(page);
  242 | 	await cells(page).nth(0).click();
  243 | 	await cells(page)
  244 | 		.nth(2)
  245 | 		.click({ modifiers: ['Shift'] });
  246 | 	await expect(selected(page)).toHaveCount(3);
  247 | 	await page.keyboard.press('Control+b');
  248 | 	await expect(page.locator('.flow .text.bold')).toHaveCount(3);
  249 | 	await page.keyboard.press('Control+z');
  250 | 	await expect(page.locator('.flow .text.bold')).toHaveCount(0);
  251 | });
  252 | 
  253 | test('a selection can be moved onto another argument and undone without changing its IDs', async ({
  254 | 	page
  255 | }) => {
  256 | 	await setup(page);
  257 | 	await cells(page).nth(0).click();
  258 | 	await cells(page)
  259 | 		.nth(1)
  260 | 		.click({ modifiers: ['Shift'] });
  261 | 	await expect(selected(page)).toHaveCount(2);
  262 | 	await page.evaluate(() => {
  263 | 		const original = DataTransfer.prototype.setDragImage;
  264 | 		DataTransfer.prototype.setDragImage = function (element, x, y) {
  265 | 			Object.assign(window, {
  266 | 				dragPreview: [...element.children].map((child) => ({
  267 | 					id: (child as HTMLElement).dataset.dragBoxId,
  268 | 					x: parseFloat((child as HTMLElement).style.left),
  269 | 					y: parseFloat((child as HTMLElement).style.top)
  270 | 				}))
  271 | 			});
  272 | 			original.call(this, element, x, y);
  273 | 		};
  274 | 	});
  275 | 	const source = page.locator('[data-box-id="box-0"]');
  276 | 	await source.dragTo(page.locator('[data-box-id="box-3"]'));
  277 | 	await expect(
  278 | 		page.locator('.box').filter({ has: page.locator('[data-box-id="box-3"]') })
  279 | 	).not.toHaveCount(0);
  280 | 	const preview = await page.evaluate(
  281 | 		() => (window as unknown as { dragPreview: { id: string; x: number; y: number }[] }).dragPreview
  282 | 	);
  283 | 	expect(preview.map((cell) => cell.id)).toEqual(['box-0', 'box-1']);
  284 | 	expect(preview[0].x).toBe(preview[1].x);
  285 | 	expect(preview[1].y).toBeGreaterThan(preview[0].y);
  286 | 	await expect(
  287 | 		page.locator('.box:has(> [data-box-id="box-3"]) > .children [data-box-id]')
  288 | 	).toHaveCount(2);
  289 | 	await page.keyboard.press('Control+z');
  290 | 	await expect(page.locator('.flow [data-box-id="box-0"]')).toHaveCount(1);
  291 | 	await expect(page.locator('.flow [data-box-id="box-0"]')).toBeVisible();
```