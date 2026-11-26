# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: consistency.spec.ts >> a Flew paste preserves its branch when rich evidence HTML is also present
- Location: tests/consistency.spec.ts:250:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.flow textarea')
Expected: 2
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" locator('.flow textarea') with timeout 5000ms
  - waiting for locator('.flow textarea')
    14 × locator resolved to 1 element
       - unexpected value "1"

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
          - tooltip [ref=e38]:
            - button "Close flow" [ref=e39]
          - generic: Close flow
      - region "Flow pages" [ref=e46]:
        - generic [ref=e47]:
          - tooltip [ref=e48]:
            - heading "Tabs" [level=2] [ref=e49]
          - tooltip [ref=e51]:
            - button "Tabs menu" [ref=e52]
        - generic [ref=e57]:
          - list [ref=e58]:
            - listitem [ref=e59]:
              - button "no name" [ref=e61]
          - generic [ref=e63]:
            - tooltip [ref=e64]:
              - button "aff" [ref=e65]
            - tooltip [ref=e69]:
              - button "neg" [ref=e70]
    - generic [ref=e76]:
      - textbox "type name here" [active] [ref=e78]
      - tooltip [ref=e80]:
        - button [ref=e81]
    - generic [ref=e90]:
      - tooltip [ref=e91]:
        - button [ref=e92]
      - tooltip [ref=e96]:
        - button [disabled] [ref=e97]
      - tooltip [ref=e101]:
        - button [disabled] [ref=e102]
      - tooltip [ref=e107]:
        - button [disabled] [ref=e108]
      - tooltip [ref=e113]:
        - button [disabled] [ref=e114]
      - tooltip [ref=e119]:
        - button "Delete selected cell" [disabled] [ref=e120]
      - tooltip [ref=e125]:
        - button [disabled] [ref=e126]
      - tooltip [ref=e132]:
        - button "Toggle starred argument" [disabled] [ref=e133]
      - tooltip [ref=e136]:
        - button "Toggle crossed out" [disabled] [ref=e137]
      - tooltip [ref=e142]:
        - button [disabled] [ref=e143]
      - tooltip [ref=e147]:
        - button [disabled] [ref=e148]
    - generic [ref=e154]:
      - list [ref=e158]:
        - generic [ref=e159]:
          - generic [ref=e160]:
            - separator [ref=e161]
            - textbox "type here" [ref=e163]
            - separator [ref=e164]
          - button [ref=e165]
          - list
      - generic [ref=e169]:
        - generic [ref=e171]:
          - generic [ref=e172]: 1AC
          - button [ref=e174]
        - generic [ref=e179]:
          - generic [ref=e180]: 1NC
          - button [ref=e182]
        - generic [ref=e187]:
          - generic [ref=e188]: 2AC
          - button [ref=e190]
        - generic [ref=e195]:
          - generic [ref=e196]: 2NC/1NR
          - button [ref=e198]
        - generic [ref=e203]:
          - generic [ref=e204]: 1AR
          - button [ref=e206]
        - generic [ref=e211]:
          - generic [ref=e212]: 2NR
          - button [ref=e214]
        - generic [ref=e219]:
          - generic [ref=e220]: 2AR
          - button [ref=e222]
