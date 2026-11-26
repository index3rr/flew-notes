# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: selection.spec.ts >> children across different parents form a column rectangle without selecting their parents
- Location: tests/selection.spec.ts:310:1

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
        - button [ref=e94]
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
            - textbox "type here" [ref=e155]: Card 1 alpha beta gamma
            - separator [ref=e156]
          - list [ref=e157]:
            - generic [ref=e158]:
              - generic [ref=e159]:
                - separator [ref=e160]
                - textbox [active] [ref=e162]: First child
                - separator [ref=e163]
              - button [ref=e164]
              - list
        - generic [ref=e166]:
          - generic [ref=e167]:
            - separator [ref=e168]
            - textbox [ref=e170]: Card 2 alpha beta gamma
            - separator [ref=e171]
          - list [ref=e172]:
            - generic [ref=e173]:
              - generic [ref=e174]:
                - separator [ref=e175]
                - textbox [ref=e177]: Second child
                - separator [ref=e178]
              - button [ref=e179]
              - list
        - generic [ref=e181]:
          - generic [ref=e182]:
            - separator [ref=e183]
            - textbox [ref=e185]: Card 3 alpha beta gamma
            - separator [ref=e186]
          - button [ref=e187]
          - list
        - generic [ref=e189]:
          - generic [ref=e190]:
            - separator [ref=e191]
            - textbox [ref=e193]: Card 4 alpha beta gamma
            - separator [ref=e194]
          - button [ref=e195]
          - list
      - generic [ref=e197]:
        - generic [ref=e199]:
          - generic [ref=e200]: AC
          - button [ref=e202]
        - generic [ref=e205]:
          - generic [ref=e206]: NC
          - button [ref=e208]
        - generic [ref=e211]:
          - generic [ref=e212]: AR
          - button [ref=e214]
