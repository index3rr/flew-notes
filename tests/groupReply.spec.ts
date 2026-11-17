import { test, expect, type Page } from '@playwright/test';
import { peer, connect } from './helpers/collaboration';

const cells = (page: Page) => page.locator('.flow .box textarea');

async function argument(page: Page, text: string) {
	const all = cells(page);
	for (let i = 0; i < (await all.count()); i++) {
		if ((await all.nth(i).inputValue()) === text) return all.nth(i);
	}
	throw new Error(`Missing argument: ${text}`);
}

async function expectResponseEndpoint(page: Page, text: string) {
	const response = await argument(page, text);
	const endpoint = await response.evaluate((element) => {
		const text = element.closest('.text')!;
		const rect = text.getBoundingClientRect();
		const origin = document.querySelector('.groupReplies')!.getBoundingClientRect();
		return {
			x: rect.left + parseFloat(getComputedStyle(text).paddingLeft) - origin.left,
			y: rect.bottom - origin.top
		};
	});
	await expect
		.poll(() =>
			page.locator('.groupReplies path').evaluate((element, endpoint) => {
				const path = element as SVGPathElement;
				const end = path.getPointAtLength(path.getTotalLength());
				return Math.hypot(end.x - endpoint.x, end.y - endpoint.y);
			}, endpoint)
		)
		.toBeLessThan(1);
}

async function expectCurveColor(page: Page) {
	await expect
		.poll(() =>
			page.locator('.groupReplies path').evaluate((curve) => {
				const line = curve.closest('.line.below')!;
				return getComputedStyle(curve).stroke === getComputedStyle(line).backgroundColor;
			})
		)
		.toBe(true);
}

async function setup(page: Page, invert = false) {
	await page.addInitScript(() =>
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 1,
				isSettings: true,
				settings: { telemetry: 0, transitionSpeed: 0 }
			})
		)
	);
	await page.goto('/app');
	const flowId = 'flow-a';
	const data = {
		version: 1,
		title: 'Group replies',
		nodes: {
			root: { value: { tag: 'root' }, parent: null, level: -1, children: [flowId] },
			[flowId]: {
				value: { tag: 'flow', content: 'aff', invert, columns: ['AC', 'NC', 'AR'] },
				parent: 'root',
				level: 0,
				children: ['box-a', 'box-b', 'box-c']
			},
			'box-a': {
				value: { tag: 'box', flowId, content: 'First card' },
				parent: flowId,
				level: 1,
				children: ['box-r']
			},
			'box-r': {
				value: { tag: 'box', flowId, content: 'Existing response' },
				parent: 'box-a',
				level: 2,
				children: []
			},
			'box-b': {
				value: { tag: 'box', flowId, content: 'Second card' },
				parent: flowId,
				level: 1,
				children: []
			},
			'box-c': {
				value: { tag: 'box', flowId, content: 'Third card' },
				parent: flowId,
				level: 1,
				children: []
			}
		}
	};
	await page.locator('#uploadId').setInputFiles({
		name: 'Group replies.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(data))
	});
	await expect(cells(page)).toHaveCount(4);
	return data;
}

async function selectCards(page: Page) {
	await (await argument(page, 'First card')).click();
	await (await argument(page, 'Third card')).click({ modifiers: ['Shift'] });
	await expect(page.locator('.flow .box.selected')).toHaveCount(4);
}

async function savedReply(page: Page) {
	return page.evaluate(() => {
		const key = Object.keys(localStorage).find((key) => key.startsWith('flow:'));
		if (!key) return null;
		const data: { nodes: Record<string, { value: { content: string; respondsTo?: string[] } }> } =
			JSON.parse(localStorage.getItem(key)!);
		return Object.values(data.nodes).find((node) => node.value.respondsTo);
	});
}

async function savedNodes(page: Page) {
	return page.evaluate(() => {
		const key = Object.keys(localStorage).find((key) => key.startsWith('flow:'));
		return key ? JSON.parse(localStorage.getItem(key)!).nodes : null;
	});
}

