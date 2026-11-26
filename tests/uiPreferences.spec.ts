import { test, expect, type Page } from '@playwright/test';
test.use({ serviceWorkers: 'block' });
async function setup(page: Page, settings: Record<string, number | boolean> = {}) {
	await page.addInitScript(
		(settings) =>
			localStorage.setItem(
				'settings',
				JSON.stringify({
					isSettings: true,
					version: 4,
					settings: { telemetry: 0, transitionSpeed: 0, ...settings }
				})
			),
		settings
	);
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
}
async function change(page: Page, settings: Record<string, number | boolean>, version = 4) {
	await page.locator('#uploadId').setInputFiles({
		name: 'settings.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify({ isSettings: true, version, settings }))
	});
}
test('column tooltips stay next to their transformed anchor and bottom tooltips flip above', async ({
	page
}) => {
	await setup(page);
	const add = page.getByRole('button', { name: 'Add argument in 1AC', exact: true });
	await add.hover();
	const tooltip = page.locator('.tooltip').filter({ hasText: 'add an unconnected argument' });
	await expect(tooltip).toBeVisible();
	const anchor = await add.boundingBox(),
		tip = await tooltip.boundingBox();
	if (!anchor || !tip) throw new Error('Missing tooltip geometry');
	expect(tip.y - anchor.y - anchor.height).toBeGreaterThanOrEqual(0);
	expect(tip.y - anchor.y - anchor.height).toBeLessThan(30);
	expect(Math.abs(tip.x + tip.width / 2 - anchor.x - anchor.width / 2)).toBeLessThan(2);
	await page.getByRole('button', { name: 'Timers', exact: true }).hover();
	const timerTip = page
		.locator('.tooltip')
		.filter({ has: page.getByText('Timers', { exact: true }) });
	await expect(timerTip).toBeVisible();
	const button = await page.getByRole('button', { name: 'Timers', exact: true }).boundingBox(),
		bounds = await timerTip.boundingBox();
	if (!button || !bounds) throw new Error('Missing timer tooltip');
	expect(bounds.y + bounds.height).toBeLessThanOrEqual(button.y);
});
test('star icon follows every visible or collapsed Starred panel position', async ({ page }) => {
	await setup(page, { starredPanel: 0 });
	const star = page.getByRole('button', { name: 'Toggle starred argument', exact: true });
	await expect(star).toHaveCount(0);
	for (const position of [1, 2, 3, 4]) {
		await change(page, { starredPanel: position });
		await expect(star).toBeVisible();
	}
	await change(page, { starredPanel: 0 });
	await expect(star).toHaveCount(0);
});
test('disabled toolbar groups disappear and disabling all removes the toolbar surface', async ({
	page
}) => {
	await setup(page, { showBoxFormatButtons: false });
	await expect(page.getByRole('button', { name: 'Toggle crossed out', exact: true })).toHaveCount(
		0
	);
	await expect(page.locator('.box-control .hideButtons button')).toHaveCount(0);
	await change(page, {
		showUndoRedoButtons: false,
		showBoxCreationButtons: false,
		showQuickExtensionButtons: false,
		showBoxFormatButtons: false
	});
	await expect(page.locator('.box-control')).toHaveCount(0);
	await page.locator('.flow textarea').first().fill('Keyboard still works');
	await page.locator('.flow textarea').first().press('Enter');
	await expect(page.locator('.flow textarea')).toHaveCount(2);
});
test('file menu survives legacy save-button preferences and exports a full flow', async ({
	page
}) => {
	await setup(page);
	await change(page, { showSaveButton: false }, 3);
	await page.locator('.flow textarea').first().fill('Export this pending edit');
	await page.getByRole('button', { name: 'File menu', exact: true }).click();
	const menu = page.getByRole('region', { name: 'Flow files', exact: true });
	await expect(
		menu.getByRole('button', { name: 'Open flow or import settings', exact: true })
	).toBeVisible();
	const download = page.waitForEvent('download');
	await menu.getByRole('button', { name: 'Download JSON copy', exact: true }).click();
	const file = await download;
	const stream = await file.createReadStream();
	if (!stream) throw new Error('Missing download');
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	expect(Buffer.concat(chunks).toString()).toContain('Export this pending edit');
	await page.locator('.header button').nth(1).click();
	await expect(page.getByRole('heading', { name: 'Manual save button', exact: true })).toHaveCount(
		0
	);
});
test('onboarding asks about telemetry and sends nothing before the choice', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'webdriver', { value: false });
		Object.defineProperty(navigator, 'userAgent', {
			value: navigator.userAgent.replace('HeadlessChrome', 'Chrome')
		});
	});
	const requests: string[] = [];
	await page.route(/^https:\/\/[^/]+\.posthog\.com\//, async (route) => {
		requests.push(new URL(route.request().url()).pathname);
		await route.fulfill({ json: { status: 1 } });
	});
	await page.goto('/app');
	const setup = page.getByRole('region', { name: 'Set up Flew', exact: true });
	await expect(setup.getByRole('radio', { name: 'None', exact: true })).toBeChecked();
	expect(requests).toEqual([]);
	await setup.getByRole('radio', { name: 'Errors and usage', exact: true }).locator('..').click();
	await setup.getByRole('button', { name: 'skip tutorial', exact: true }).click();
	await expect.poll(() => requests.filter((path) => /(?:^|\/)e\/?$/.test(path))).not.toEqual([]);
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem('settings') ?? '{}').settings.telemetry
		)
	).toBe(2);
});
