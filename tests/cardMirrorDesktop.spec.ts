import { test, expect, _electron, chromium, firefox, webkit, type Browser } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';

// Opt-in: uses an existing CardMirror development checkout/server and Nix Electron.
// No upstream source, normal CardMirror profile or installed plugins are modified.
test('desktop plugin loads through the real host, sends an extracted tag and jumps back', async ({
	baseURL,
	browserName
}) => {
	test.skip(
		!process.env.CARDMIRROR_DESKTOP_PATH || !process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE_PATH,
		'Set CARDMIRROR_DESKTOP_PATH and PLAYWRIGHT_ELECTRON_EXECUTABLE_PATH for native verification.'
	);
	test.setTimeout(120_000);
	const state = resolve(`.local/cardmirror-native-${Date.now()}`);
	await mkdir(state, { recursive: true });
	const url = process.env.CARDMIRROR_DEV_URL || 'http://127.0.0.1:5174';
	const app = await _electron.launch({
		executablePath: process.env.PLAYWRIGHT_ELECTRON_EXECUTABLE_PATH,
		args: [resolve(process.env.CARDMIRROR_DESKTOP_PATH!), '--no-sandbox', '--headless'],
		env: {
			...process.env,
			CARDMIRROR_DEV_URL: url,
			XDG_CONFIG_HOME: `${state}/config`,
			XDG_DATA_HOME: `${state}/data`,
			XDG_CACHE_HOME: `${state}/cache`
		}
	});
	let browser: Browser | undefined;
	try {
		await expect
			.poll(() => app.windows().map((page) => page.url()), { timeout: 20_000 })
			.toContainEqual(expect.stringContaining(url));
		const native = app.windows().find((page) => page.url().startsWith(url))!;
		browser = await { chromium, firefox, webkit }[browserName].launch();
		await native.addInitScript(() =>
			localStorage.setItem(
				'pmd-settings',
				JSON.stringify({
					pluginsEnabled: true,
					pairingEnabled: false,
					hasSeenUiTour: true,
					showOnboardingStarter: false,
					mobileLayout: 'desktop'
				})
			)
		);
		await native.reload();
		await native.waitForSelector('.pmd-home-action:visible, .ProseMirror:visible');
		if (await native.locator('.pmd-home-action:visible').count())
			await native.locator('.pmd-home-action:visible').first().click();
		const editor = native.locator('.ProseMirror').first();
		await editor.focus();
		await native.evaluate(async () => {
			const path = '/src/editor/index.ts';
			const { getActiveView } = await import(/* @vite-ignore */ path);
			const view = getActiveView();
			const card = view.state.schema.nodeFromJSON({
				type: 'card',
				content: [
					{
						type: 'tag',
						attrs: { id: crypto.randomUUID() },
						content: [{ type: 'text', text: 'Native CardMirror evidence tag' }]
					},
					{
						type: 'cite_paragraph',
						content: [
							{
								type: 'text',
								text: 'Author 2026, complete citation',
								marks: [{ type: 'cite_mark' }]
							}
						]
					},
					{
						type: 'card_body',
						content: [
							{ type: 'text', text: 'Saved evidence with ' },
							{ type: 'text', text: 'bold wording', marks: [{ type: 'bold' }] },
							{ type: 'text', text: ' and ' },
							{ type: 'text', text: 'underlining', marks: [{ type: 'underline_mark' }] },
							{ type: 'text', text: '.' }
						]
					}
				]
			});
			view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, card));
			view.focus();
		});
		await expect(editor.locator('.pmd-card-body')).toContainText(
			'Saved evidence with bold wording and underlining.'
		);
		await editor.locator('h4.pmd-tag').click();
		const loaded = await native.evaluate(async (path) => {
			const host = (
				window as unknown as {
					electronAPI: { pluginLoadFile(path: string): Promise<{ ok: boolean; error?: string }> };
				}
			).electronAPI;
			return host.pluginLoadFile(path);
		}, resolve('static/integrations/cardmirror/plugin.js'));
		expect(loaded).toMatchObject({ ok: true });
		const command = async (id: string) => {
			const result = await native.evaluate(async (id) => {
				// Vite supplies CardMirror's real command registry, not a replacement plugin API.
				const path = '/src/editor/plugin-registry.ts';
				const registry = await import(/* @vite-ignore */ path);
				return registry.runPluginCommand(`cardmirror-flew.${id}`);
			}, id);
			expect(result).toBe(true);
		};
		const flew = await browser.newPage({
			baseURL,
			serviceWorkers: 'block',
			viewport: { width: 1600, height: 1000 }
		});
		await flew.addInitScript(() =>
			localStorage.setItem(
				'settings',
				JSON.stringify({
					isSettings: true,
					version: 2,
					settings: {
						telemetryTier: 0,
						cardMirrorPanel: 2,
						autoflowPanel: 2,
						libraryPanel: 1,
						timersPanel: 0,
						notesPanel: 0,
						speechDropPanel: 1
					}
				})
			)
		);
		await flew.addInitScript(() => {
			class RoomSocket extends EventTarget {
				onmessage = null;
				onclose = null;
				onerror = null;
				send() {
					return undefined;
				}
				close() {
					return undefined;
				}
			}
			Object.defineProperty(window, 'WebSocket', { value: RoomSocket });
		});
		const docx = await readFile('test-files/cardmirror/1NC.docx');
		await flew.route('**/api/speechdrop/round', (route) =>
			route.fulfill({ json: { files: [{ index: 0, name: '1NC.docx' }] } })
		);
		await flew.route('**/api/speechdrop/round/0', (route) =>
			route.fulfill({ body: docx, contentType: 'application/octet-stream' })
		);
		await flew.goto('/app');
		await flew.getByRole('button', { name: 'New flow', exact: true }).click();
		await flew.getByRole('button', { name: 'Create connection key', exact: true }).click();
		await expect(flew.getByLabel('Flew connection key', { exact: true })).toHaveValue(/^FLEWCM1\./);
		await command('connect');
		await native
			.getByLabel('Flew connection key', { exact: true })
			.fill(await flew.getByLabel('Flew connection key', { exact: true }).inputValue());
		await native.getByRole('button', { name: 'Create reply key', exact: true }).click();
		await expect(native.getByLabel('CardMirror reply key', { exact: true })).toHaveValue(
			/^FLEWCM1\./,
			{ timeout: 15_000 }
		);
		await flew
			.getByLabel('CardMirror reply key', { exact: true })
			.fill(await native.getByLabel('CardMirror reply key', { exact: true }).inputValue());
		await flew.getByRole('button', { name: 'Connect CardMirror', exact: true }).click();
		await expect(flew.getByText('Connected to CardMirror', { exact: true })).toBeVisible({
			timeout: 20_000
		});
		await native.getByRole('button', { name: 'Done', exact: true }).click();
		await flew.getByLabel('Flow document title').fill('Saved evidence block');
		await flew.getByLabel('Flow document title').press('Enter');
		await editor.locator('h4.pmd-tag').click();
		await command('send');
		await expect(flew.locator('.box textarea').first()).toHaveValue(
			'Native CardMirror evidence tag\nAuthor 2026, complete citation'
		);
		await expect(flew.getByLabel('CardMirror card', { exact: true })).toBeVisible();
		await flew.getByRole('button', { name: 'Save flow', exact: true }).click();
		const savedDownload = flew.waitForEvent('download');
		await flew.getByRole('button', { name: 'download as JSON', exact: true }).click();
		const savedBytes = await readFile((await (await savedDownload).path())!);
		const saved = JSON.parse(savedBytes.toString());
		const savedBox = Object.values(saved.nodes).find((node: any) => node.value.cardMirror) as any;
		expect(savedBox.value.cardMirror.sources[0].evidence.node.type).toBe('card');
		expect(JSON.stringify(savedBox.value.cardMirror)).toContain('Saved evidence with');
		await flew.keyboard.press('Escape');
		flew.once('dialog', (dialog) => dialog.accept());
		await flew.locator('#uploadId').setInputFiles({
			name: 'Saved evidence.json',
			mimeType: 'application/json',
			buffer: savedBytes
		});
		await flew.getByRole('button', { name: 'Close flow', exact: true }).click();
		await flew.getByRole('button', { name: 'New flow', exact: true }).click();
		const librarySource = flew
			.locator('.library-panel .flow.compact')
			.filter({ hasText: 'Saved evidence block' })
			.getByRole('button', { name: /^Import / })
			.first();
		await expect(librarySource).toBeVisible();
		await librarySource.dragTo(flew.locator('.flow [data-box-id]').first());

		await flew.locator('.flow textarea').first().click();

		// Move the real editor cursor; jumping must use CardMirror's opaque token resolver.
		await editor.press('ControlOrMeta+End');
		const endOffset = await native.evaluate(() => getSelection()?.anchorOffset ?? -1);
		expect(endOffset).toBeGreaterThan(0);
		await flew.getByRole('button', { name: 'Jump to source', exact: true }).first().click();
		await expect(
			flew.getByRole('button', { name: 'Jump to source', exact: true }).first()
		).toBeEnabled();
		await expect(flew.getByRole('alert')).toHaveCount(0);
		await expect.poll(() => native.evaluate(() => getSelection()?.anchorOffset ?? -1)).toBe(0);
		await command('reveal');
		await expect(flew.locator('.box textarea').first()).toBeFocused();
		await flew.getByRole('button', { name: 'Read CardMirror headings', exact: true }).click();
		await flew.locator('.autoflow-panel .blocks .panel-row .content').first().click();
		await expect(flew.locator('.autoflow-panel .blocks')).toContainText(
			'Native CardMirror evidence tag'
		);
		await flew
			.getByRole('button', { name: 'Send selected cells to CardMirror', exact: true })
			.click();
		await expect(editor.locator('.pmd-card')).toHaveCount(2);
		await expect(
			editor.locator('.pmd-card').last().locator('.pmd-card-body .pmd-underline')
		).toHaveText('underlining');
		await expect(editor.locator('.pmd-card').last().locator('.pmd-card-body strong')).toHaveText(
			'bold wording'
		);
		await expect(editor.locator('.pmd-card').last().locator('.pmd-cite-para')).toHaveText(
			'Author 2026, complete citation'
		);
		await editor.press('ControlOrMeta+z');
		await expect(editor.locator('.pmd-card')).toHaveCount(1);
		await native.evaluate(() => document.getElementById('speech-mark-btn')?.click());
		await expect
			.poll(() =>
				native.evaluate(async () => {
					const api = (
						window as unknown as {
							electronAPI: { speechGet: () => Promise<{ uid: string | null }> };
						}
					).electronAPI;
					return (await api.speechGet()).uid;
				})
			)
			.not.toBeNull();
		await flew
			.getByRole('button', { name: 'Send selected cells to speech document', exact: true })
			.click();
		await expect(editor.locator('.pmd-card')).toHaveCount(2);
		await expect(
			editor.locator('.pmd-card').last().locator('.pmd-card-body .pmd-underline')
		).toHaveText('underlining');
		await expect(editor.locator('.pmd-card').last().locator('.pmd-card-body strong')).toHaveText(
			'bold wording'
		);
		await expect(editor.locator('.pmd-card').last().locator('.pmd-cite-para')).toHaveText(
			'Author 2026, complete citation'
		);
		await flew.getByLabel('SpeechDrop room code').fill('round');
		await expect(flew.getByLabel('Open DOCX downloads in CardMirror')).toHaveCount(0);
		const download = flew.waitForEvent('download');
		await flew.getByRole('button', { name: '1NC.docx', exact: true }).click();
		expect((await download).suggestedFilename()).toBe('1NC.docx');
		await expect
			.poll(() => app.windows().filter((page) => page.url().startsWith(url)).length, {
				timeout: 20_000
			})
			.toBe(2);
		const opened = app.windows().find((page) => page !== native && page.url().startsWith(url))!;
		await expect(opened.locator('.ProseMirror').first()).toContainText('SpeechDrop 1NC evidence', {
			timeout: 20_000
		});
		await expect(editor).toContainText('Native CardMirror evidence tag');
		await opened.evaluate(() => document.getElementById('speech-mark-btn')?.click());
		await flew
			.getByRole('button', { name: 'Send selected cells to speech document', exact: true })
			.click();
		await expect(opened.locator('.ProseMirror h4.pmd-tag').last()).toContainText(
			'Native CardMirror evidence tag'
		);
		await expect(
			opened.locator('.ProseMirror .pmd-card').last().locator('.pmd-cite-para')
		).toHaveText('Author 2026, complete citation');
		await expect(
			opened.locator('.ProseMirror .pmd-card').last().locator('.pmd-card-body strong')
		).toHaveText('bold wording');
		await opened.evaluate(async (path) => {
			const api = (
				window as unknown as { electronAPI: { pluginLoadFile(path: string): Promise<unknown> } }
			).electronAPI;
			await api.pluginLoadFile(path);
		}, resolve('static/integrations/cardmirror/plugin.js'));
		await expect
			.poll(() => opened.evaluate(() => typeof window.__flewCardMirrorDispose))
			.toBe('function');
		await flew.getByRole('button', { name: 'Read speech document headings', exact: true }).click();
		await flew.locator('.autoflow-panel .blocks .panel-row .content').first().click();
		await expect(flew.locator('.autoflow-panel .blocks')).toContainText(
			'Native CardMirror evidence tag'
		);
	} finally {
		await browser?.close();
		await app.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
		await app.close().catch(() => undefined);
	}
});
