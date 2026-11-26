# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cardMirror.spec.ts >> companion plugin exchanges real WebRTC messages with Flew, persists sources and reconnects
- Location: tests/cardMirror.spec.ts:136:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByLabel('CardMirror card', { exact: true })
Expected: 1
Received: 3
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" getByLabel('CardMirror card', { exact: true }) with timeout 5000ms
  - waiting for getByLabel('CardMirror card', { exact: true })
    14 × locator resolved to 3 elements
       - unexpected value "3"

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
    - generic [ref=e72]:
      - textbox "type name here" [ref=e74]
      - tooltip [ref=e76]:
        - button [ref=e77]
    - generic [ref=e85]:
      - tooltip [ref=e86]:
        - button [ref=e87]
      - tooltip [ref=e91]:
        - button [disabled] [ref=e92]
      - tooltip [ref=e96]:
        - button [ref=e97]
      - tooltip [ref=e100]:
        - button [ref=e101]
      - tooltip [ref=e104]:
        - button [ref=e105]
      - tooltip [ref=e108]:
        - button "Delete selected cell" [ref=e109]
      - tooltip [ref=e113]:
        - button [ref=e114]
      - tooltip [ref=e118]:
        - button "Toggle starred argument" [ref=e119]
      - tooltip [ref=e122]:
        - button "Toggle crossed out" [ref=e123]
      - tooltip [ref=e127]:
        - button [ref=e128]
      - tooltip [ref=e132]:
        - button [disabled] [ref=e133]
    - generic [ref=e139]:
      - list [ref=e143]:
        - generic [ref=e144]:
          - generic [ref=e145]:
            - separator [ref=e146]
            - generic [ref=e147]:
              - generic "CardMirror card" [ref=e149]: card
              - textbox "type here" [ref=e150]: Climate policy
            - separator [ref=e151]
          - button [ref=e152]
          - list
        - generic [ref=e154]:
          - generic [ref=e155]:
            - separator [ref=e156]
            - generic [ref=e157]:
              - generic "CardMirror card" [ref=e159]: card
              - textbox [ref=e160]: Growth solves poverty 🌱 Author 2026
            - separator [ref=e161]
          - button [ref=e162]
          - list
        - generic [ref=e164]:
          - generic [ref=e165]:
            - separator [ref=e166]
            - generic [ref=e167]:
              - generic "CardMirror card" [ref=e169]: card
              - textbox [active] [ref=e170]: Prefer comparative evidence
            - separator [ref=e171]
          - button [ref=e172]
          - list
      - generic [ref=e174]:
        - generic [ref=e176]:
          - generic [ref=e177]: 1AC
          - button [ref=e179]
        - generic [ref=e182]:
          - generic [ref=e183]: 1NC
          - button [ref=e185]
        - generic [ref=e188]:
          - generic [ref=e189]: 2AC
          - button [ref=e191]
        - generic [ref=e194]:
          - generic [ref=e195]: 2NC/1NR
          - button [ref=e197]
        - generic [ref=e200]:
          - generic [ref=e201]: 1AR
          - button [ref=e203]
        - generic [ref=e206]:
          - generic [ref=e207]: 2NR
          - button [ref=e209]
        - generic [ref=e212]:
          - generic [ref=e213]: 2AR
          - button [ref=e215]
    - generic [ref=e218]:
      - region "Coverage" [ref=e221]:
        - generic [ref=e222]:
          - tooltip [ref=e223]:
            - heading "Coverage1NC · 3 open" [level=2] [ref=e224]
          - tooltip [ref=e226]:
            - button "Coverage menu" [ref=e227]
        - generic [ref=e232]:
          - button "1AC" [ref=e233]
          - button "1NC" [pressed] [ref=e234]
          - button "2AC" [ref=e235]
          - button "2NC/1NR" [ref=e236]
          - button "1AR" [ref=e237]
          - button "2NR" [ref=e238]
          - button "2AR" [ref=e239]
        - generic [ref=e241]:
          - button "no name 3 open" [ref=e243]:
            - text: no name
            - generic [ref=e244]: 3 open
          - generic [ref=e245]:
            - button "Climate policy" [ref=e246]
            - tooltip [ref=e248]:
              - button "Answer" [ref=e249]
          - generic [ref=e252]:
            - button "Growth solves poverty 🌱 Author 2026" [ref=e253]
            - tooltip [ref=e255]:
              - button "Answer" [ref=e256]
          - generic [ref=e259]:
            - button "Prefer comparative evidence" [ref=e260]
            - tooltip [ref=e262]:
              - button "Answer" [ref=e263]
      - region "CardMirror integration" [ref=e268]:
        - generic [ref=e269]:
          - tooltip [ref=e270]:
            - heading "CardMirror" [level=2] [ref=e271]
          - tooltip [ref=e273]:
            - button "CardMirror menu" [ref=e274]
        - button "Create connection key" [ref=e280]
        - generic [ref=e285]:
          - status [ref=e286]: Evidence — café
          - status [ref=e287]: Prefer comparative evidence
