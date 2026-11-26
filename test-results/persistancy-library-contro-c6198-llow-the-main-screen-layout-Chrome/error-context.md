# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: persistancy.spec.ts >> library controls, alternating rows, and Help tutorial follow the main-screen layout
- Location: tests/persistancy.spec.ts:602:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'restart tutorial', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e2]:
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
              - button "Choose file" [ref=e24]
            - tooltip [ref=e29]:
              - button [ref=e30]
          - generic [ref=e36]:
            - textbox "Flow document title" [ref=e38]:
              - /placeholder: new flow
            - tooltip [ref=e39]:
              - button "New flow" [ref=e40]
        - generic [ref=e42]:
          - region "Flow pages" [ref=e45]:
            - generic [ref=e46]:
              - tooltip [ref=e47]:
                - heading "Tabs" [level=2] [ref=e48]
              - tooltip [ref=e50]:
                - button "Tabs menu" [ref=e51]
            - generic [ref=e58]:
              - tooltip [ref=e59]:
                - button "aff" [disabled] [ref=e60]
              - tooltip [ref=e62]:
                - button "neg" [disabled] [ref=e63]
          - tooltip [ref=e66]:
            - button "Timers" [ref=e67]
      - generic [ref=e72]:
        - region "Flow library setup" [ref=e73]:
          - generic [ref=e74]:
            - heading "Flow library" [level=1] [ref=e75]
            - tooltip [ref=e76]:
              - button "Disconnect" [ref=e77]
            - tooltip [ref=e81]:
              - button "Refresh" [ref=e82]
        - generic [ref=e87]:
          - heading "persistancy" [level=1] [ref=e90]
          - region "Flow library" [ref=e93]:
            - button "preflows" [ref=e94]
            - generic [ref=e97]:
              - generic [ref=e99]:
                - generic [ref=e100]:
                  - strong [ref=e101]: Round
                  - time [ref=e102]: 12:35 PM
                - generic [ref=e103]: aff
              - generic [ref=e105]:
                - tooltip [ref=e106]:
                  - button "Open" [ref=e107]
                - tooltip [ref=e112]:
                  - button "Duplicate" [ref=e113]
                - tooltip [ref=e117]:
                  - button "Delete" [ref=e118]
            - generic [ref=e122]:
              - generic [ref=e124]:
                - generic [ref=e125]:
                  - strong [ref=e126]: Round copy
                  - time [ref=e127]: 12:35 PM
                - generic [ref=e128]: aff
              - generic [ref=e130]:
                - tooltip [ref=e131]:
                  - button "Open" [ref=e132]
                - tooltip [ref=e137]:
                  - button "Duplicate" [ref=e138]
                - tooltip [ref=e142]:
                  - button "Delete" [ref=e143]
            - status [ref=e147]: Skipped 1 invalid JSON file(s).
  - generic [ref=e149]:
    - generic [ref=e150]:
      - tooltip [ref=e151]:
        - button [ref=e152]
      - generic [ref=e156]: Help
    - generic [ref=e157]:
      - generic [ref=e158]:
        - button "start tutorial" [ref=e159]
        - button "panel tutorials" [ref=e163]
        - button "shortcuts" [ref=e166]
        - button "changelog" [ref=e169]
        - link [ref=e173] [cursor=pointer]:
          - /url: /
          - button "home page" [ref=e174]
        - link [ref=e178] [cursor=pointer]:
          - /url: https://github.com/index3rr/flew-notes
          - button "source code" [ref=e179]
        - tooltip [ref=e184]:
          - button "discord" [ref=e185]
        - tooltip [ref=e189]:
          - button "email" [ref=e190]
      - link [ref=e195] [cursor=pointer]:
        - /url: https://github.com/index3rr/flew-notes/issues/new
        - button "report a bug or suggest a feature" [ref=e196]
