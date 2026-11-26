import { test, expect, type Page } from '@playwright/test';
function errorsOn(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (e) => {
		errors.push(e.message);
	});
	return errors;
}

test('invalid saved settings cannot prevent the app from opening', async ({ page }) => {
	const errors = errorsOn(page);
	await page.addInitScript(() =>
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 2,
				isSettings: true,
				settings: {
					telemetry: 0,
					debateStyle: 99,
					fontFamily: -5,
					padding: -100,
					pacingEnabled: 'yes'
				}
			})
		)
	);
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'New flow', exact: true })).toBeVisible({
		timeout: 5000
	});
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	expect(errors).toEqual([]);
});

test('malformed saved settings cannot prevent the app from opening', async ({ page }) => {
	const errors = errorsOn(page);
	await page.addInitScript(() => localStorage.setItem('settings', '{broken json'));
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'New flow', exact: true })).toBeVisible({
		timeout: 5000
	});
	expect(errors).toEqual([]);
});

test('switching formats after selecting their final speech keeps the UI working', async ({
	page
}) => {
	const errors = errorsOn(page);
	await page.addInitScript(() =>
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 2,
				isSettings: true,
				settings: { telemetry: 0, transitionSpeed: 80, pacingEnabled: true }
			})
		)
	);
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	for (let debateStyle = 0; debateStyle < 12; debateStyle++) {
		const speeches = page.locator('.timer-panel .speeches button');
		if (await speeches.count()) await speeches.last().click();
		await page.locator('#uploadId').setInputFiles({
			name: 'settings.json',
			mimeType: 'application/json',
			buffer: Buffer.from(
				JSON.stringify({ version: 2, isSettings: true, settings: { debateStyle } })
			)
		});
	}
	await page.locator('.flow textarea').first().fill('Still working');
	expect(errors).toEqual([]);
});

test('negative animation duration entered in Settings cannot freeze panel updates', async ({
	page
}) => {
	const errors = errorsOn(page);
	await page.addInitScript(() =>
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 2,
				isSettings: true,
				settings: { telemetry: 0, transitionSpeed: 0 }
			})
		)
	);
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page.locator('.header button').nth(1).click();
	const duration = page
		.locator('.settings .top')
		.filter({ has: page.getByRole('heading', { name: 'Transition duration', exact: true }) })
		.getByRole('spinbutton')
		.first();
	await duration.fill('-1');
	await duration.press('Tab');
	await page.keyboard.press('Escape');
	await page.locator('#uploadId').setInputFiles({
		name: 'settings.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({
				version: 2,
				isSettings: true,
				settings: { notesPanel: 0, coveragePanel: 0, timersPanel: 3 }
			})
		)
	});
	await page.getByRole('button', { name: 'Timers', exact: true }).click();
	await expect(page.locator('.timer-panel')).toBeVisible();
	await page.locator('.timer-panel input').first().fill('3');
	expect(errors).toEqual([]);
});

test('closing Settings when browser storage is full does not freeze the app', async ({ page }) => {
	const errors = errorsOn(page);
	await page.addInitScript(() => {
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 2,
				isSettings: true,
				settings: { telemetry: 0, transitionSpeed: 0 }
			})
		);
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key, value) {
			if (key === 'settings') throw new DOMException('Storage is full', 'QuotaExceededError');
			return setItem.call(this, key, value);
		};
	});
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page.locator('.header button').nth(1).click();
	await page.keyboard.press('Escape');
	await page.locator('.flow textarea').first().fill('Still editable');
	await page.locator('.header button').nth(1).click();
	await expect(page.getByRole('button', { name: 'randomize settings', exact: true })).toBeVisible({
		timeout: 5000
	});
	expect(errors).toEqual([]);
});

test('numeric settings allow fractional typing while rejecting invalid layout values', async ({
	page
}) => {
	const errors = errorsOn(page);
	await page.addInitScript(() =>
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 2,
				isSettings: true,
				settings: { telemetry: 0, transitionSpeed: 0 }
			})
		)
	);
	await page.goto('/app');
	await page.locator('.header button').nth(1).click();
	const font = page
		.locator('.settings .top')
		.filter({ has: page.getByRole('heading', { name: 'Font size', exact: true }) })
		.getByRole('spinbutton')
		.first();
	await font.fill('');
	await font.pressSequentially('0.8');
	await font.press('Tab');
	await expect(font).toHaveValue('0.8');
	await font.fill('-1');
	await font.press('Tab');
	await expect(font).toHaveValue('0.2');
	await font.fill('');
	await font.press('Tab');
	await expect(font).toHaveValue('0.9');
	expect(errors).toEqual([]);
});
