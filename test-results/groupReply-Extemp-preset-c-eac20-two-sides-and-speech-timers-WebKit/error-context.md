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
  521 | 		await setup(host);
  522 | 		await connect(host, guest);
  523 | 		await selectCards(guest);
  524 | 		await guest.keyboard.press('Shift+Enter');
  525 | 		await expect(host.locator('.groupReplies path')).toHaveCount(1);
  526 | 		await guest.keyboard.type('Shared group reply');
  527 | 		await (await argument(guest, 'First card')).click();
  528 | 		await expect
  529 | 			.poll(async () =>
  530 | 				cells(host).evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value))
  531 | 			)
  532 | 			.toContain('Shared group reply');
  533 | 		await (await argument(guest, 'Third card')).press('Shift+Enter');
  534 | 		await guest.keyboard.type('Shared additional response');
  535 | 		await (await argument(guest, 'First card')).click();
  536 | 		await expect
  537 | 			.poll(async () =>
  538 | 				cells(host).evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value))
  539 | 			)
  540 | 			.toContain('Shared additional response');
  541 | 		await expectResponseEndpoint(host, 'Shared additional response');
  542 | 		await guest.keyboard.press('Control+z');
  543 | 		await guest.keyboard.press('Control+z');
  544 | 		await expect(host.locator('.groupReplies path')).toHaveCount(1);
  545 | 		await expectResponseEndpoint(host, 'Existing response');
  546 | 		await guest.keyboard.press('Control+z');
  547 | 		await guest.keyboard.press('Control+z');
  548 | 		await expect(host.locator('.groupReplies path')).toHaveCount(0);
  549 | 	} finally {
  550 | 		await host.context().close();
  551 | 		await guest.context().close();
  552 | 	}
  553 | });
  554 | 
  555 | test('invalid cross-column response links fail import without replacing the document', async ({
  556 | 	page
  557 | }) => {
  558 | 	const data = await setup(page);
  559 | 	Object.assign(data.nodes['box-r'].value, { respondsTo: ['box-r'] });
  560 | 	await page.locator('#uploadId').setInputFiles({
  561 | 		name: 'Bad.json',
  562 | 		mimeType: 'application/json',
  563 | 		buffer: Buffer.from(JSON.stringify(data))
  564 | 	});
  565 | 	await expect(page.locator('.popups')).toContainText('Invalid file');
  566 | 	await expect(cells(page)).toHaveCount(4);
  567 | });
  568 | 
  569 | test('Extemp preset creates its two sides and speech timers', async ({ page }) => {
  570 | 	await page.addInitScript(() =>
  571 | 		localStorage.setItem(
  572 | 			'settings',
  573 | 			JSON.stringify({
  574 | 				version: 1,
  575 | 				isSettings: true,
  576 | 				settings: { debateStyle: 11, telemetry: 0 }
  577 | 			})
  578 | 		)
  579 | 	);
  580 | 	await page.goto('/app');
  581 | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  582 | 	await expect(page.locator('.flow .header .text')).toHaveText([
  583 | 		'AC',
  584 | 		'NC',
  585 | 		'AR',
  586 | 		'NR',
  587 | 		'AS',
  588 | 		'NS'
  589 | 	]);
  590 | 
  591 | 	await expect(page.locator('.timer-panel .speeches .speech')).toHaveText([
  592 | 		'AC',
  593 | 		'NC',
  594 | 		'CX',
  595 | 		'AR',
  596 | 		'NR',
  597 | 		'AS',
  598 | 		'NS'
  599 | 	]);
  600 | 	for (const [speech, minutes] of [
  601 | 		['AC', '02'],
  602 | 		['NC', '02'],
  603 | 		['CX', '03'],
  604 | 		['AR', '02'],
  605 | 		['NR', '02'],
  606 | 		['AS', '01'],
  607 | 		['NS', '01']
  608 | 	]) {
  609 | 		await page
  610 | 			.locator('.timer-panel .speeches')
  611 | 			.getByRole('button', { name: speech, exact: true })
  612 | 			.click();
  613 | 		await expect(page.locator('.time .minutes')).toHaveValue(minutes);
  614 | 	}
  615 | 	await page.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
  616 | 	await expect(page.locator('.flow .header .text')).toHaveText(['NC', 'AR', 'NR', 'AS', 'NS']);
  617 | });
  618 | 
      |     ^ Error: locator.click: Test timeout of 30000ms exceeded.
```