async function compactGroup(page: Page) {
	await expect
		.poll(async () => {
			const first = await (await argument(page, 'First card')).boundingBox();
			const second = await (await argument(page, 'Second card')).boundingBox();
			const third = await (await argument(page, 'Third card')).boundingBox();
			if (!first || !second || !third) return Infinity;
			const padding = await page.evaluate(() =>
				parseFloat(getComputedStyle(document.body).getPropertyValue('--padding'))
			);
			return Math.max(
				Math.abs(second.y - first.y - first.height - padding * 2),
				Math.abs(third.y - second.y - second.height - padding * 2)
			);
		})
		.toBeLessThan(1);
}

test('grouping collects every response branch, merges extensions, and keeps source cards compact', async ({
	page
}) => {
	test.setTimeout(60000);
	await setup(page);
	await (await argument(page, 'Third card')).press('Enter');
	await page.keyboard.type('Outside group');
	await (await argument(page, 'Second card')).press('Shift+Enter');
	await page.keyboard.type('Second response');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Second sibling response');
	await page.keyboard.press('Shift+Enter');
	await page.keyboard.type('Deep second response');
	await (await argument(page, 'Third card')).press('Control+e');
	await page.keyboard.type('Third extension response');
	await (await argument(page, 'First card')).press('Control+e');
	await page.keyboard.type('First extension response');
	await page.getByPlaceholder('type name here', { exact: true }).click();
	await expect(page.locator('.save-status')).toHaveText(/Saved/);
	const before = await savedNodes(page);
	const firstExtension = before['box-a'].children[0];
	const redundantExtension = before['box-c'].children[0];
	const responseId = before['box-b'].children[0];
	await (await argument(page, 'First card')).click();
	await (await argument(page, 'Third card')).click({ modifiers: ['Shift'] });
	await page.keyboard.press('Shift+Enter');
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
	await compactGroup(page);
	await expect.poll(async () => (await savedNodes(page))?.['box-b'].children).toEqual([]);
	const grouped = await savedNodes(page);
	expect(grouped['box-c'].children).toEqual([]);
	expect(grouped[responseId].parent).toBe('box-a');
	for (const id of before['box-b'].children) expect(grouped[id].parent).toBe('box-a');
	expect(grouped[firstExtension].children).toHaveLength(2);
	expect(grouped[redundantExtension]).toBeUndefined();
	await expectResponseEndpoint(page, 'Second sibling response');
	const outside = await (await argument(page, 'Outside group')).boundingBox();
	const stackBottom = await (
		await argument(page, 'First card')
	).evaluate(
		(element) =>
			element.closest('.box')!.querySelector(':scope > .children')!.getBoundingClientRect().bottom
	);
	expect(outside!.y).toBeGreaterThanOrEqual(stackBottom - 1);
	await page.keyboard.press('Control+z');
	await expect(page.locator('.groupReplies path')).toHaveCount(0);
	await expect.poll(() => savedNodes(page)).toEqual(before);
	await page.keyboard.press('Control+Shift+z');
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
	await compactGroup(page);
	await expect(page.locator('.save-status')).toHaveText(/Saved/);
	await page.reload();
	await page
		.locator('.prelude .flow')
		.filter({ has: page.getByText(/^Group replies$/) })
		.getByRole('button', { name: 'open', exact: true })
		.click();
	await compactGroup(page);
	await expect(await argument(page, 'Deep second response')).toBeVisible();
	await expect(await argument(page, 'First extension response')).toBeVisible();
	await expect(await argument(page, 'Third extension response')).toBeVisible();
});