```

# Test source

```ts
  179 | 	await setup(page, { coveragePanel: 2, timersPanel: 0 });
  180 | 	await page.locator('#uploadId').setInputFiles('test-files/tutorials/round.json');
  181 | 	await page.locator('.coverage-panel').getByRole('button', { name: '1NC', exact: true }).click();
  182 | 	const item = page
  183 | 		.locator('.coverage-panel .panel-row')
  184 | 		.filter({ hasText: 'Costs are already declining' });
  185 | 	await item.getByRole('button', { name: 'Answer', exact: true }).click();
  186 | 	await expect(page.locator('.flow textarea').last()).toBeFocused();
  187 | 	await page.keyboard.type('Answer from Coverage');
  188 | 	await expect(page.locator('.flow textarea').last()).toHaveValue('Answer from Coverage');
  189 | });
  190 | 
  191 | test('native text selection stays text when the pointer leaves the cell', async ({ page }) => {
  192 | 	await setup(page, { timersPanel: 0 });
  193 | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  194 | 	const fields = page.locator('.flow textarea');
  195 | 	await fields.first().fill('Select a few words without moving an argument.');
  196 | 	await fields.first().press('Enter');
  197 | 	await fields.nth(1).fill('Another argument');
  198 | 	const first = await fields.first().boundingBox();
  199 | 	const last = await fields.nth(1).boundingBox();
  200 | 	if (!first || !last) throw new Error('Missing cell');
  201 | 	await page.mouse.move(first.x + 5, first.y + first.height / 2);
  202 | 	await page.mouse.down();
  203 | 	await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2, { steps: 12 });
  204 | 	await page.waitForFunction(() => {
  205 | 		const field = document.querySelector('.flow textarea') as HTMLTextAreaElement;
  206 | 		return field.selectionStart !== field.selectionEnd;
  207 | 	});
  208 | 	await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 12 });
  209 | 	await page.mouse.up();
  210 | 	await expect(page.locator('.flow .box.selected')).toHaveCount(0);
  211 | });
  212 | 
  213 | for (const include of [false, true])
  214 | 	test(`Autoflow citations are optional (${include}) and evidence is retained`, async ({
  215 | 		page
  216 | 	}) => {
  217 | 		await setup(page, { timersPanel: 0, autoflowPanel: 1, autoflowIncludeCites: include });
  218 | 		await page.getByRole('button', { name: 'New flow', exact: true }).click();
  219 | 		const docx = await JSZip.loadAsync(await readFile('test-files/autoflow/headings.docx'));
  220 | 		docx.file(
  221 | 			'word/document.xml',
  222 | 			(await docx.file('word/document.xml')!.async('string')).replace(
  223 | 				'Growth solves poverty</w:t></w:r></w:p>',
  224 | 				'Growth solves poverty</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Cite"/></w:pPr><w:r><w:t>Author 2026</w:t></w:r></w:p><w:p><w:r><w:t>Complete evidence body.</w:t></w:r></w:p>'
  225 | 			)
  226 | 		);
  227 | 		await page.locator('.autoflow-panel input').setInputFiles({
  228 | 			name: 'cards.docx',
  229 | 			mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  230 | 			buffer: await docx.generateAsync({ type: 'nodebuffer' })
  231 | 		});
  232 | 		await page.locator('.autoflow-panel .blocks > div').first().getByRole('button').last().click();
  233 | 		await expect(page.locator('.flow textarea').first()).toHaveValue(
  234 | 			'Growth solves poverty' + (include ? '\nAuthor 2026' : '')
  235 | 		);
  236 | 		const html = await page
  237 | 			.locator('.flow [data-box-id]')
  238 | 			.first()
  239 | 			.evaluate((element) => {
  240 | 				const dataTransfer = new DataTransfer();
  241 | 				element.dispatchEvent(
  242 | 					new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer })
  243 | 				);
  244 | 				return dataTransfer.getData('text/html');
  245 | 			});
  246 | 		expect(html).toContain('Author 2026');
  247 | 		expect(html).toContain('Complete evidence body.');
  248 | 	});
  249 | 
  250 | test('a Flew paste preserves its branch when rich evidence HTML is also present', async ({
  251 | 	page
  252 | }) => {
  253 | 	await setup(page, { timersPanel: 0 });
  254 | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  255 | 	const payload = {
  256 | 		tag: 'flew-notes-boxes',
  257 | 		version: 1,
  258 | 		boxes: [
  259 | 			{
  260 | 				value: { content: 'Parent', bold: true, starred: true },
  261 | 				children: [{ value: { content: 'Child response' }, children: [] }]
  262 | 			}
  263 | 		]
  264 | 	};
  265 | 	await page
  266 | 		.locator('.flow textarea')
  267 | 		.first()
  268 | 		.evaluate(
  269 | 			(element, { payload, card }) => {
  270 | 				const clipboardData = new DataTransfer();
  271 | 				clipboardData.setData('text/plain', JSON.stringify(payload));
  272 | 				clipboardData.setData('text/html', card);
  273 | 				element.dispatchEvent(
  274 | 					new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })
  275 | 				);
  276 | 			},
  277 | 			{ payload, card }
  278 | 		);
