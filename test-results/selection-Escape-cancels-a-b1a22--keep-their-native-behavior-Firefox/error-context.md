# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: selection.spec.ts >> Escape cancels a cell drag and touch gestures keep their native behavior
- Location: tests/selection.spec.ts:208:1

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
              - tooltip [ref=e69]:
                - button "neg" [ref=e70]
        - tooltip [ref=e75]:
          - button "Timers" [ref=e76]
    - generic [ref=e87]:
      - textbox "type name here" [ref=e89]: aff
      - tooltip [ref=e91]:
        - button [ref=e92]
    - generic [ref=e101]:
      - tooltip [ref=e102]:
        - button [disabled] [ref=e103]
      - tooltip [ref=e107]:
        - button [disabled] [ref=e108]
      - tooltip [ref=e112]:
        - button [ref=e113]
      - tooltip [ref=e118]:
        - button [ref=e119]
      - tooltip [ref=e124]:
        - button [ref=e125]
      - tooltip [ref=e130]:
        - button "Delete selected cell" [ref=e131]
      - tooltip [ref=e136]:
        - button [ref=e137]
      - tooltip [ref=e143]:
        - button "Toggle starred argument" [ref=e144]
      - tooltip [ref=e147]:
        - button "Toggle crossed out" [ref=e148]
      - tooltip [ref=e153]:
        - button [ref=e154]
      - tooltip [ref=e158]:
        - button [disabled] [ref=e159]
    - generic [ref=e165]:
      - list [ref=e169]:
        - generic [ref=e170]:
          - generic [ref=e171]:
            - separator [ref=e172]
            - textbox "type here" [active] [ref=e174]: Card 1 alpha beta gamma
            - separator [ref=e175]
          - button [ref=e176]
          - list
        - generic [ref=e180]:
          - generic [ref=e181]:
            - separator [ref=e182]
            - textbox [ref=e184]: Card 2 alpha beta gamma
            - separator [ref=e185]
          - button [ref=e186]
          - list
        - generic [ref=e190]:
          - generic [ref=e191]:
            - separator [ref=e192]
            - textbox [ref=e194]: Card 3 alpha beta gamma
            - separator [ref=e195]
          - button [ref=e196]
          - list
        - generic [ref=e200]:
          - generic [ref=e201]:
            - separator [ref=e202]
            - textbox [ref=e204]: Card 4 alpha beta gamma
            - separator [ref=e205]
          - button [ref=e206]
          - list
      - generic [ref=e210]:
        - generic [ref=e212]:
          - generic [ref=e213]: AC
          - button [ref=e215]
        - generic [ref=e220]:
          - generic [ref=e221]: NC
          - button [ref=e223]
        - generic [ref=e228]:
          - generic [ref=e229]: AR
          - button [ref=e231]
```

# Test source

```ts
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
  216 | 	await setup(page);
> 217 | 	const start = await paddingPoint(cells(page).nth(0));
      |                               ^ Error: expect(locator).toHaveCount(expected) failed
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
  292 | 	await expect(
  293 | 		page.locator('.box:has(> [data-box-id="box-3"]) > .children [data-box-id]')
  294 | 	).toHaveCount(0);
  295 | });
  296 | 
  297 | test('formatting a range skips extension spacers', async ({ page }) => {
  298 | 	await setup(page);
  299 | 	await cells(page).first().click();
  300 | 	await page.keyboard.press('Control+e');
  301 | 	await page.keyboard.type('Extended response');
  302 | 	await cells(page).first().click();
  303 | 	await cells(page)
  304 | 		.nth(2)
  305 | 		.click({ modifiers: ['Shift'] });
  306 | 	await page.keyboard.press('Control+b');
  307 | 	await expect(page.locator('.flow .text.bold')).toHaveCount(2);
  308 | 	await page.keyboard.press('Control+c');
  309 | 	const copied = JSON.parse(await page.evaluate(() => window.selectionCopy ?? ''));
  310 | 	expect(copied.boxes[0].value.bold).toBe(true);
  311 | 	expect(copied.boxes[0].children[0].value.isExtension).toBe(true);
  312 | 	expect(copied.boxes[0].children[0].value.bold).toBeUndefined();
  313 | });
  314 | 
  315 | test('children across different parents form a column rectangle without selecting their parents', async ({
  316 | 	page
  317 | }) => {
```