test('Right Arrow on any grouped argument enters the shared first response, including a folded group', async ({
	page
}) => {
	await setup(page);
	await selectCards(page);
	await page.keyboard.press('Shift+Enter');
	await page.keyboard.type('Group response');
	await compactGroup(page);
	for (const text of ['First card', 'Second card', 'Third card']) {
		await (await argument(page, text)).press('ArrowRight');
		await expect(await argument(page, 'Group response')).toBeFocused();
	}
	await (await argument(page, 'First card')).press('Control+l');
	await (await argument(page, 'Third card')).press('ArrowRight');
	await expect(await argument(page, 'Group response')).toBeFocused();
	await expect(await argument(page, 'Group response')).toBeVisible();
});

test('group reply via Shift+Enter survives undo, deletion and JSON reopen', async ({ page }) => {
	await setup(page);
	await selectCards(page);
	await page.keyboard.press('Shift+Enter');
	await expect(cells(page)).toHaveCount(5);
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
	await expect(page.locator('.box.selected')).toHaveCount(0);
	await page.keyboard.press('Control+z');
	await expect(cells(page)).toHaveCount(4);
	await expect(page.locator('.groupReplies path')).toHaveCount(0);
	await page.keyboard.press('Control+Shift+z');
	await expect(cells(page)).toHaveCount(5);
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
	await page.keyboard.type('One response to all');
	await page.getByPlaceholder('type name here', { exact: true }).click();
	await expect
		.poll(async () => (await savedReply(page))?.value.content)
		.toBe('One response to all');
	expect((await savedReply(page))?.value.respondsTo).toEqual(['box-b', 'box-c']);
	await (await argument(page, 'Second card')).click();
	await page.keyboard.press('Control+Backspace');
	await expect(cells(page)).toHaveCount(4);
	await page.keyboard.press('Control+z');
	await expect(cells(page)).toHaveCount(5);
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
	await page.getByPlaceholder('type name here', { exact: true }).click();
	await page.reload();
	await page
		.locator('.prelude .flow')
		.filter({ has: page.getByText(/^Group replies$/) })
		.getByRole('button', { name: 'open', exact: true })
		.click();
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
	await expect(await argument(page, 'One response to all')).toBeVisible();
	// Resizing a card must move its connector; folding must hide a reply's connectors.
	const path = page.locator('.groupReplies path');
	const before = await path.getAttribute('d');
	await (await argument(page, 'Second card')).fill('Second card\nwith several\nextra lines');
	await expect.poll(() => path.getAttribute('d')).not.toBe(before);
	await (await argument(page, 'First card')).click();
	await page.keyboard.press('Control+l');
	await expect(path).toHaveCount(0);
	await page.keyboard.press('Control+l');
	await expect(path).toHaveCount(1);
});

test('toolbar groups selected cards on an inverted flow and keeps the reply editable', async ({
	page
}) => {
	await setup(page, true);
	await selectCards(page);
	await page.locator('.box-control button').nth(2).click();
	await expect(cells(page)).toHaveCount(5);
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
	await expectCurveColor(page);
	await page.keyboard.type('Toolbar reply');
	await expect(await argument(page, 'Toolbar reply')).toBeFocused();
});

