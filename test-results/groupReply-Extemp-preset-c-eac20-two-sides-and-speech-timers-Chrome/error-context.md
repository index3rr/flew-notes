# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: groupReply.spec.ts >> Extemp preset creates its two sides and speech timers
- Location: tests/groupReply.spec.ts:578:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.timer-panel .speeches').getByRole('button', { name: 'AC', exact: true })

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
                - button "no name" [ref=e61]
            - generic [ref=e63]:
              - tooltip [ref=e64]:
                - button "aff" [ref=e65]
              - tooltip [ref=e67]:
                - button "neg" [ref=e68]
        - tooltip [ref=e71]:
          - button "Timers" [ref=e72]
    - generic [ref=e79]:
      - textbox "type name here" [active] [ref=e81]
      - tooltip [ref=e83]:
        - button [ref=e84]
    - generic [ref=e92]:
      - tooltip [ref=e93]:
        - button [ref=e94]
      - tooltip [ref=e98]:
        - button [disabled] [ref=e99]
      - tooltip [ref=e103]:
        - button [disabled] [ref=e104]
      - tooltip [ref=e107]:
        - button [disabled] [ref=e108]
      - tooltip [ref=e111]:
        - button [disabled] [ref=e112]
      - tooltip [ref=e115]:
        - button "Delete selected cell" [disabled] [ref=e116]
      - tooltip [ref=e120]:
        - button [disabled] [ref=e121]
      - tooltip [ref=e125]:
        - button "Toggle starred argument" [disabled] [ref=e126]
      - tooltip [ref=e129]:
        - button "Toggle crossed out" [disabled] [ref=e130]
      - tooltip [ref=e134]:
        - button [disabled] [ref=e135]
      - tooltip [ref=e139]:
        - button [disabled] [ref=e140]
    - generic [ref=e146]:
      - list [ref=e150]:
        - generic [ref=e151]:
          - generic [ref=e152]:
            - separator [ref=e153]
            - textbox "type here" [ref=e155]
            - separator [ref=e156]
          - button [ref=e157]
          - list
      - generic [ref=e159]:
        - generic [ref=e161]:
          - generic [ref=e162]: AC
          - button [ref=e164]
        - generic [ref=e167]:
          - generic [ref=e168]: NC
          - button [ref=e170]
        - generic [ref=e173]:
          - generic [ref=e174]: AR
          - button [ref=e176]
        - generic [ref=e179]:
          - generic [ref=e180]: NR
          - button [ref=e182]
        - generic [ref=e185]:
          - generic [ref=e186]: AS
          - button [ref=e188]
        - generic [ref=e191]:
          - generic [ref=e192]: NS
          - button [ref=e194]
```

# Test source

```ts
  521 | 		expect(samples.every(({ curve, line }) => curve === line)).toBe(true);
  522 | 		expect(new Set(samples.map(({ curve }) => curve)).size).toBeGreaterThan(1);
  523 | 	});
  524 | }
  525 | 
  526 | test('group replies synchronize and undo on a connected peer', async ({ browser }) => {
  527 | 	const host = await peer(browser);
  528 | 	const guest = await peer(browser);
  529 | 	try {
  530 | 		await setup(host);
  531 | 		await connect(host, guest);
  532 | 		await selectCards(guest);
  533 | 		await guest.keyboard.press('Shift+Enter');
  534 | 		await expect(host.locator('.groupReplies path')).toHaveCount(1);
  535 | 		await guest.keyboard.type('Shared group reply');
  536 | 		await (await argument(guest, 'First card')).click();
  537 | 		await expect
  538 | 			.poll(async () =>
  539 | 				cells(host).evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value))
  540 | 			)
  541 | 			.toContain('Shared group reply');
  542 | 		await (await argument(guest, 'Third card')).press('Shift+Enter');
  543 | 		await guest.keyboard.type('Shared additional response');
  544 | 		await (await argument(guest, 'First card')).click();
  545 | 		await expect
  546 | 			.poll(async () =>
  547 | 				cells(host).evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value))
  548 | 			)
  549 | 			.toContain('Shared additional response');
  550 | 		await expectResponseEndpoint(host, 'Shared additional response');
  551 | 		await guest.keyboard.press('Control+z');
  552 | 		await guest.keyboard.press('Control+z');
  553 | 		await expect(host.locator('.groupReplies path')).toHaveCount(1);
  554 | 		await expectResponseEndpoint(host, 'Existing response');
  555 | 		await guest.keyboard.press('Control+z');
  556 | 		await guest.keyboard.press('Control+z');
  557 | 		await expect(host.locator('.groupReplies path')).toHaveCount(0);
  558 | 	} finally {
  559 | 		await host.context().close();
  560 | 		await guest.context().close();
  561 | 	}
  562 | });
  563 | 
  564 | test('invalid cross-column response links fail import without replacing the document', async ({
  565 | 	page
  566 | }) => {
  567 | 	const data = await setup(page);
  568 | 	Object.assign(data.nodes['box-r'].value, { respondsTo: ['box-r'] });
  569 | 	await page.locator('#uploadId').setInputFiles({
  570 | 		name: 'Bad.json',
  571 | 		mimeType: 'application/json',
  572 | 		buffer: Buffer.from(JSON.stringify(data))
  573 | 	});
  574 | 	await expect(page.locator('.popups')).toContainText('Invalid file');
  575 | 	await expect(cells(page)).toHaveCount(4);
  576 | });
  577 | 
  578 | test('Extemp preset creates its two sides and speech timers', async ({ page }) => {
  579 | 	await page.addInitScript(() =>
  580 | 		localStorage.setItem(
  581 | 			'settings',
  582 | 			JSON.stringify({
  583 | 				version: 1,
  584 | 				isSettings: true,
  585 | 				settings: { debateStyle: 11, telemetry: 0 }
  586 | 			})
  587 | 		)
  588 | 	);
  589 | 	await page.goto('/app');
  590 | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  591 | 	await expect(page.locator('.flow .header .text')).toHaveText([
  592 | 		'AC',
  593 | 		'NC',
  594 | 		'AR',
  595 | 		'NR',
  596 | 		'AS',
  597 | 		'NS'
  598 | 	]);
  599 | 
  600 | 	await expect(page.locator('.timer-panel .speeches .speech')).toHaveText([
  601 | 		'AC',
  602 | 		'NC',
  603 | 		'CX',
  604 | 		'AR',
  605 | 		'NR',
  606 | 		'AS',
  607 | 		'NS'
  608 | 	]);
  609 | 	for (const [speech, minutes] of [
  610 | 		['AC', '02'],
  611 | 		['NC', '02'],
  612 | 		['CX', '03'],
  613 | 		['AR', '02'],
  614 | 		['NR', '02'],
  615 | 		['AS', '01'],
  616 | 		['NS', '01']
  617 | 	]) {
  618 | 		await page
  619 | 			.locator('.timer-panel .speeches')
  620 | 			.getByRole('button', { name: speech, exact: true })
> 621 | 			.click();
      |     ^ Error: locator.click: Test timeout of 30000ms exceeded.
  622 | 		await expect(page.locator('.time .minutes')).toHaveValue(minutes);
  623 | 	}
  624 | 	await page.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
  625 | 	await expect(page.locator('.flow .header .text')).toHaveText(['NC', 'AR', 'NR', 'AS', 'NS']);
  626 | });
  627 | 
```