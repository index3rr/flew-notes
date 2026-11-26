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
  318 | 	await setup(page);
  319 | 	const original = (id: string) => page.locator(`[data-box-id="${id}"] textarea`);
  320 | 	await original('box-0').press('Shift+Enter');
  321 | 	await page.keyboard.type('First child');
  322 | 	await original('box-1').press('Shift+Enter');
  323 | 	await page.keyboard.type('Second child');
  324 | 	const responses = page.locator('.flow textarea');
> 325 | 	const firstResponse = responses.nth(1),
      |                               ^ Error: expect(locator).toHaveCount(expected) failed
  326 | 		secondResponse = responses.nth(3);
  327 | 	await expect(firstResponse).toHaveValue('First child');
  328 | 	await expect(secondResponse).toHaveValue('Second child');
  329 | 	await drag(page, firstResponse, secondResponse);
  330 | 	await expect(selected(page)).toHaveCount(2);
  331 | 	expect(
  332 | 		await selected(page)
  333 | 			.locator(':scope > .content textarea')
  334 | 			.evaluateAll((cells) => cells.map((cell) => (cell as HTMLTextAreaElement).value))
  335 | 	).toEqual(['First child', 'Second child']);
  336 | 	await original('box-3').click();
  337 | 	await firstResponse.click();
  338 | 	await secondResponse.click({ modifiers: ['Shift'] });
  339 | 	await expect(selected(page)).toHaveCount(2);
  340 | 	await page.keyboard.press('Control+b');
  341 | 	await expect(page.locator('.flow .text.bold')).toHaveCount(2);
  342 | 	await expect(page.locator('[data-box-id="box-1"] .text')).not.toHaveClass(/bold/);
  343 | });
  344 | 
  345 | test('Ctrl/Cmd click picks individual cells and joined corners follow the selected surfaces', async ({
  346 | 	page
  347 | }) => {
  348 | 	await setup(page);
  349 | 	await cells(page).nth(0).click();
  350 | 	await cells(page)
  351 | 		.nth(2)
  352 | 		.click({ modifiers: ['ControlOrMeta'] });
  353 | 	await expect(selected(page)).toHaveCount(1);
  354 | 	// Ctrl/Cmd-click toggles independent cells; the focused cell is added explicitly.
  355 | 	await cells(page)
  356 | 		.nth(0)
  357 | 		.click({ modifiers: ['ControlOrMeta'] });
  358 | 	await expect(selected(page)).toHaveCount(2);
  359 | 	await cells(page)
  360 | 		.nth(2)
  361 | 		.click({ modifiers: ['ControlOrMeta'] });
  362 | 	await expect(selected(page)).toHaveCount(1);
  363 | 	await cells(page).nth(1).click();
  364 | 	await cells(page).nth(1).press('Shift+Enter');
  365 | 	await page.keyboard.type('Adjacent child');
  366 | 	const parent = page.locator('[data-box-id="box-1"]');
  367 | 	const response = page.locator('.flow textarea').nth(2);
  368 | 	await drag(page, parent.locator('textarea'), response);
  369 | 	await expect(selected(page)).toHaveCount(2);
  370 | 	await expect
  371 | 		.poll(() => parent.evaluate((el) => getComputedStyle(el).borderTopRightRadius))
  372 | 		.toBe('0px');
  373 | 	expect(
  374 | 		await parent.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))
  375 | 	).toBeGreaterThan(0);
  376 | 	const childContent = response.locator('xpath=ancestor::*[@data-box-id]');
  377 | 	await expect
  378 | 		.poll(() => childContent.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))
  379 | 		.toBe('0px');
  380 | 	expect(
  381 | 		await childContent.evaluate((el) => parseFloat(getComputedStyle(el).borderTopRightRadius))
  382 | 	).toBeGreaterThan(0);
  383 | });
  384 | 
  385 | test('selection surfaces follow themes and resized typography, padding and corner settings', async ({
  386 | 	page
  387 | }) => {
  388 | 	await setup(page);
  389 | 	await cells(page).nth(0).press('Shift+Enter');
  390 | 	await page.keyboard.type('Adjacent response');
  391 | 	await drag(page, cells(page).nth(0), cells(page).nth(1));
  392 | 	const parent = page.locator('.flow [data-box-id="box-0"]');
  393 | 	for (const theme of ['light', 'dark', 'custom']) {
  394 | 		await page.evaluate((theme) => {
  395 | 			document.body.classList.toggle('dark', theme === 'dark');
  396 | 			document.body.classList.toggle('custom', theme === 'custom');
  397 | 			document.body.style.setProperty('--padding', '12px');
  398 | 			document.body.style.setProperty('--border-radius', '36px');
  399 | 			document.body.style.fontSize = '24px';
  400 | 			document.body.style.setProperty('--custom-background-accent-active', '#ffccff');
  401 | 			document.body.style.setProperty('--custom-background-accent-secondary-active', '#ccffcc');
  402 | 		}, theme);
  403 | 		await expect(selected(page)).toHaveCount(2);
  404 | 		await expect
  405 | 			.poll(() => parent.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))
  406 | 			.toBe('18px');
  407 | 		await expect
  408 | 			.poll(() => parent.evaluate((el) => getComputedStyle(el).borderTopRightRadius))
  409 | 			.toBe('0px');
  410 | 		expect(await parent.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
  411 | 			'rgba(0, 0, 0, 0)'
  412 | 		);
  413 | 	}
  414 | });
  415 | 
  416 | test('dragging a multiselection from its textarea inserts between siblings and keeps its children', async ({
  417 | 	page
  418 | }) => {
  419 | 	await setup(page);
  420 | 	await cells(page).first().press('Shift+Enter');
  421 | 	await page.keyboard.type('Child response');
  422 | 	const first = page.locator('[data-box-id="box-0"] textarea');
  423 | 	const second = page.locator('[data-box-id="box-1"] textarea');
  424 | 	await first.click();
  425 | 	await first.click({ modifiers: ['ControlOrMeta'] });
```