test('grouped cards hide the right plus and add responses to their existing group', async ({
	page
}) => {
	test.setTimeout(60000);
	await setup(page);
	const hasRightPlus = async (text: string) =>
		(await argument(page, text)).evaluate(
			(element) => !!element.closest('.box')?.querySelector(':scope > .content > button.add')
		);
	expect(await hasRightPlus('Second card')).toBe(true);
	await selectCards(page);
	await page.keyboard.press('Shift+Enter');
	await expect(cells(page)).toHaveCount(5);
	await page.keyboard.press('Control+z');
	await expect(cells(page)).toHaveCount(4);
	expect(await hasRightPlus('Second card')).toBe(true);
	await page.keyboard.press('Control+Shift+z');
	await expect(cells(page)).toHaveCount(5);
	await page.keyboard.type('Group response');
	let count = 5;
	for (const text of ['First card', 'Second card', 'Third card']) {
		expect(await hasRightPlus(text)).toBe(false);
		await (await argument(page, text)).press('Shift+Enter');
		await expect(cells(page)).toHaveCount(++count);
		await page.keyboard.type(`Response from ${text}`);
		await expectResponseEndpoint(page, `Response from ${text}`);
		await expect(page.locator('.groupReplies path')).toHaveCount(1);
	}
	// Selecting the same group again appends a response rather than creating a second group.
	await (await argument(page, 'First card')).click();
	await (await argument(page, 'Third card')).click({ modifiers: ['Shift'] });
	await page.keyboard.press('Shift+Enter');
	await expect(cells(page)).toHaveCount(++count);
	await page.keyboard.type('Reselected group response');
	await expect(page.locator('.groupReplies path')).toHaveCount(1);
	await expectResponseEndpoint(page, 'Reselected group response');
	await (await argument(page, 'Third card')).click();
	await page.locator('.box-control button').nth(2).click();
	await expect(cells(page)).toHaveCount(++count);
	await page.keyboard.type('Toolbar group response');
	await expectResponseEndpoint(page, 'Toolbar group response');
	await (await argument(page, 'First card')).click();
	await page.keyboard.press('Control+z');
	await page.keyboard.press('Control+z');
	await expect(cells(page)).toHaveCount(count - 1);
	await expectResponseEndpoint(page, 'Reselected group response');
	await page.keyboard.press('Control+Shift+z');
	await page.keyboard.press('Control+Shift+z');
	await expect(cells(page)).toHaveCount(count);
	await expectResponseEndpoint(page, 'Toolbar group response');
	await page.getByPlaceholder('type name here', { exact: true }).click();
	await expect(page.locator('.save-status')).toHaveText(/Saved/);
	await page.reload();
	await page
		.locator('.prelude .flow')
		.filter({ has: page.getByText(/^Group replies$/) })
		.getByRole('button', { name: 'open', exact: true })
		.click();
	await expect(cells(page)).toHaveCount(count);
	expect(await hasRightPlus('Second card')).toBe(false);
	await (await argument(page, 'Second card')).press('Shift+Enter');
	await expect(cells(page)).toHaveCount(count + 1);
	await page.keyboard.type('Response after reopening');
	await expectResponseEndpoint(page, 'Response after reopening');
	// A response still has its normal next-speech affordance.
	expect(await hasRightPlus('Response after reopening')).toBe(true);
});

test('connections follow animated insertion and responses stop at the last column', async ({
	page
}) => {
	await setup(page);
	await selectCards(page);
	await page.keyboard.press('Shift+Enter');
	await page.keyboard.type('Group response');
	await page.locator('#uploadId').setInputFiles({
		name: 'Motion.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({ version: 1, isSettings: true, settings: { transitionSpeed: 200 } })
		)
	});
	await (await argument(page, 'First card')).click();
	await page.keyboard.press('Alt+Enter');
	await expect(cells(page)).toHaveCount(6);
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document.getAnimations().filter((animation) => animation.playState === 'running').length
			)
		)
		.toBe(0);
	const bottom = await argument(page, 'Third card');
	const bottomY = await bottom.evaluate((element) => {
		const text = element.closest('.text')!.getBoundingClientRect();
		const origin = document.querySelector('.groupReplies')!.getBoundingClientRect();
		return text.bottom - origin.top;
	});
	await expect
		.poll(() =>
			page
				.locator('.groupReplies path')
				.evaluate(
					(path, bottomY) => Math.abs((path as SVGPathElement).getPointAtLength(0).y - bottomY),
					bottomY
				)
		)
		.toBeLessThan(1);
	await expectResponseEndpoint(page, 'Existing response');
	await (await argument(page, 'Group response')).click();
	await page.keyboard.press('Shift+Enter');
	await expect(cells(page)).toHaveCount(7);
	await page.keyboard.type('Final column');
	await page.keyboard.press('Shift+Enter');
	await expect(cells(page)).toHaveCount(7);
});

