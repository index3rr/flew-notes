import { test, expect } from '@playwright/test';

test('partner messages notify both ways and SpeechDrop codes sync on join and edits', async ({
	context
}) => {
	await context.addInitScript(() => {
		localStorage.setItem(
			'settings',
			JSON.stringify({
				isSettings: true,
				version: 2,
				settings: {
					collaborationPanel: 3,
					speechDropPanel: 3,
					timersPanel: 0,
					notesPanel: 0,
					libraryPanel: 0,
					telemetry: 0
				}
			})
		);
		// The room index is mocked below; avoid contacting SpeechDrop's event bus.
		class RoomSocket extends EventTarget {
			onmessage = null;
			onclose = null;
			onerror = null;
			send() {}
			close() {}
		}
		Object.defineProperty(window, 'WebSocket', { value: RoomSocket });
	});
	await context.route('**/api/speechdrop/**', (route) => route.fulfill({ json: { files: [] } }));
	const host = await context.newPage();
	await host.goto('/app');
	await host.getByRole('button', { name: 'New flow', exact: true }).click();
	await host.getByRole('button', { name: 'SpeechDrop', exact: true }).click();
	await host.getByRole('textbox', { name: 'SpeechDrop room code' }).fill('test-room');
	await host.locator('.sidebar .header .buttons div:nth-child(4) > .top').first().click();
	await host.getByRole('button', { name: 'host new room' }).click();
	await host.getByRole('button', { name: 'add guest' }).click();
	const joinLink = await host.locator('.copyBox > .text').first().textContent();
	if (!joinLink) throw new Error('Missing join link');
	const guest = await context.newPage();
	await guest.goto(joinLink);
	const confirmLink = await guest.locator('.copyBox > .text').first().textContent();
	if (!confirmLink) throw new Error('Missing confirm link');
	const confirm = await context.newPage();
	await confirm.goto(confirmLink);
	await expect(guest.getByText('connected as guest 1')).toBeVisible();
	for (const page of [host, guest]) await page.locator('.upper > .element > .top').click();
	await guest.getByRole('button', { name: 'SpeechDrop', exact: true }).click();
	await expect(guest.getByRole('textbox', { name: 'SpeechDrop room code' })).toHaveValue(
		'test-room'
	);
	await guest.getByRole('textbox', { name: 'SpeechDrop room code' }).fill('updated-room');
	await expect(host.getByRole('textbox', { name: 'SpeechDrop room code' })).toHaveValue(
		'updated-room'
	);
	await host.getByRole('button', { name: 'Collaboration', exact: true }).click();
	await host
		.getByRole('textbox', { name: 'Message your partner' })
		.fill('Please answer the new claim');
	await host.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(guest.locator('.notifications')).toContainText('Please answer the new claim');
	await guest.getByRole('button', { name: 'Collaboration', exact: true }).click();
	await guest.getByRole('textbox', { name: 'Message your partner' }).fill('Working on it');
	await guest.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(host.locator('.notifications')).toContainText('Working on it');
	await host.getByRole('button', { name: 'Dismiss partner notification' }).click();
	await expect(host.locator('.notifications')).not.toContainText('Working on it');
});