```

# Test source

```ts
  552 | 		await page.getByRole('button', { name: 'New flow', exact: true }).click();
  553 | 		await title(page).fill('Picked folder round');
  554 | 		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
  555 | 		await expect(page.locator('.save-status')).toHaveText('Saved');
  556 | 		await expect(page.locator('.sidebar .library-panel')).toHaveCount(0);
  557 | 		await closeFlow(page);
  558 | 		await expect(row(page, 'Picked folder round.json')).toBeVisible();
  559 | 		await expect(
  560 | 			page.locator('.prelude').getByRole('region', { name: 'Flow library', exact: true })
  561 | 		).toBeVisible();
  562 | 		await expect(
  563 | 			row(page, 'Picked folder round.json').getByRole('button', { name: 'Open', exact: true })
  564 | 		).toHaveClass(/top/);
  565 | 		const data = await disk(page, 'Picked folder round.json');
  566 | 		expect(data.title).toBe('Picked folder round');
  567 | 		const modified = await page.evaluate(async () => {
  568 | 			const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
  569 | 			const file = await (await dir.getFileHandle('Picked folder round.json')).getFile();
  570 | 			return new Date(file.lastModified).toISOString();
  571 | 		});
  572 | 		await expect(row(page, 'Picked folder round.json').locator('time')).toHaveAttribute(
  573 | 			'datetime',
  574 | 			modified
  575 | 		);
  576 | 		await expect(page.locator('.document-date')).toHaveCount(0);
  577 | 	}
  578 | );
  579 | 
  580 | nativeTest('denied folder permission leaves browser recovery available', async ({ page }) => {
  581 | 	await nativeFolder(page);
  582 | 	await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  583 | 	await title(page).fill('Recovery round');
  584 | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  585 | 	await closeFlow(page);
  586 | 	await page.evaluate(() => {
  587 | 		localStorage.setItem('deny-folder', 'true');
  588 | 		localStorage.setItem('reject-folder', 'true');
  589 | 	});
  590 | 	await page
  591 | 		.getByRole('button', { name: 'link a folder for automatic disk saves', exact: true })
  592 | 		.click();
  593 | 	await expect(page.getByRole('alert')).toContainText('Folder write permission was not granted');
  594 | 	await expect(
  595 | 		page.locator('.prelude .flow').filter({ has: page.getByText(/^(Recovered )?Recovery round$/) })
  596 | 	).toBeVisible();
  597 | 	await expect(
  598 | 		page.getByRole('button', { name: 'link a folder for automatic disk saves', exact: true })
  599 | 	).toBeEnabled();
  600 | });
  601 | 
  602 | test('library controls, alternating rows, and Help tutorial follow the main-screen layout', async ({
  603 | 	page
  604 | }) => {
  605 | 	await page.goto('/app');
  606 | 	test.skip(
  607 | 		await page.evaluate(() => !('showDirectoryPicker' in window)),
  608 | 		'Covered by the snapshot import and recovery export tests in browsers without writable handles.'
  609 | 	);
  610 | 	await expect(
  611 | 		page.getByRole('button', { name: 'link a folder for automatic disk saves', exact: true })
  612 | 	).toBeEnabled();
  613 | 	await page.getByLabel('Import flow folder').setInputFiles(fixtures);
  614 | 	const setup = page.getByRole('region', { name: 'Flow library setup', exact: true });
  615 | 	await expect(setup.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
  616 | 	await expect(setup.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible();
  617 | 	await expect(
  618 | 		page.getByRole('button', { name: 'link a folder for automatic disk saves', exact: true })
  619 | 	).toHaveCount(0);
  620 | 	await expect(page.getByRole('heading', { name: 'persistancy' })).toBeVisible();
  621 | 	await expect(lib(page).getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0);
  622 | 	await row(page, 'Round.json').getByRole('button', { name: 'Duplicate', exact: true }).click();
  623 | 	await expect(page.getByRole('button', { name: 'New flow', exact: true })).toHaveCount(0);
  624 | 	await page.getByRole('button', { name: 'Save flow', exact: true }).click();
  625 | 	await expect(
  626 | 		page
  627 | 			.locator('.popups')
  628 | 			.getByRole('button', { name: /^Close (?:flow|without saving)$/, exact: true })
  629 | 	).toHaveCount(0);
  630 | 	await page.keyboard.press('Escape');
  631 | 	await closeFlow(page);
  632 | 	const cards = lib(page).locator('[data-filename]');
  633 | 	await expect(cards).toHaveCount(2);
  634 | 	const backgrounds = await cards.evaluateAll((elements) =>
  635 | 		elements.map((element) => getComputedStyle(element).backgroundColor)
  636 | 	);
  637 | 	expect(backgrounds[0]).not.toBe(backgrounds[1]);
  638 | 	const tabs = await cards.first().locator('.infoView').boundingBox();
  639 | 	const controls = await cards.first().locator('.fixed').boundingBox();
  640 | 	expect(controls!.x).toBeGreaterThanOrEqual(tabs!.x + tabs!.width);
  641 | 	expect(Math.abs(controls!.y + controls!.height / 2 - (tabs!.y + tabs!.height / 2))).toBeLessThan(
  642 | 		1
  643 | 	);
  644 | 
  645 | 	await lib(page).getByRole('button', { name: 'preflows', exact: true }).click();
  646 | 	await expect(page.getByRole('heading', { name: 'preflows' })).toBeVisible();
  647 | 	await expect(page.getByRole('button', { name: 'Up one folder' })).toBeVisible();
  648 | 	await page.getByRole('button', { name: 'Up one folder' }).click();
  649 | 	await expect(page.getByRole('heading', { name: 'persistancy' })).toBeVisible();
  650 | 	await expect(page.getByRole('button', { name: 'restart tutorial', exact: true })).toHaveCount(0);
  651 | 	await page.getByRole('button', { name: 'Help', exact: true }).click();
> 652 | 	await page.getByRole('button', { name: 'restart tutorial', exact: true }).click();
      |                                                                            ^ Error: locator.click: Test timeout of 30000ms exceeded.
  653 | 	await expect(page.getByRole('heading', { name: 'persistancy' })).toHaveCount(0);
  654 | 	await expect(page.locator('.prelude')).toContainText('click to start tutorial');
  655 | });
  656 | 
  657 | nativeTest(
  658 | 	'new and duplicate flows pick save locations; cancellation keeps recovery and retries',
  659 | 	async ({ page }) => {
  660 | 		await nativeFolder(page);
  661 | 		await title(page).fill('First save');
  662 | 		await page.getByRole('button', { name: 'New flow', exact: true }).click();
  663 | 		await page.getByPlaceholder('type here', { exact: true }).fill('Latest pending text');
  664 | 		await expect(page.locator('.save-status')).toHaveText('Not saved to disk');
  665 | 		expect(await page.evaluate(() => localStorage.getItem('save-count'))).toBeNull();
  666 | 		expect(await diskNames(page)).not.toContain('First save.json');
  667 | 		await page.evaluate(() => localStorage.setItem('cancel-save', 'true'));
  668 | 		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
  669 | 		await expect.poll(() => page.evaluate(() => localStorage.getItem('save-count'))).toBe('1');
  670 | 		await expect(page.locator('.save-status')).toHaveText('Not saved to disk');
  671 | 		expect(await diskNames(page)).not.toContain('First save.json');
  672 | 		expect(
  673 | 			await page.evaluate(() =>
  674 | 				Object.keys(JSON.parse(localStorage.getItem('savedFlows')!))
  675 | 					.map((key) => localStorage.getItem(key))
  676 | 					.join('')
  677 | 			)
  678 | 		).toContain('Latest pending text');
  679 | 		await page.evaluate(() => localStorage.setItem('save-as-path', 'preflows/Chosen name.json'));
  680 | 		await page.getByPlaceholder('type here', { exact: true }).press('Control+s');
  681 | 		await expect(page.locator('.save-status')).toHaveText('Saved');
  682 | 		await expect(title(page)).toHaveValue('Chosen name');
  683 | 		expect(await page.evaluate(() => localStorage.getItem('save-start'))).toBe('Flows');
  684 | 		expect(await page.evaluate(() => localStorage.getItem('save-suggestion'))).toBe(
  685 | 			'First save.json'
  686 | 		);
  687 | 		expect(await page.evaluate(() => localStorage.getItem('save-activation'))).toBe('true');
  688 | 		await page.getByPlaceholder('type here', { exact: true }).fill('Later edit');
  689 | 		await expect(page.locator('.save-status')).toHaveText('Saved');
  690 | 		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
  691 | 		await expect(page.locator('.save-status')).toHaveText('Saved');
  692 | 		expect(await page.evaluate(() => localStorage.getItem('save-count'))).toBe('3');
  693 | 		await closeFlow(page);
  694 | 		await lib(page).getByRole('button', { name: 'preflows', exact: true }).click();
  695 | 		await expect(row(page, 'Chosen name.json')).toBeVisible();
  696 | 		await open(page, 'Chosen name.json');
  697 | 		await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue('Later edit');
  698 | 		await closeFlow(page);
  699 | 		await row(page, 'Chosen name.json').getByRole('button', { name: 'Duplicate' }).click();
  700 | 		await expect(title(page)).toHaveValue('Chosen name copy');
  701 | 		expect(await page.evaluate(() => localStorage.getItem('save-count'))).toBe('3');
  702 | 		await page.evaluate(() => localStorage.setItem('save-as-path', 'preflows/Copy chosen.json'));
  703 | 		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
  704 | 		await expect(page.locator('.save-status')).toHaveText('Saved');
  705 | 		expect(await page.evaluate(() => localStorage.getItem('save-start'))).toBe('preflows');
  706 | 		expect(await page.evaluate(() => localStorage.getItem('save-count'))).toBe('4');
  707 | 		await page.getByPlaceholder('type here', { exact: true }).fill('Independent copy');
  708 | 		await expect(page.locator('.save-status')).toHaveText('Saved');
  709 | 		await closeFlow(page);
  710 | 		await open(page, 'Chosen name.json');
  711 | 		await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue('Later edit');
  712 | 	}
  713 | );
  714 | 
  715 | nativeTest(
  716 | 	'saved flows autosave argument and page-title typing without blur or another Save',
  717 | 	async ({ page }) => {
  718 | 		await nativeFolder(page);
  719 | 		await title(page).fill('Autosave round');
  720 | 		await page.getByRole('button', { name: 'New flow', exact: true }).click();
  721 | 		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
  722 | 		await expect(page.locator('.save-status')).toHaveText('Saved');
  723 | 		const filename = 'Autosave round.json';
  724 | 		const argument = page.getByPlaceholder('type here', { exact: true });
  725 | 		const readArgument = async () => {
  726 | 			const saved = await disk(page, filename);
  727 | 			const flow = saved.nodes[saved.nodes.root.children[0]];
  728 | 			return saved.nodes[flow.children[0]].value.content;
  729 | 		};
  730 | 		await argument.fill('Typed without leaving the argument');
  731 | 		await expect(page.locator('.save-status')).toBeVisible();
  732 | 		await expect(page.locator('.save-status')).toHaveText('Autosaving…');
  733 | 		await expect.poll(readArgument).toBe('Typed without leaving the argument');
  734 | 		await expect(page.locator('.save-status')).toHaveText('Saved');
  735 | 		await expect(argument).toBeFocused();
  736 | 		await argument.press('End');
  737 | 		await argument.pressSequentially(' and kept typing');
  738 | 		await expect.poll(readArgument).toBe('Typed without leaving the argument and kept typing');
  739 | 		await expect(argument).toBeFocused();
  740 | 		const pageTitle = page.getByPlaceholder('type name here');
  741 | 		await pageTitle.fill('Renamed page without blur');
  742 | 		await expect
  743 | 			.poll(async () => {
  744 | 				const saved = await disk(page, filename);
  745 | 				return saved.nodes[saved.nodes.root.children[0]].value.content;
  746 | 			})
  747 | 			.toBe('Renamed page without blur');
  748 | 		await expect(pageTitle).toBeFocused();
  749 | 		await argument.fill('Explicit save stays in this file');
  750 | 		await argument.press('Control+s');
  751 | 		await expect.poll(readArgument).toBe('Explicit save stays in this file');
  752 | 		expect(await page.evaluate(() => localStorage.getItem('save-count'))).toBe('1');
```