test('group curve attaches to the final response and follows addition, deletion and undo', async ({
	page
}) => {
	await setup(page);
	await selectCards(page);
	await page.keyboard.press('Shift+Enter');
	await page.keyboard.type('Group response');
	await expectResponseEndpoint(page, 'Existing response');
	await (await argument(page, 'Existing response')).press('Enter');
	await page.keyboard.type('Last response');
	await expect(cells(page)).toHaveCount(6);
	await expectResponseEndpoint(page, 'Last response');
	// Later speech columns are descendants, rather than responses in this group.
	await page.keyboard.press('Shift+Enter');
	await page.keyboard.type('Later speech');
	await expect(cells(page)).toHaveCount(7);
	await expectResponseEndpoint(page, 'Last response');
	await (await argument(page, 'Last response')).press('Control+Backspace');
	await expect(cells(page)).toHaveCount(5);
	await expectResponseEndpoint(page, 'Existing response');
	await page.keyboard.press('Control+z');
	await expect(cells(page)).toHaveCount(7);
	await expectResponseEndpoint(page, 'Last response');
});

test('group reply connections follow theme, spacing and line width settings', async ({
	page
}, testInfo) => {
	await setup(page);
	await selectCards(page);
	await page.keyboard.press('Shift+Enter');
	await page.keyboard.type('Grouped response');
	const path = page.locator('.groupReplies path');
	for (const colorTheme of [1, 2, 3]) {
		const settings = {
			colorTheme,
			transitionSpeed: 0,
			accentHue: 280,
			accentSecondaryHue: 145,
			padding: colorTheme === 3 ? 30 : 8,
			buttonSize: colorTheme === 3 ? 50 : 20,
			fontSize: colorTheme === 3 ? 1.5 : 0.9,
			borderRadius: colorTheme === 3 ? 30 : 8,
			fontWeight: colorTheme === 3 ? 700 : 300,
			lineWidth: colorTheme === 3 ? 8 : 4,
			customBackgroundAccentSecondaryIndent: '#ad33bf',
			customColorAccentSecondaryFade: '#1c8e68'
		};
		await page.locator('#uploadId').setInputFiles({
			name: 'Settings.json',
			mimeType: 'application/json',
			buffer: Buffer.from(JSON.stringify({ version: 1, isSettings: true, settings }))
		});
		await expect(path).toHaveCSS('stroke-width', colorTheme === 3 ? '8px' : '4px');
		await expectCurveColor(page);
		if (colorTheme === 3) await expect(path).toHaveCSS('stroke', 'rgb(173, 51, 191)');
		await expect.poll(() => path.getAttribute('d')).not.toContain('NaN');
		await page.screenshot({ path: testInfo.outputPath(`group-theme-${colorTheme}.png`) });
	}
});

for (const invert of [false, true]) {
	test(`curve color follows the attached response's focus, hover and transitions (invert: ${invert})`, async ({
		page
	}) => {
		await setup(page, invert);
		await selectCards(page);
		await page.keyboard.press('Shift+Enter');
		await page.keyboard.type('Group response');
		await page.mouse.move(0, 0);
		const path = page.locator('.groupReplies path');
		await expectCurveColor(page);
		const inactive = await path.evaluate((curve) => getComputedStyle(curve).stroke);
		const attached = await argument(page, 'Existing response');
		await attached.click();
		await page.mouse.move(0, 0);
		await expectCurveColor(page);
		await expect(path).not.toHaveCSS('stroke', inactive);
		await (await argument(page, 'Group response')).click();
		await page.mouse.move(0, 0);
		await expect(path).toHaveCSS('stroke', inactive);
		await attached.hover();
		await expectCurveColor(page);
		await expect(path).not.toHaveCSS('stroke', inactive);
		await page.mouse.move(0, 0);
		await expect(path).toHaveCSS('stroke', inactive);
		await attached.press('Shift+Enter');
		await page.keyboard.type('Later speech');
		await expectCurveColor(page);
		await expect(path).not.toHaveCSS('stroke', inactive);
		await page.locator('#uploadId').setInputFiles({
			name: 'Motion.json',
			mimeType: 'application/json',
			buffer: Buffer.from(
				JSON.stringify({ version: 1, isSettings: true, settings: { transitionSpeed: 250 } })
			)
		});
		const samples = await (
			await argument(page, 'Group response')
		).evaluate((input) => {
			input.focus();
			return new Promise<{ curve: string; line: string }[]>((resolve) => {
				const samples: { curve: string; line: string }[] = [];
				const sample = () => {
					const curve = document.querySelector('.groupReplies path')!;
					const line = curve.closest('.line.below')!;
					samples.push({
						curve: getComputedStyle(curve).stroke,
						line: getComputedStyle(line).backgroundColor
					});
					if (samples.length < 10) requestAnimationFrame(sample);
					else resolve(samples);
				};
				requestAnimationFrame(sample);
			});
		});
		expect(samples.every(({ curve, line }) => curve === line)).toBe(true);
		expect(new Set(samples.map(({ curve }) => curve)).size).toBeGreaterThan(1);
	});
}

