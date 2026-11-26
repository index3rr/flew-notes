import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => {
		localStorage.setItem(
			'settings',
			JSON.stringify({ isSettings: true, version: 2, settings: { telemetry: 0 } })
		);
		let seed = 1234567;
		Math.random = () => {
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			return seed / 4294967296;
		};
	});
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	return errors;
}

test('settings imports can move timers and enable pacing without crashing', async ({ page }) => {
	const errors = await setup(page);
	for (const timersPanel of [3, 2, 1, 4, 1]) {
		await page.locator('#uploadId').setInputFiles({
			name: 'settings.json',
			mimeType: 'application/json',
			buffer: Buffer.from(
				JSON.stringify({
					isSettings: true,
					version: 2,
					settings: {
						transitionSpeed: 0,
						timersPanel,
						pacingEnabled: true,
						pacingGracePeriod: 25,
						notesPanel: 2,
						starredPanel: 2,
						coveragePanel: 2,
						autoflowPanel: 4,
						transcriptPanel: 4,
						collaborationPanel: 4,
						libraryPanel: 3,
						speechDropPanel: 3
					}
				})
			)
		});
		await expect(page.locator(`[data-panel="timersPanel"]`)).toHaveCount(1);
	}
	const minutes = page.locator('.timer-panel input').first();
	await minutes.fill('3');
	await minutes.press('Tab');
	await expect(minutes).toHaveValue('03');
	expect(errors).toEqual([]);
});

test('repeated randomized settings keep timers usable', async ({ page }) => {
	test.setTimeout(90000);
	const errors = await setup(page);
	await page.locator('.header button').nth(1).click();
	const randomize = page.getByRole('button', { name: 'randomize settings', exact: true });
	for (let i = 0; i < 40 && !errors.length; i++) {
		await randomize.focus();
		await randomize.press('Enter');
	}
	expect(errors).toEqual([]);
});
