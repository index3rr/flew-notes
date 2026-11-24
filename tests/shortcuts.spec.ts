import { test, expect } from '@playwright/test';

test('format tooltips show the real shortcuts and star works with Ctrl and Command', async ({
	page
}) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const cell = page.getByPlaceholder('type here', { exact: true });
	await cell.fill('Argument');
	const star = page.getByRole('button', { name: 'Toggle starred argument', exact: true });
	await expect(star).toBeEnabled();
	await star.hover();
	const starTip = page.locator('.tooltip').filter({ hasText: 'toggle starred argument' });
	await expect(starTip.locator('kbd')).toHaveText(['cmd/ctrl', 'shift', '8']);
	await cell.press('Control+Shift+8');
	await expect(star).toHaveClass(/toggled/);
	await cell.press('Meta+Shift+8');
	await expect(star).not.toHaveClass(/toggled/);
	await page.getByRole('button', { name: 'Toggle crossed out', exact: true }).hover();
	await expect(
		page.locator('.tooltip').filter({ hasText: 'toggle crossed out' }).locator('kbd')
	).toHaveText(['ctrl', 'shift', 'X']);
	await page.getByRole('button', { name: 'Delete selected cell', exact: true }).hover();
	await expect(
		page.locator('.tooltip').filter({ hasText: 'delete selected' }).locator('kbd')
	).toHaveText(['cmd/ctrl', 'backspace']);
});

test('Help documents the application shortcuts and their contexts', async ({ page }) => {
	await page.goto('/app');
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	await page.getByRole('button', { name: 'shortcuts', exact: true }).click();
	async function row(description: string, keys: string[]) {
		const item = page
			.locator('.shortcut-row')
			.filter({ has: page.getByText(description, { exact: true }) });
		await expect(item).toHaveCount(1);
		await expect(item.locator('kbd')).toHaveText(keys);
		return item;
	}
	await row('Add primary flow page', ['cmd/ctrl', 'alt', 'N']);
	await row('Add secondary flow page', ['cmd/ctrl', 'alt', 'shift', 'N']);
	await row('Toggle crossed out', ['ctrl', 'shift', 'X']);
	await row('Toggle starred argument', ['cmd/ctrl', 'shift', '8']);
	await row('Paste copied cells and their responses', ['cmd/ctrl', 'V']);
	await row('Select through the cell above', ['shift', '↑']);
	await row('Select a range of cells', ['shift', 'CLICK']);
	await row('Create a document or commit its title', ['↵']);
	await row('Increase the focused minutes or seconds field', ['↑']);
	await row('Decrease the focused minutes or seconds field', ['↓']);
	await row('Move from minutes to seconds', ['→']);
	await row('Move from seconds to minutes', ['←']);
	await page.locator('.upper').last().getByRole('button').hover();
	await expect(page.locator('.tooltip').filter({ hasText: 'close' }).locator('kbd')).toHaveText([
		'esc'
	]);
	await page.keyboard.press('Escape');
	await expect(page.locator('.screen')).toHaveCount(0);
});

test('page creation uses browser-safe shortcuts from a focused cell', async ({ page }) => {
	await page.goto('/app');
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(page.locator('.tabs li')).toHaveCount(1);
	await page.locator('.flow textarea').first().press('Control+Alt+n');
	await expect(page.locator('.tabs li')).toHaveCount(2);
	await page.locator('.flow textarea').first().press('Control+Alt+Shift+n');
	await expect(page.locator('.tabs li')).toHaveCount(3);
	await page.locator('.addTab .buttons button').first().hover();
	await expect(
		page.locator('.tooltip').filter({ hasText: 'create new aff flow' }).locator('kbd')
	).toHaveText(['cmd/ctrl', 'alt', 'N']);
});