> 279 | 	await expect(page.locator('.flow textarea')).toHaveCount(2);
      |                                               ^ Error: expect(locator).toHaveCount(expected) failed
  280 | 	await expect(page.locator('.flow textarea').first()).toHaveValue('Parent');
  281 | 	await expect(page.locator('.flow textarea').last()).toHaveValue('Child response');
  282 | 	await expect(page.locator('.flow .box .bold')).toHaveCount(1);
  283 | 	await expect(page.getByLabel('Starred argument', { exact: true })).toHaveCount(1);
  284 | });
  285 | 
  286 | test('malformed structured clipboard data cannot break cell editing', async ({ page }) => {
  287 | 	const errors: string[] = [];
  288 | 	page.on('pageerror', (error) => errors.push(error.message));
  289 | 	await setup(page, { timersPanel: 0 });
  290 | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  291 | 	for (const text of [
  292 | 		'null',
  293 | 		'{"tag":"flew-notes-boxes","version":1}',
  294 | 		'{"tag":"flew-notes-boxes","version":1,"boxes":[null]}'
  295 | 	]) {
  296 | 		await page
  297 | 			.locator('.flow textarea')
  298 | 			.first()
  299 | 			.evaluate((element, text) => {
  300 | 				const clipboardData = new DataTransfer();
  301 | 				clipboardData.setData('text/plain', text);
  302 | 				element.dispatchEvent(
  303 | 					new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })
  304 | 				);
  305 | 			}, text);
  306 | 	}
  307 | 	await page.locator('.flow textarea').first().fill('Still editable');
  308 | 	await page.locator('.flow textarea').first().press('Enter');
  309 | 	await expect(page.locator('.flow textarea')).toHaveCount(2);
  310 | 	expect(errors).toEqual([]);
  311 | });
  312 | 
  313 | test('panel tutorial video loads and plays from its shared menu',async({page})=>{
  314 |  await setup(page,{notesPanel:2,timersPanel:0});await page.getByRole('button',{name:'New flow',exact:true}).click();
  315 |  await page.getByRole('button',{name:'Notes menu',exact:true}).click();await page.getByRole('menuitem',{name:'How to use Notes',exact:true}).click();
  316 |  const video=page.getByLabel('Notes tutorial',{exact:true});
  317 |  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).readyState)).toBeGreaterThan(0);
  318 |  await video.evaluate(async element=>{await (element as HTMLVideoElement).play();});
  319 |  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
  320 |  await expect(video.locator('track')).toHaveAttribute('src','/tutorials/notesPanel.vtt');
  321 | });
  322 | 
  323 | test('a long tooltip keeps its size while the pointer moves',async({page})=>{
  324 |  await setup(page,{timersPanel:0,coveragePanel:2});await page.getByRole('button',{name:'New flow',exact:true}).click();
  325 |  const button=page.locator('.coverage-panel .panel-header .name');await button.hover();
  326 |  const tooltip=page.locator('.tooltip').filter({hasText:'what the selected speech'}).first();await expect(tooltip).toBeVisible();
  327 |  const before=await tooltip.boundingBox();const bounds=await button.boundingBox();if(!before || !bounds)throw new Error('Missing tooltip');
  328 |  await page.mouse.move(bounds.x+2,bounds.y+2);await page.mouse.move(bounds.x+bounds.width-2,bounds.y+bounds.height-2,{steps:15});
  329 |  const after=await tooltip.boundingBox();expect(after?.width).toBeCloseTo(before.width,0);expect(after?.height).toBeCloseTo(before.height,0);
  330 | });
  331 | 
```