test('group replies synchronize and undo on a connected peer', async ({ browser }) => {
	const host = await peer(browser);
	const guest = await peer(browser);
	try {
		await setup(host);
		await connect(host, guest);
		await selectCards(guest);
		await guest.keyboard.press('Shift+Enter');
		await expect(host.locator('.groupReplies path')).toHaveCount(1);
		await guest.keyboard.type('Shared group reply');
		await (await argument(guest, 'First card')).click();
		await expect
			.poll(async () =>
				cells(host).evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value))
			)
			.toContain('Shared group reply');
		await (await argument(guest, 'Third card')).press('Shift+Enter');
		await guest.keyboard.type('Shared additional response');
		await (await argument(guest, 'First card')).click();
		await expect
			.poll(async () =>
				cells(host).evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value))
			)
			.toContain('Shared additional response');
		await expectResponseEndpoint(host, 'Shared additional response');
		await guest.keyboard.press('Control+z');
		await guest.keyboard.press('Control+z');
		await expect(host.locator('.groupReplies path')).toHaveCount(1);
		await expectResponseEndpoint(host, 'Existing response');
		await guest.keyboard.press('Control+z');
		await guest.keyboard.press('Control+z');
		await expect(host.locator('.groupReplies path')).toHaveCount(0);
	} finally {
		await host.context().close();
		await guest.context().close();
	}
});

test('invalid cross-column response links fail import without replacing the document', async ({
	page
}) => {
	const data = await setup(page);
	Object.assign(data.nodes['box-r'].value, { respondsTo: ['box-r'] });
	await page.locator('#uploadId').setInputFiles({
		name: 'Bad.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(data))
	});
	await expect(page.locator('.popups')).toContainText('Invalid file');
	await expect(cells(page)).toHaveCount(4);
});

test('Extemp preset creates its two sides and speech timers', async ({ page }) => {
	await page.addInitScript(() =>
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 1,
				isSettings: true,
				settings: { debateStyle: 11, telemetry: 0 }
			})
		)
	);
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.flow .header .text')).toHaveText([
		'AC',
		'NC',
		'AR',
		'NR',
		'AS',
		'NS'
	]);
	await page.locator('.sidebar > .timer button').click();
	await expect(page.locator('.speeches .speech')).toHaveText([
		'AC',
		'NC',
		'CX',
		'AR',
		'NR',
		'AS',
		'NS'
	]);
	for (const [speech, minutes] of [
		['AC', '02'],
		['NC', '02'],
		['CX', '03'],
		['AR', '02'],
		['NR', '02'],
		['AS', '01'],
		['NS', '01']
	]) {
		await page.locator('.speeches').getByRole('button', { name: speech, exact: true }).click();
		await expect(page.locator('.time .minutes')).toHaveValue(minutes);
	}
	await page.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
	await expect(page.locator('.flow .header .text')).toHaveText(['NC', 'AR', 'NR', 'AS', 'NS']);
});
