# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: persistancy.spec.ts >> flow library settings hide the bar and enforce the browser save limit
- Location: tests/persistancy.spec.ts:1137:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: 'Flow library setup', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('region', { name: 'Flow library setup', exact: true }) with timeout 5000ms
  - waiting for getByRole('region', { name: 'Flow library setup', exact: true })

```

```yaml
- main:
  - tooltip "Help":
    - button "Help":
      - img
  - tooltip:
    - button:
      - img
  - tooltip "Choose file":
    - button "Choose file":
      - img
  - tooltip:
    - button:
      - img
  - textbox "Flow document title":
    - /placeholder: new flow
  - tooltip "New flow":
    - button "New flow":
      - img
  - region "Flow pages":
    - tooltip "Tabs":
      - heading "Tabs" [level=2]
    - tooltip "Tabs menu":
      - button "Tabs menu":
        - img
    - tooltip "aff":
      - button "aff" [disabled]:
        - img
        - text: aff
    - tooltip "neg":
      - button "neg" [disabled]:
        - img
        - text: neg
  - tooltip "Timers":
    - button "Timers":
      - img
  - heading "Local flows" [level=1]
  - strong: Newest
  - time: 12:40 PM
  - tooltip "open":
    - button "open":
      - img
  - tooltip "duplicate":
    - button "duplicate":
      - img
  - tooltip "download":
    - button "download":
      - img
  - tooltip "delete":
    - button "delete":
      - img
  - strong: Middle
  - time: 12:40 PM
  - tooltip "open":
    - button "open":
      - img
  - tooltip "duplicate":
    - button "duplicate":
      - img
  - tooltip "download":
    - button "download":
      - img
  - tooltip "delete":
    - button "delete":
      - img