```

# Test source

```ts
  64  | 				return { ok: true };
  65  | 			},
  66  | 			showToast: (text) => w.toasts.push(text),
  67  | 			storage: {
  68  | 				get: (key) => storage.get(key),
  69  | 				set: (key, value) => {
  70  | 					storage.set(key, value);
  71  | 				}
  72  | 			},
  73  | 			settings: {
  74  | 				get: (key) =>
  75  | 					(storage.get('__settings') as Record<string, unknown> | undefined)?.[key] ??
  76  | 					(key === 'space' ? 0 : 'One cell per line')
  77  | 			}
  78  | 		};
  79  | 		w.__registerCardMirrorPlugin = (definition) => {
  80  | 			w.testDefinition = definition;
  81  | 		};
  82  | 	});
  83  | 	await page.addScriptTag({ url: '/integrations/cardmirror/plugin.js' });
  84  | }
  85  | async function pair(flew: Page, host: Page) {
  86  | 	await run(host, 'connect');
  87  | 	await flew.getByRole('button', { name: 'Create connection key', exact: true }).click();
  88  | 	const key = flew.getByRole('textbox', { name: 'Flew connection key', exact: true });
  89  | 	await expect(key).toHaveValue(/^FLEWCM1\./, { timeout: 15_000 });
  90  | 	await host
  91  | 		.getByRole('textbox', { name: 'Flew connection key', exact: true })
  92  | 		.fill(await key.inputValue());
  93  | 	await host.getByRole('button', { name: 'Create reply key', exact: true }).click();
  94  | 	const answer = host.getByRole('textbox', { name: 'CardMirror reply key', exact: true });
  95  | 	await expect(answer).toHaveValue(/^FLEWCM1\./, { timeout: 15_000 });
  96  | 	const mismatched = JSON.parse(
  97  | 		Buffer.from((await answer.inputValue()).slice('FLEWCM1.'.length), 'base64').toString()
  98  | 	);
  99  | 	mismatched.session = 'different-pairing';
  100 | 	await flew
  101 | 		.getByRole('textbox', { name: 'CardMirror reply key', exact: true })
  102 | 		.fill('FLEWCM1.' + Buffer.from(JSON.stringify(mismatched)).toString('base64'));
  103 | 	await flew.getByRole('button', { name: 'Connect CardMirror', exact: true }).click();
  104 | 	await expect(flew.getByRole('alert')).toContainText('different connection');
  105 | 	await flew
  106 | 		.getByRole('textbox', { name: 'CardMirror reply key', exact: true })
  107 | 		.fill(await answer.inputValue());
  108 | 	await flew.getByRole('button', { name: 'Connect CardMirror', exact: true }).click();
  109 | 	await expect(flew.getByText('connected', { exact: true })).toBeVisible({
  110 | 		timeout: 20_000
  111 | 	});
  112 | 	await host.getByRole('button', { name: 'Done', exact: true }).click();
  113 | }
  114 | async function configure(page: Page, position = 2, extra: Record<string, number | boolean> = {}) {
  115 | 	await page.addInitScript(
  116 | 		({ position, extra }) =>
  117 | 			localStorage.setItem(
  118 | 				'settings',
  119 | 				JSON.stringify({
  120 | 					isSettings: true,
  121 | 					version: 2,
  122 | 					settings: {
  123 | 						telemetryTier: 0,
  124 | 						cardMirrorPanel: position,
  125 | 						...extra,
  126 | 						timersPanel: 0,
  127 | 						notesPanel: 0,
  128 | 						collaborationPanel: 0
  129 | 					}
  130 | 				})
  131 | 			),
  132 | 		{ position, extra }
  133 | 	);
  134 | }
  135 | 
  136 | test('companion plugin exchanges real WebRTC messages with Flew, persists sources and reconnects', async ({
  137 | 	page,
  138 | 	browser,
  139 | 	baseURL
  140 | }, testInfo) => {
  141 | 	test.setTimeout(120_000);
  142 | 	const errors: string[] = [];
  143 | 	page.on('pageerror', (error) => errors.push(error.message));
  144 | 	await configure(page);
  145 | 	await page.goto('/app');
  146 | 	await expect(page.locator('[data-panel="cardMirrorPanel"]')).toContainText('CardMirror');
  147 | 	await expect(page.getByRole('button', { name: 'Create connection key' })).toBeVisible();
  148 | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  149 | 	const context = await browser.newContext({ baseURL });
  150 | 	const host = await context.newPage();
  151 | 	try {
  152 | 		await mockHost(host);
  153 | 		await run(host, 'send');
  154 | 		await expect
  155 | 			.poll(() => host.evaluate(() => (window as unknown as Host).toasts.at(-1)))
  156 | 			.toContain('Connect CardMirror');
  157 | 		await pair(page, host);
  158 | 		await run(host, 'sendColumn');
  159 | 		await expect
  160 | 			.poll(() => host.evaluate(() => (window as unknown as Host).toasts.at(-1)))
  161 | 			.toContain('Sent to Flew');
  162 | 		const cells = page.locator('.box textarea');
  163 | 		await expect(cells.first()).toHaveValue('Climate policy');
> 164 | 		await expect(page.getByLabel('CardMirror card', { exact: true })).toHaveCount(1);
      |                                                                     ^ Error: expect(locator).toHaveCount(expected) failed
  165 | 		await expect
  166 | 			.poll(() =>
  167 | 				cells.evaluateAll((elements) => elements.map((el) => (el as HTMLTextAreaElement).value))
  168 | 			)
  169 | 			.toEqual([
  170 | 				'Climate policy',
  171 | 				'Growth solves poverty 🌱\nAuthor 2026',
  172 | 				'Prefer comparative evidence'
  173 | 			]);
  174 | 		await run(host, 'reveal');
  175 | 		await expect(cells.nth(0)).toBeFocused();
  176 | 		await run(host, 'reveal');
  177 | 		await expect(cells.nth(1)).toBeFocused();
  178 | 		await expect(page.getByText('Evidence — café', { exact: true })).toHaveCount(1);
  179 | 		// Sources and connection controls must fit the sidebar in both themes.
  180 | 		const panel = page.locator('.cardmirror-panel');
  181 | 		await expect
  182 | 			.poll(() => panel.evaluate((el) => el.scrollWidth - el.clientWidth))
  183 | 			.toBeLessThanOrEqual(1);
  184 | 		for (const colorScheme of ['light', 'dark'] as const) {
  185 | 			await page.emulateMedia({ colorScheme });
  186 | 			await panel.screenshot({ path: testInfo.outputPath(`cardmirror-${colorScheme}.png`) });
  187 | 		}
  188 | 		await page.getByRole('button', { name: 'Jump to source', exact: true }).first().click();
  189 | 		await expect
  190 | 			.poll(() => host.evaluate(() => (window as unknown as Host).jumps))
  191 | 			.toEqual(['token:tag']);
  192 | 		// A whole received selection is one undo operation, and redo retains provenance.
  193 | 		await cells.nth(1).press('ControlOrMeta+z');
  194 | 		await expect(cells).toHaveCount(1);
  195 | 		await expect(cells.first()).toHaveValue('');
  196 | 		await cells.first().press('ControlOrMeta+Shift+z');
  197 | 		await expect(cells).toHaveCount(3);
  198 | 		await run(host, 'reveal');
  199 | 		await expect(cells.nth(2)).toBeFocused();
  200 | 		// Imported metadata is included by the normal autosave, not a parallel save path.
  201 | 		await expect
  202 | 			.poll(
  203 | 				() =>
  204 | 					page.evaluate(() =>
  205 | 						Object.keys(localStorage).some(
  206 | 							(key) => key.startsWith('flow:') && localStorage.getItem(key)?.includes('token:tag')
  207 | 						)
  208 | 					),
  209 | 				{ timeout: 12_000 }
  210 | 			)
  211 | 			.toBe(true);
  212 | 		await run(host, 'toggleMode');
  213 | 		await run(host, 'send');
  214 | 		await expect(cells).toHaveCount(4);
  215 | 		await expect(cells.last()).toHaveValue(
  216 | 			'Climate policy\nGrowth solves poverty 🌱\nAuthor 2026\nPrefer comparative evidence'
  217 | 		);
  218 | 		await page.getByRole('button', { name: 'CardMirror menu', exact: true }).click();
  219 | 		await page.getByRole('menuitem', { name: 'Disconnect', exact: true }).click();
  220 | 		await expect(
  221 | 			page.getByRole('button', { name: 'Create connection key', exact: true })
  222 | 		).toBeEnabled();
  223 | 		await pair(page, host);
  224 | 		await run(host, 'sendCell');
  225 | 		await expect(cells).toHaveCount(5);
  226 | 		await host.evaluate(() => {
  227 | 			const w = window as unknown as Host;
  228 | 			w.testApi.storage.set('__settings', { space: 2 });
  229 | 			w.selection = {
  230 | 				ok: true,
  231 | 				docId: 'doc',
  232 | 				docTitle: 'Evidence',
  233 | 				items: [{ kind: 'analytic', text: 'Spaced argument', source: 'spacing-token' }]
  234 | 			};
  235 | 		});
  236 | 		await run(host, 'send');
  237 | 		await expect(cells).toHaveCount(8);
  238 | 		await run(host, 'send');
  239 | 		await expect(cells).toHaveCount(11);
  240 | 		await expect(cells.nth(6)).toHaveValue('');
  241 | 		await expect(cells.nth(7)).toHaveValue('');
  242 | 		await expect(cells.nth(8)).toHaveValue('Spaced argument');
  243 | 		await page.getByPlaceholder('type name here', { exact: true }).fill('Aff destination');
  244 | 		await page.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
  245 | 		await run(host, 'choosePage');
  246 | 		await expect
  247 | 			.poll(() => host.evaluate(() => (window as unknown as Host).toasts.at(-1)))
  248 | 			.toBe('Flew destination: Aff destination.');
  249 | 		await expect(cells).toHaveCount(11);
  250 | 		await host.addScriptTag({ url: '/integrations/cardmirror/plugin.js' });
  251 | 		await expect(
  252 | 			page.getByRole('button', { name: 'Create connection key', exact: true })
  253 | 		).toBeEnabled();
  254 | 		await pair(page, host);
  255 | 		expect(errors).toEqual([]);
  256 | 	} finally {
  257 | 		await context.close();
  258 | 	}
  259 | });
  260 | 
  261 | test('collapsed panel stays connected; large selections are framed; no flow rejects sends', async ({
  262 | 	page,
  263 | 	browser,
  264 | 	baseURL
```