```

# Test source

```ts
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
  292 | test('formatting a range skips extension spacers', async ({ page }) => {
  293 | 	await setup(page);
  294 | 	await cells(page).first().click();
  295 | 	await page.keyboard.press('Control+e');
  296 | 	await page.keyboard.type('Extended response');
  297 | 	await cells(page).first().click();
  298 | 	await cells(page)
  299 | 		.nth(2)
  300 | 		.click({ modifiers: ['Shift'] });
  301 | 	await page.keyboard.press('Control+b');
  302 | 	await expect(page.locator('.flow .text.bold')).toHaveCount(2);
  303 | 	await page.keyboard.press('Control+c');
  304 | 	const copied = JSON.parse(await page.evaluate(() => window.selectionCopy ?? ''));
  305 | 	expect(copied.boxes[0].value.bold).toBe(true);
  306 | 	expect(copied.boxes[0].children[0].value.isExtension).toBe(true);
  307 | 	expect(copied.boxes[0].children[0].value.bold).toBeUndefined();
  308 | });
  309 | 
  310 | test('children across different parents form a column rectangle without selecting their parents', async ({
  311 | 	page
  312 | }) => {
  313 | 	await setup(page);
  314 | 	const original = (id: string) => page.locator(`[data-box-id="${id}"] textarea`);
  315 | 	await original('box-0').press('Shift+Enter');
  316 | 	await page.keyboard.type('First child');
  317 | 	await original('box-1').press('Shift+Enter');
  318 | 	await page.keyboard.type('Second child');
  319 | 	const responses = page.locator('.flow textarea');
  320 | 	const firstResponse = responses.nth(1),
  321 | 		secondResponse = responses.nth(3);
  322 | 	await expect(firstResponse).toHaveValue('First child');
  323 | 	await expect(secondResponse).toHaveValue('Second child');
  324 | 	await drag(page, firstResponse, secondResponse);
> 325 | 	await expect(selected(page)).toHaveCount(2);
      |                               ^ Error: expect(locator).toHaveCount(expected) failed
  326 | 	expect(
  327 | 		await selected(page)
  328 | 			.locator(':scope > .content textarea')
  329 | 			.evaluateAll((cells) => cells.map((cell) => (cell as HTMLTextAreaElement).value))
  330 | 	).toEqual(['First child', 'Second child']);
  331 | 	await original('box-3').click();
  332 | 	await firstResponse.click();
  333 | 	await secondResponse.click({ modifiers: ['Shift'] });
  334 | 	await expect(selected(page)).toHaveCount(2);
  335 | 	await page.keyboard.press('Control+b');
  336 | 	await expect(page.locator('.flow .text.bold')).toHaveCount(2);
  337 | 	await expect(page.locator('[data-box-id="box-1"] .text')).not.toHaveClass(/bold/);
  338 | });
  339 | 
  340 | test('Ctrl/Cmd click picks individual cells and joined corners follow the selected surfaces', async ({
  341 | 	page
  342 | }) => {
  343 | 	await setup(page);
  344 | 	await cells(page).nth(0).click();
  345 | 	await cells(page)
  346 | 		.nth(2)
  347 | 		.click({ modifiers: ['ControlOrMeta'] });
  348 | 	await expect(selected(page)).toHaveCount(1);
  349 | 	// Ctrl/Cmd-click toggles independent cells; the focused cell is added explicitly.
  350 | 	await cells(page)
  351 | 		.nth(0)
  352 | 		.click({ modifiers: ['ControlOrMeta'] });
  353 | 	await expect(selected(page)).toHaveCount(2);
  354 | 	await cells(page)
  355 | 		.nth(2)
  356 | 		.click({ modifiers: ['ControlOrMeta'] });
  357 | 	await expect(selected(page)).toHaveCount(1);
  358 | 	await cells(page).nth(1).click();
  359 | 	await cells(page).nth(1).press('Shift+Enter');
  360 | 	await page.keyboard.type('Adjacent child');
  361 | 	const parent = page.locator('[data-box-id="box-1"]');
  362 | 	const response = page.locator('.flow textarea').nth(2);
  363 | 	await drag(page, parent.locator('textarea'), response);
  364 | 	await expect(selected(page)).toHaveCount(2);
  365 | 	await expect
  366 | 		.poll(() => parent.evaluate((el) => getComputedStyle(el).borderTopRightRadius))
  367 | 		.toBe('0px');
  368 | 	expect(
  369 | 		await parent.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))
  370 | 	).toBeGreaterThan(0);
  371 | 	const childContent = response.locator('xpath=ancestor::*[@data-box-id]');
  372 | 	await expect
  373 | 		.poll(() => childContent.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))
  374 | 		.toBe('0px');
  375 | 	expect(
  376 | 		await childContent.evaluate((el) => parseFloat(getComputedStyle(el).borderTopRightRadius))
  377 | 	).toBeGreaterThan(0);
  378 | });
  379 | 
  380 | test('selection surfaces follow themes and resized typography, padding and corner settings', async ({
  381 | 	page
  382 | }) => {
  383 | 	await setup(page);
  384 | 	await cells(page).nth(0).press('Shift+Enter');
  385 | 	await page.keyboard.type('Adjacent response');
  386 | 	await drag(page, cells(page).nth(0), cells(page).nth(1));
  387 | 	const parent = page.locator('.flow [data-box-id="box-0"]');
  388 | 	for (const theme of ['light', 'dark', 'custom']) {
  389 | 		await page.evaluate((theme) => {
  390 | 			document.body.classList.toggle('dark', theme === 'dark');
  391 | 			document.body.classList.toggle('custom', theme === 'custom');
  392 | 			document.body.style.setProperty('--padding', '12px');
  393 | 			document.body.style.setProperty('--border-radius', '36px');
  394 | 			document.body.style.fontSize = '24px';
  395 | 			document.body.style.setProperty('--custom-background-accent-active', '#ffccff');
  396 | 			document.body.style.setProperty('--custom-background-accent-secondary-active', '#ccffcc');
  397 | 		}, theme);
  398 | 		await expect(selected(page)).toHaveCount(2);
  399 | 		await expect
  400 | 			.poll(() => parent.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))
  401 | 			.toBe('18px');
  402 | 		await expect
  403 | 			.poll(() => parent.evaluate((el) => getComputedStyle(el).borderTopRightRadius))
  404 | 			.toBe('0px');
  405 | 		expect(await parent.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
  406 | 			'rgba(0, 0, 0, 0)'
  407 | 		);
  408 | 	}
  409 | });
  410 | 
  411 | test('dragging a multiselection from its textarea inserts between siblings and keeps its children', async ({
  412 | 	page
  413 | }) => {
  414 | 	await setup(page);
  415 | 	await cells(page).first().press('Shift+Enter');
  416 | 	await page.keyboard.type('Child response');
  417 | 	const first = page.locator('[data-box-id="box-0"] textarea');
  418 | 	const second = page.locator('[data-box-id="box-1"] textarea');
  419 | 	await first.click();
  420 | 	await first.click({ modifiers: ['ControlOrMeta'] });
  421 | 	await second.click({ modifiers: ['ControlOrMeta'] });
  422 | 	await expect(selected(page)).toHaveCount(2);
  423 | 	const target = page.locator('[data-box-id="box-3"]');
  424 | 	await first.dragTo(target, { targetPosition: { x: 30, y: 1 } });
  425 | 	const roots = page.locator('.flow .boxes > .box > .children > .box > .content');
```