```

# Test source

```ts
  1075 | );
  1076 | 
  1077 | nativeTest(
  1078 | 	'browser library download opens Save As without a connected folder',
  1079 | 	async ({ page }) => {
  1080 | 		await page.addInitScript(() => {
  1081 | 			Object.defineProperty(window, 'showSaveFilePicker', {
  1082 | 				value: async (options: { suggestedName: string }) => {
  1083 | 					localStorage.setItem('download-save-name', options.suggestedName);
  1084 | 					if (localStorage.getItem('cancel-library-save'))
  1085 | 						throw new DOMException('Cancelled', 'AbortError');
  1086 | 					return (await navigator.storage.getDirectory()).getFileHandle('Library export.json', {
  1087 | 						create: true
  1088 | 					});
  1089 | 				}
  1090 | 			});
  1091 | 		});
  1092 | 		await page.goto('/app');
  1093 | 		await title(page).fill('Browser export');
  1094 | 		await page.getByRole('button', { name: 'New flow', exact: true }).click();
  1095 | 		await page.getByPlaceholder('type here', { exact: true }).fill('Saved library content');
  1096 | 		await closeFlow(page);
  1097 | 		const card = page
  1098 | 			.locator('.prelude .flow')
  1099 | 			.filter({ has: page.getByText('Browser export', { exact: true }) });
  1100 | 		await card.getByRole('button', { name: 'download', exact: true }).click();
  1101 | 		await expect
  1102 | 			.poll(() => page.evaluate(() => localStorage.getItem('download-save-name')))
  1103 | 			.toBe('Browser export.json');
  1104 | 		await expect
  1105 | 			.poll(() =>
  1106 | 				page.evaluate(async () => {
  1107 | 					try {
  1108 | 						return (
  1109 | 							await (
  1110 | 								await (await navigator.storage.getDirectory()).getFileHandle('Library export.json')
  1111 | 							).getFile()
  1112 | 						).text();
  1113 | 					} catch {
  1114 | 						return '';
  1115 | 					}
  1116 | 				})
  1117 | 			)
  1118 | 			.toContain('Saved library content');
  1119 | 		expect(
  1120 | 			await page.evaluate(
  1121 | 				async () =>
  1122 | 					JSON.parse(
  1123 | 						await (
  1124 | 							await (
  1125 | 								await (await navigator.storage.getDirectory()).getFileHandle('Library export.json')
  1126 | 							).getFile()
  1127 | 						).text()
  1128 | 					).title
  1129 | 			)
  1130 | 		).toBe('Library export');
  1131 | 		await page.evaluate(() => localStorage.setItem('cancel-library-save', 'true'));
  1132 | 		await card.getByRole('button', { name: 'download', exact: true }).click();
  1133 | 		await expect(page.getByRole('alert')).toHaveCount(0);
  1134 | 		await expect(card).toBeVisible();
  1135 | 	}
  1136 | );
  1137 | 
  1138 | test('flow library settings hide the bar and enforce the browser save limit', async ({ page }) => {
  1139 | 	await page.goto('/app');
  1140 | 	await page.locator('.header button').nth(1).click();
  1141 | 	const barSetting = page
  1142 | 		.locator('.settings > ul > div')
  1143 | 		.filter({ has: page.getByRole('heading', { name: 'Show flow library top bar', exact: true }) });
  1144 | 	const limitSetting = page
  1145 | 		.locator('.settings > ul > div')
  1146 | 		.filter({ has: page.getByRole('heading', { name: 'Maximum browser saves', exact: true }) });
  1147 | 	await barSetting.locator('label').click();
  1148 | 	await limitSetting.getByRole('spinbutton').fill('2');
  1149 | 	await page.keyboard.press('Escape');
  1150 | 	await expect(
  1151 | 		page.locator('.prelude').getByRole('region', { name: 'Flow library setup', exact: true })
  1152 | 	).toHaveCount(0);
  1153 | 	for (const name of ['Oldest', 'Middle', 'Newest']) {
  1154 | 		await title(page).fill(name);
  1155 | 		await page.getByRole('button', { name: 'New flow', exact: true }).click();
  1156 | 		await page.getByRole('button', { name: 'Close flow', exact: true }).click();
  1157 | 		await expect(title(page)).toHaveValue('');
  1158 | 	}
  1159 | 	const saved = await page.evaluate(() =>
  1160 | 		Object.entries(JSON.parse(localStorage.getItem('savedFlows')!)).map(([key, value]) => ({
  1161 | 			...(value as { title: string }),
  1162 | 			raw: localStorage.getItem(key)
  1163 | 		}))
  1164 | 	);
  1165 | 	expect(saved.map((item) => item.title).sort()).toEqual(['Middle', 'Newest']);
  1166 | 	expect(saved.every((item) => item.raw)).toBe(true);
  1167 | 	await page.reload();
  1168 | 	await expect(
  1169 | 		page.locator('.prelude').getByRole('region', { name: 'Flow library setup', exact: true })
  1170 | 	).toHaveCount(0);
  1171 | 	await page.locator('.header button').nth(1).click();
  1172 | 	await expect(limitSetting.getByRole('spinbutton')).toHaveValue('2');
  1173 | 	await barSetting.locator('label').click();
  1174 | 	await limitSetting.getByRole('spinbutton').fill('0');
> 1175 | 	await page.keyboard.press('Escape');
       |                                                                                      ^ Error: expect(locator).toBeVisible() failed
  1176 | 	await expect(page.getByRole('region', { name: 'Flow library setup', exact: true })).toBeVisible();
  1177 | 	await title(page).fill('Unlimited');
  1178 | 	await page.getByRole('button', { name: 'New flow', exact: true }).click();
  1179 | 	await closeFlow(page);
  1180 | 	await expect(page.locator('.prelude .flows .flow')).toHaveCount(3);
  1181 | });
  1182 | 
  1183 | nativeTest(
  1184 | 	'title commits rename linked files safely and autosave follows the new filename',
  1185 | 	async ({ page }) => {
  1186 | 		await nativeFolder(page);
  1187 | 		await title(page).fill('Initial');
  1188 | 		await page.getByRole('button', { name: 'New flow', exact: true }).click();
  1189 | 		await page.getByRole('button', { name: 'Save flow', exact: true }).click();
  1190 | 		await expect(page.locator('.save-status')).toHaveText('Saved');
  1191 | 		await title(page).fill('Renamed');
  1192 | 		await expect(page.locator('.save-status')).toHaveText('Saved');
  1193 | 		expect(await diskNames(page)).toContain('Initial.json');
  1194 | 		expect(await diskNames(page)).not.toContain('Renamed.json');
  1195 | 		await title(page).press('Enter');
  1196 | 		await expect.poll(() => diskNames(page)).toContain('Renamed.json');
  1197 | 		await expect.poll(() => diskNames(page)).not.toContain('Initial.json');
  1198 | 		await page.getByPlaceholder('type here', { exact: true }).fill('Edits follow the rename');
  1199 | 		await expect
  1200 | 			.poll(async () => {
  1201 | 				try {
  1202 | 					return JSON.stringify(await disk(page, 'Renamed.json'));
  1203 | 				} catch {
  1204 | 					return '';
  1205 | 				}
  1206 | 			})
  1207 | 			.toContain('Edits follow the rename');
  1208 | 		await page.evaluate(async (data) => {
  1209 | 			const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Flows');
  1210 | 			const stream = await (
  1211 | 				await dir.getFileHandle('Occupied.json', { create: true })
  1212 | 			).createWritable();
  1213 | 			await stream.write(JSON.stringify(data));
  1214 | 			await stream.close();
  1215 | 		}, round);
  1216 | 		await title(page).fill('Occupied');
  1217 | 		await page.getByPlaceholder('type here', { exact: true }).click();
  1218 | 		await expect.poll(() => diskNames(page)).toContain('Occupied (2).json');
  1219 | 		await expect.poll(() => diskNames(page)).not.toContain('Renamed.json');
  1220 | 		expect(await disk(page, 'Occupied.json')).toEqual(round);
  1221 | 		await title(page).fill('CON');
  1222 | 		await title(page).press('Enter');
  1223 | 		await expect.poll(() => diskNames(page)).toContain('_CON.json');
  1224 | 		await expect.poll(() => diskNames(page)).not.toContain('Occupied (2).json');
  1225 | 		await closeFlow(page);
  1226 | 		await open(page, '_CON.json');
  1227 | 		await expect(title(page)).toHaveValue('CON');
  1228 | 		await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
  1229 | 			'Edits follow the rename'
  1230 | 		);
  1231 | 	}
  1232 | );
  1233 | 
  1234 | nativeTest(
  1235 | 	'failed title renames preserve the original disk file and browser recovery',
  1236 | 	async ({ page }) => {
  1237 | 		await nativeFolder(page);
  1238 | 		await open(page, 'Round.json');
  1239 | 		await page.evaluate(() => {
  1240 | 			const original = FileSystemFileHandle.prototype.createWritable;
  1241 | 			FileSystemFileHandle.prototype.createWritable = async function (...args) {
  1242 | 				if (this.name === 'Failed rename.json')
  1243 | 					throw new DOMException('Write failed', 'NotAllowedError');
  1244 | 				return original.apply(this, args);
  1245 | 			};
  1246 | 		});
  1247 | 		await title(page).fill('Failed rename');
  1248 | 		await title(page).press('Enter');
  1249 | 		await expect(page.locator('.save-status')).toContainText('Write failed');
  1250 | 		expect(await disk(page, 'Round.json')).toEqual(round);
  1251 | 		expect(
  1252 | 			await page.evaluate(() =>
  1253 | 				Object.keys(JSON.parse(localStorage.getItem('savedFlows')!))
  1254 | 					.map((key) => localStorage.getItem(key))
  1255 | 					.join('')
  1256 | 			)
  1257 | 		).toContain('Failed rename');
  1258 | 	}
  1259 | );
  1260 | 
  1261 | test('Choose file replaces Save with no open document and imports normally without a linked folder', async ({
  1262 | 	page
  1263 | }) => {
  1264 | 	await page.goto('/app');
  1265 | 	const choose = page.getByRole('button', { name: 'Choose file', exact: true });
  1266 | 	await expect(choose).toBeEnabled();
  1267 | 	await expect(page.getByRole('button', { name: 'Save flow', exact: true })).toHaveCount(0);
  1268 | 	const picker = page.waitForEvent('filechooser');
  1269 | 	await choose.click();
  1270 | 	await (await picker).setFiles(path.join(fixtures, 'Round.json'));
  1271 | 	await expect(title(page)).toHaveValue('Round');
  1272 | 	await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
  1273 | 		'Original argument'
  1274 | 	);
  1275 | 	await expect(page.getByRole('button', { name: 'Save flow', exact: true })).toBeEnabled();
```