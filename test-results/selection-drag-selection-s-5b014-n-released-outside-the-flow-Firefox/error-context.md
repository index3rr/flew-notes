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
          - generic [ref=e211]:
            - separator [ref=e212]
            - textbox [ref=e214]: Card 5 alpha beta gamma
            - separator [ref=e215]
          - button [ref=e216]
          - list
        - generic [ref=e220]:
          - generic [ref=e221]:
            - separator [ref=e222]
            - textbox [ref=e224]: Card 6 alpha beta gamma
            - separator [ref=e225]
          - button [ref=e226]
          - list
        - generic [ref=e230]:
          - generic [ref=e231]:
            - separator [ref=e232]
            - textbox [ref=e234]: Card 7 alpha beta gamma
            - separator [ref=e235]
          - button [ref=e236]
          - list
        - generic [ref=e240]:
          - generic [ref=e241]:
            - separator [ref=e242]
            - textbox [ref=e244]: Card 8 alpha beta gamma
            - separator [ref=e245]
          - button [ref=e246]
          - list
        - generic [ref=e250]:
          - generic [ref=e251]:
            - separator [ref=e252]
            - textbox [ref=e254]: Card 9 alpha beta gamma
            - separator [ref=e255]
          - button [ref=e256]
          - list
        - generic [ref=e260]:
          - generic [ref=e261]:
            - separator [ref=e262]
            - textbox [ref=e264]: Card 10 alpha beta gamma
            - separator [ref=e265]
          - button [ref=e266]
          - list
        - generic [ref=e270]:
          - generic [ref=e271]:
            - separator [ref=e272]
            - textbox [ref=e274]: Card 11 alpha beta gamma
            - separator [ref=e275]
          - button [ref=e276]
          - list
        - generic [ref=e280]:
          - generic [ref=e281]:
            - separator [ref=e282]
            - textbox [ref=e284]: Card 12 alpha beta gamma
            - separator [ref=e285]
          - button [ref=e286]
          - list
        - generic [ref=e290]:
          - generic [ref=e291]:
            - separator [ref=e292]
            - textbox [ref=e294]: Card 13 alpha beta gamma
            - separator [ref=e295]
          - button [ref=e296]
          - list
        - generic [ref=e300]:
          - generic [ref=e301]:
            - separator [ref=e302]
            - textbox [ref=e304]: Card 14 alpha beta gamma
            - separator [ref=e305]
          - button [ref=e306]
          - list
        - generic [ref=e310]:
          - generic [ref=e311]:
            - separator [ref=e312]
            - textbox [ref=e314]: Card 15 alpha beta gamma
            - separator [ref=e315]
          - button [ref=e316]
          - list
        - generic [ref=e320]:
          - generic [ref=e321]:
            - separator [ref=e322]
            - textbox [ref=e324]: Card 16 alpha beta gamma
            - separator [ref=e325]
          - button [ref=e326]
          - list
        - generic [ref=e330]:
          - generic [ref=e331]:
            - separator [ref=e332]
            - textbox [ref=e334]: Card 17 alpha beta gamma
            - separator [ref=e335]
          - button [ref=e336]
          - list
        - generic [ref=e340]:
          - generic [ref=e341]:
            - separator [ref=e342]
            - textbox [ref=e344]: Card 18 alpha beta gamma
            - separator [ref=e345]
          - button [ref=e346]
          - list
        - generic [ref=e350]:
          - generic [ref=e351]:
            - separator [ref=e352]
            - textbox [ref=e354]: Card 19 alpha beta gamma
            - separator [ref=e355]
          - button [ref=e356]
          - list
        - generic [ref=e360]:
          - generic [ref=e361]:
            - separator [ref=e362]
            - textbox [ref=e364]: Card 20 alpha beta gamma
            - separator [ref=e365]
          - button [ref=e366]
          - list
        - generic [ref=e370]:
          - generic [ref=e371]:
            - separator [ref=e372]
            - textbox [ref=e374]: Card 21 alpha beta gamma
            - separator [ref=e375]
          - button [ref=e376]
          - list
        - generic [ref=e380]:
          - generic [ref=e381]:
            - separator [ref=e382]
            - textbox [ref=e384]: Card 22 alpha beta gamma
            - separator [ref=e385]
          - button [ref=e386]
          - list
        - generic [ref=e390]:
          - generic [ref=e391]:
            - separator [ref=e392]
            - textbox [ref=e394]: Card 23 alpha beta gamma
            - separator [ref=e395]
          - button [ref=e396]
          - list
        - generic [ref=e400]:
          - generic [ref=e401]:
            - separator [ref=e402]
            - textbox [ref=e404]: Card 24 alpha beta gamma
            - separator [ref=e405]
          - button [ref=e406]
          - list
        - generic [ref=e410]:
          - generic [ref=e411]:
            - separator [ref=e412]
            - textbox [ref=e414]: Card 25 alpha beta gamma
            - separator [ref=e415]
          - button [ref=e416]
          - list
        - generic [ref=e420]:
          - generic [ref=e421]:
            - separator [ref=e422]
            - textbox [ref=e424]: Card 26 alpha beta gamma
            - separator [ref=e425]
          - button [ref=e426]
          - list
        - generic [ref=e430]:
          - generic [ref=e431]:
            - separator [ref=e432]
            - textbox [ref=e434]: Card 27 alpha beta gamma
            - separator [ref=e435]
          - button [ref=e436]
          - list
        - generic [ref=e440]:
          - generic [ref=e441]:
            - separator [ref=e442]
            - textbox [ref=e444]: Card 28 alpha beta gamma
            - separator [ref=e445]
          - button [ref=e446]
          - list
        - generic [ref=e450]:
          - generic [ref=e451]:
            - separator [ref=e452]
            - textbox [ref=e454]: Card 29 alpha beta gamma
            - separator [ref=e455]
          - button [ref=e456]
          - list
        - generic [ref=e460]:
          - generic [ref=e461]:
            - separator [ref=e462]
            - textbox [ref=e464]: Card 30 alpha beta gamma
            - separator [ref=e465]
          - button [ref=e466]
          - list
      - generic [ref=e470]:
        - generic [ref=e472]:
          - generic [ref=e473]: AC
          - button [ref=e475]
        - generic [ref=e480]:
          - generic [ref=e481]: NC
          - button [ref=e483]
        - generic [ref=e488]:
          - generic [ref=e489]: AR
          - button [ref=e491]
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