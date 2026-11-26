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
  187 | 	const second = await point(cells(page).nth(1));
  188 | 	await page.mouse.move(start.x, start.y);
  189 | 	await page.mouse.down();
  190 | 	await page.mouse.move(second.x, second.y, { steps: 8 });
> 191 | 	await expect(selected(page)).toHaveCount(2);
      |                               ^ Error: expect(locator).toHaveCount(expected) failed
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
  216 | 	await page.mouse.move(end.x, end.y, { steps: 12 });
  217 | 	await expect(selected(page)).toHaveCount(3);
  218 | 	await page.keyboard.press('Escape');
  219 | 	await page.mouse.up();
  220 | 	await expect(selected(page)).toHaveCount(0);
  221 | 	await cells(page)
  222 | 		.nth(0)
  223 | 		.dispatchEvent('pointerdown', { pointerId: 100, pointerType: 'touch', button: 0, buttons: 1 });
  224 | 	await cells(page)
  225 | 		.nth(2)
  226 | 		.dispatchEvent('pointermove', { pointerId: 100, pointerType: 'touch', buttons: 1 });
  227 | 	await cells(page)
  228 | 		.nth(2)
  229 | 		.dispatchEvent('pointerup', { pointerId: 100, pointerType: 'touch', button: 0 });
  230 | 	await expect(selected(page)).toHaveCount(0);
  231 | 	await drag(page, cells(page).nth(0), cells(page).nth(2));
  232 | 	await expect(selected(page)).toHaveCount(3);
  233 | });
  234 | 
  235 | test('shift-click formats every selected cell in one undo step', async ({ page }) => {
  236 | 	await setup(page);
  237 | 	await cells(page).nth(0).click();
  238 | 	await cells(page)
  239 | 		.nth(2)
  240 | 		.click({ modifiers: ['Shift'] });
  241 | 	await expect(selected(page)).toHaveCount(3);
  242 | 	await page.keyboard.press('Control+b');
  243 | 	await expect(page.locator('.flow .text.bold')).toHaveCount(3);
  244 | 	await page.keyboard.press('Control+z');
  245 | 	await expect(page.locator('.flow .text.bold')).toHaveCount(0);
  246 | });
  247 | 
  248 | test('a selection can be moved onto another argument and undone without changing its IDs', async ({
  249 | 	page
  250 | }) => {
  251 | 	await setup(page);
  252 | 	await cells(page).nth(0).click();
  253 | 	await cells(page)
  254 | 		.nth(1)
  255 | 		.click({ modifiers: ['Shift'] });
  256 | 	await expect(selected(page)).toHaveCount(2);
  257 | 	await page.evaluate(() => {
  258 | 		const original = DataTransfer.prototype.setDragImage;
  259 | 		DataTransfer.prototype.setDragImage = function (element, x, y) {
  260 | 			Object.assign(window, {
  261 | 				dragPreview: [...element.children].map((child) => ({
  262 | 					id: (child as HTMLElement).dataset.dragBoxId,
  263 | 					x: parseFloat((child as HTMLElement).style.left),
  264 | 					y: parseFloat((child as HTMLElement).style.top)
  265 | 				}))
  266 | 			});
  267 | 			original.call(this, element, x, y);
  268 | 		};
  269 | 	});
  270 | 	const source = page.locator('[data-box-id="box-0"]');
  271 | 	await source.dragTo(page.locator('[data-box-id="box-3"]'));
  272 | 	await expect(
  273 | 		page.locator('.box').filter({ has: page.locator('[data-box-id="box-3"]') })
  274 | 	).not.toHaveCount(0);
  275 | 	const preview = await page.evaluate(
  276 | 		() => (window as unknown as { dragPreview: { id: string; x: number; y: number }[] }).dragPreview
  277 | 	);
  278 | 	expect(preview.map((cell) => cell.id)).toEqual(['box-0', 'box-1']);
  279 | 	expect(preview[0].x).toBe(preview[1].x);
  280 | 	expect(preview[1].y).toBeGreaterThan(preview[0].y);
  281 | 	await expect(
  282 | 		page.locator('.box:has(> [data-box-id="box-3"]) > .children [data-box-id]')
  283 | 	).toHaveCount(2);
  284 | 	await page.keyboard.press('Control+z');
  285 | 	await expect(page.locator('.flow [data-box-id="box-0"]')).toHaveCount(1);
  286 | 	await expect(page.locator('.flow [data-box-id="box-0"]')).toBeVisible();
  287 | 	await expect(
  288 | 		page.locator('.box:has(> [data-box-id="box-3"]) > .children [data-box-id]')
  289 | 	).toHaveCount(0);
  290 | });
  291 | 
```