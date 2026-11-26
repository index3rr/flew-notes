# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: groupReply.spec.ts >> group replies synchronize and undo on a connected peer
- Location: tests/groupReply.spec.ts:526:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 1
Received:   37

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import { peer, connect } from './helpers/collaboration';
  3   | 
  4   | const cells = (page: Page) => page.locator('.flow .box textarea');
  5   | 
  6   | async function argument(page: Page, text: string) {
  7   | 	const all = cells(page);
  8   | 	for (let i = 0; i < (await all.count()); i++) {
  9   | 		if ((await all.nth(i).inputValue()) === text) return all.nth(i);
  10  | 	}
  11  | 	throw new Error(`Missing argument: ${text}`);
  12  | }
  13  | 
  14  | async function expectResponseEndpoint(page: Page, text: string) {
  15  | 	const response = await argument(page, text);
  16  | 	const endpoint = await response.evaluate((element) => {
  17  | 		const text = element.closest('.text')!;
  18  | 		const rect = text.getBoundingClientRect();
  19  | 		const origin = document.querySelector('.groupReplies')!.getBoundingClientRect();
  20  | 		return {
  21  | 			x: rect.left + parseFloat(getComputedStyle(text).paddingLeft) - origin.left,
  22  | 			y: rect.bottom - origin.top
  23  | 		};
  24  | 	});
  25  | 	await expect
  26  | 		.poll(() =>
  27  | 			page.locator('.groupReplies path').evaluate((element, endpoint) => {
  28  | 				const path = element as SVGPathElement;
  29  | 				const end = path.getPointAtLength(path.getTotalLength());
  30  | 				return Math.hypot(end.x - endpoint.x, end.y - endpoint.y);
  31  | 			}, endpoint)
  32  | 		)
> 33  | 		.toBeLessThan(1);
      |    ^ Error: expect(received).toBeLessThan(expected)
  34  | }
  35  | 
  36  | async function expectCurveColor(page: Page) {
  37  | 	await expect
  38  | 		.poll(() =>
  39  | 			page.locator('.groupReplies path').evaluate((curve) => {
  40  | 				const line = curve.closest('.line.below')!;
  41  | 				return getComputedStyle(curve).stroke === getComputedStyle(line).backgroundColor;
  42  | 			})
  43  | 		)
  44  | 		.toBe(true);
  45  | }
  46  | 
  47  | async function setup(page: Page, invert = false) {
  48  | 	await page.addInitScript(() =>
  49  | 		localStorage.setItem(
  50  | 			'settings',
  51  | 			JSON.stringify({
  52  | 				version: 1,
  53  | 				isSettings: true,
  54  | 				settings: { telemetry: 0, transitionSpeed: 0 }
  55  | 			})
  56  | 		)
  57  | 	);
  58  | 	await page.goto('/app');
  59  | 	const flowId = 'flow-a';
  60  | 	const data = {
  61  | 		version: 1,
  62  | 		title: 'Group replies',
  63  | 		nodes: {
  64  | 			root: { value: { tag: 'root' }, parent: null, level: -1, children: [flowId] },
  65  | 			[flowId]: {
  66  | 				value: { tag: 'flow', content: 'aff', invert, columns: ['AC', 'NC', 'AR'] },
  67  | 				parent: 'root',
  68  | 				level: 0,
  69  | 				children: ['box-a', 'box-b', 'box-c']
  70  | 			},
  71  | 			'box-a': {
  72  | 				value: { tag: 'box', flowId, content: 'First card' },
  73  | 				parent: flowId,
  74  | 				level: 1,
  75  | 				children: ['box-r']
  76  | 			},
  77  | 			'box-r': {
  78  | 				value: { tag: 'box', flowId, content: 'Existing response' },
  79  | 				parent: 'box-a',
  80  | 				level: 2,
  81  | 				children: []
  82  | 			},
  83  | 			'box-b': {
  84  | 				value: { tag: 'box', flowId, content: 'Second card' },
  85  | 				parent: flowId,
  86  | 				level: 1,
  87  | 				children: []
  88  | 			},
  89  | 			'box-c': {
  90  | 				value: { tag: 'box', flowId, content: 'Third card' },
  91  | 				parent: flowId,
  92  | 				level: 1,
  93  | 				children: []
  94  | 			}
  95  | 		}
  96  | 	};
  97  | 	await page.locator('#uploadId').setInputFiles({
  98  | 		name: 'Group replies.json',
  99  | 		mimeType: 'application/json',
  100 | 		buffer: Buffer.from(JSON.stringify(data))
  101 | 	});
  102 | 	await expect(cells(page)).toHaveCount(4);
  103 | 	return data;
  104 | }
  105 | 
  106 | async function selectCards(page: Page) {
  107 | 	await (await argument(page, 'First card')).click();
  108 | 	await (await argument(page, 'Third card')).click({ modifiers: ['Shift'] });
  109 | 	await expect(page.locator('.flow .box.selected')).toHaveCount(3);
  110 | }
  111 | 
  112 | async function savedReply(page: Page) {
  113 | 	return page.evaluate(() => {
  114 | 		const key = Object.keys(localStorage).find((key) => key.startsWith('flow:'));
  115 | 		if (!key) return null;
  116 | 		const data: { nodes: Record<string, { value: { content: string; respondsTo?: string[] } }> } =
  117 | 			JSON.parse(localStorage.getItem(key)!);
  118 | 		return Object.values(data.nodes).find((node) => node.value.respondsTo);
  119 | 	});
  120 | }
  121 | 
  122 | async function savedNodes(page: Page) {
  123 | 	return page.evaluate(() => {
  124 | 		const key = Object.keys(localStorage).find((key) => key.startsWith('flow:'));
  125 | 		return key ? JSON.parse(localStorage.getItem(key)!).nodes : null;
  126 | 	});
  127 | }
  128 | 
  129 | async function compactGroup(page: Page) {
  130 | 	await expect
  131 | 		.poll(async () => {
  132 | 			const first = await (await argument(page, 'First card')).boundingBox();
  133 | 			const second = await (await argument(page, 'Second card')).boundingBox();
```