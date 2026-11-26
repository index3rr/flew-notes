import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'block' });

test('first-run setup saves choices, can skip the tutorial, and does not repeat', async ({
	page
}) => {
	await page.goto('/app');
	const setup = page.getByRole('region', { name: 'Set up Flew', exact: true });
	await expect(setup).toBeVisible();
	await setup.getByRole('radio', { name: 'Public Forum', exact: true }).locator('..').click();
	await setup.getByRole('checkbox', { name: 'Timers panel', exact: true }).locator('..').click();
	await setup.getByRole('checkbox', { name: 'Notes panel', exact: true }).locator('..').click();
	await setup
		.getByRole('checkbox', { name: 'SpeechDrop panel', exact: true })
		.locator('..')
		.click();
	await setup.getByRole('radio', { name: 'Dark', exact: true }).locator('..').click();
	await expect(page.locator('body')).toHaveClass(/dark/);
	await expect(page.locator('[data-panel=notesPanel]')).toBeVisible();
	await expect(page.locator('[data-panel=timersPanel]')).toHaveCount(0);
	await expect(
		setup.getByText('Keep private notes alongside your flow.', { exact: true })
	).toHaveCSS('opacity', '1');
	await setup.getByRole('button', { name: 'skip tutorial', exact: true }).click();
	await expect(setup).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Getting started', exact: true })).toHaveCount(0);
	await expect(page.locator('body')).toHaveClass(/dark/);
	const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('settings')!).settings);
	expect(stored).toMatchObject({
		debateStyle: 1,
		timersPanel: 0,
		notesPanel: 2,
		speechDropPanel: 2,
		colorTheme: 2
	});
	await page.reload();
	await expect(setup).toHaveCount(0);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.flow .header .text').first()).toHaveText('AC');
	await expect(page.locator('[data-panel=timersPanel]')).toHaveCount(0);
	await expect(page.locator('.notes-panel')).toBeVisible();
});

test('setup can start the fullscreen tutorial, which becomes a panel and can be dismissed', async ({
	page
}) => {
	await page.goto('/app');
	await page.getByRole('button', { name: 'start tutorial', exact: true }).click();
	await expect(page.locator('.prelude .tutorial')).toBeVisible();
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.tutorial-card .tutorial')).toBeVisible();
	await page.getByRole('button', { name: 'End tutorial', exact: true }).click();
	await expect(page.locator('.right-sidebar')).toHaveCount(0);
	await expect(page.locator('.flow textarea').first()).toBeVisible();
	await expect(page.locator('[data-tutorial-active]')).toHaveCount(0);
});

test('returning users keep their layout and can replay the tutorial with Tabs temporarily available', async ({
	page
}) => {
	await page.addInitScript(() => {
		if (!localStorage.getItem('settings'))
			localStorage.setItem(
				'settings',
				JSON.stringify({
					isSettings: true,
					version: 3,
					settings: { telemetry: 0, transitionSpeed: 0, tabsPanel: 0, notesPanel: 2 }
				})
			);
	});
	await page.goto('/app');
	await expect(page.getByRole('region', { name: 'Set up Flew', exact: true })).toHaveCount(0);
	await expect(page.locator('[data-panel=tabsPanel]')).toHaveCount(0);
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	await page.getByRole('button', { name: 'start tutorial', exact: true }).click();
	await expect(page.locator('[data-panel=tabsPanel]')).toBeVisible();
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await page.getByRole('button', { name: 'End tutorial', exact: true }).click();
	await expect(page.locator('[data-panel=tabsPanel]')).toHaveCount(0);
	await expect(page.locator('.notes-panel')).toBeVisible();
});

for (const dismiss of ['Escape', 'close']) {
	test(`setup can be dismissed with ${dismiss} and keeps live preferences`, async ({ page }) => {
		await page.goto('/app');
		const setup = page.getByRole('region', { name: 'Set up Flew', exact: true });
		await setup.getByRole('checkbox', { name: 'Notes panel', exact: true }).locator('..').click();
		await expect(page.locator('[data-panel=notesPanel]')).toBeVisible();
		if (dismiss === 'Escape') await page.keyboard.press('Escape');
		else
			await page
				.locator('.popups .upper')
				.getByRole('button', { name: 'Close popup', exact: true })
				.click();
		await expect(setup).toHaveCount(0);
		await page.reload();
		await expect(setup).toHaveCount(0);
		await expect(page.locator('[data-panel=notesPanel]')).toBeVisible();
		await expect(page.getByRole('region', { name: 'Getting started', exact: true })).toHaveCount(0);
	});
}

test('setup imports settings without starting a tutorial or rewriting a custom theme', async ({
	page
}) => {
	await page.goto('/app');
	await page.getByLabel('Import onboarding settings', { exact: true }).setInputFiles({
		name: 'settings.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({
				isSettings: true,
				version: 3,
				settings: {
					colorTheme: 3,
					notesPanel: 1,
					timersPanel: 0,
					debateStyle: 2,
					LDSubstyle: 1,
					telemetry: 0
				}
			})
		)
	});
	await expect(page.getByRole('region', { name: 'Set up Flew', exact: true })).toHaveCount(0);
	await expect(page.locator('body')).toHaveClass(/custom/);
	await expect(page.locator('.sidebar [data-panel=notesPanel]')).toBeVisible();
	await expect(page.getByRole('region', { name: 'Getting started', exact: true })).toHaveCount(0);
	const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('settings')!).settings);
	expect(stored).toMatchObject({
		colorTheme: 3,
		notesPanel: 1,
		timersPanel: 0,
		debateStyle: 2,
		LDSubstyle: 1
	});
});

test('setup handles an invalid import and shows LD options immediately', async ({ page }) => {
	await page.goto('/app');
	const setup = page.getByRole('region', { name: 'Set up Flew', exact: true });
	await setup.getByRole('radio', { name: 'Lincoln Douglas', exact: true }).locator('..').click();
	await expect(setup.getByRole('radio', { name: 'TOC Circuit', exact: true })).toBeVisible();
	await page.getByLabel('Import onboarding settings', { exact: true }).setInputFiles({
		name: 'flow.json',
		mimeType: 'application/json',
		buffer: Buffer.from('{"nodes":{}}')
	});
	await expect(setup.getByRole('alert')).toHaveText('Choose a Flew settings file.');
	await expect(setup).toBeVisible();
	await setup.getByRole('button', { name: 'skip tutorial', exact: true }).click();
});
