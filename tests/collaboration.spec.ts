import { test, expect, type Page } from '@playwright/test';

import { peer, connect, sharing } from './helpers/collaboration';

test('partner argument links reveal a folded response and disable when the response is removed', async ({
	context
}) => {
	test.setTimeout(90_000);
	await context.addInitScript(() =>
		localStorage.setItem(
			'settings',
			JSON.stringify({
				isSettings: true,
				version: 2,
				settings: { telemetryTier: 0, collaborationPanel: 1, timersPanel: 0, notesPanel: 0 }
			})
		)
	);
	const host = await context.newPage();
	await host.goto('/app');
	await host.getByRole('button', { name: 'New flow', exact: true }).click();
	const cells = host.locator('.box textarea');
	await cells.first().fill('Climate advantage');
	await cells.first().press('Shift+Enter');
	await cells.nth(1).fill('Please answer the warming impact');
	await host.locator('.sidebar .header .buttons div:nth-child(4) > .top').first().click();
	await host.getByRole('button', { name: 'host new room' }).click();
	await host.getByRole('button', { name: 'add guest' }).click();
	const join = await host.locator('.copyBox > .text').first().textContent();
	const guest = await context.newPage();
	await guest.goto(join!);
	const confirmation = await guest.locator('.copyBox > .text').first().textContent();
	const confirmationPage = await context.newPage();
	await confirmationPage.goto(confirmation!);
	await expect(guest.getByText('connected as guest 1')).toBeVisible();
	for (const page of [host, guest]) await page.locator('.upper > .element > .top').click();
	await guest.locator('.tabs li button').first().click();
	await guest.locator('.box textarea').first().press('Control+l');
	await expect(guest.locator('.children.isFolded')).toHaveCount(1);
	await cells.nth(1).click();
	await host.getByLabel('Message your partner').fill('Cover this during CX');
	await host.getByRole('button', { name: 'Insert selected argument link', exact: true }).click();
	await expect(host.getByLabel('Message your partner')).toContainText('Cover this during CX');
	await expect(host.locator('.partner-composer .argument-chip')).toHaveText(
		'Please answer the warming impact'
	);
	await expect(guest.locator('.notifications')).not.toContainText('Cover this during CX');
	await host.getByRole('button', { name: 'Send', exact: true }).click();
	const show = guest
		.locator('.notifications')
		.getByRole('button', { name: 'Show argument', exact: true });
	await expect(show).toBeVisible();
	await show.click();
	await expect(guest.locator('.children.isFolded')).toHaveCount(0);
	await expect(guest.locator('.box textarea').nth(1)).toHaveValue(
		'Please answer the warming impact'
	);
	await expect(guest.locator('.box textarea').nth(1)).toBeFocused();
	await guest.getByRole('button', { name: 'Delete selected cell', exact: true }).click();
	await expect(show).toBeDisabled();
});

test('partner messages notify both ways and SpeechDrop codes sync on join and edits', async ({
	context
}) => {
	test.setTimeout(90000);
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
			send() {
				return undefined;
			}
			close() {
				return undefined;
			}
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
	await host.evaluate(() => {
		Object.defineProperty(window, '__nativeNotices', { value: [], configurable: true });
		class TestNotification {
			static permission = 'default';
			static async requestPermission() {
				this.permission = 'granted';
				return 'granted';
			}
			constructor(title: string, options: { body: string }) {
				(window as unknown as { __nativeNotices: string[] }).__nativeNotices.push(
					title + ': ' + options.body
				);
			}
			close() {}
		}
		Object.defineProperty(window, 'Notification', { value: TestNotification, configurable: true });
		window.dispatchEvent(new Event('focus'));
	});
	await host.getByRole('button', { name: 'Enable partner notifications', exact: true }).click();
	await expect(
		host.getByRole('button', { name: 'Enable partner notifications', exact: true })
	).toHaveCount(0);
	await guest.getByLabel('Message your partner').fill('System delivery');
	await guest.getByRole('button', { name: 'Send', exact: true }).click();
	await expect
		.poll(() =>
			host.evaluate(() => (window as unknown as { __nativeNotices: string[] }).__nativeNotices)
		)
		.toEqual([
			'Flew Notes: Partner notifications enabled.',
			'Your debate partner: System delivery'
		]);
	await expect(host.locator('.notifications')).not.toContainText('System delivery');
});

test('inactive collaboration offers a compact enable button and restores it after cancellation', async ({
	page
}) => {
	await page.addInitScript(() =>
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 2,
				isSettings: true,
				settings: { collaborationPanel: 2, notesPanel: 0, timersPanel: 0, telemetry: 0 }
			})
		)
	);
	await page.goto('/app');
	const panel = page.locator('[data-panel="collaborationPanel"]');
	await expect(panel.locator('.panel-placeholder')).toHaveCount(0);
	await expect(
		panel.getByRole('button', { name: 'Enable collaboration', exact: true })
	).toBeVisible();
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	const enable = panel.getByRole('button', { name: 'Enable collaboration', exact: true });
	await expect(enable).toBeVisible();
	await expect(panel).toHaveClass(/auto-size/);
	await expect(panel.getByRole('textbox')).toHaveCount(0);
	await enable.click();
	await page.getByRole('button', { name: 'host new room', exact: true }).click();
	await page.locator('.upper > .element > .top').click();
	await expect(panel).not.toHaveClass(/auto-size/);
	await panel.getByRole('textbox', { name: 'Message your partner' }).fill('Keep this draft');
	await page.locator('.sidebar .header .buttons div:nth-child(4) > .top').first().click();
	await page.getByRole('button', { name: 'cancel', exact: true }).click();
	await page.locator('.upper > .element > .top').click();
	await expect(enable).toBeVisible();
	await expect(panel).toHaveClass(/auto-size/);
	await expect(panel.getByRole('textbox')).toHaveCount(0);
	await enable.click();
	await page.getByRole('button', { name: 'host new room', exact: true }).click();
	await page.locator('.upper > .element > .top').click();
	await expect(panel.getByRole('textbox', { name: 'Message your partner' })).toHaveText(
		'Keep this draft'
	);
});

const title = (page: Page) => page.getByRole('textbox', { name: 'Flow document title' });
const notes = (page: Page) => page.getByPlaceholder('type notes here');
const close = (page: Page) => page.getByRole('button', { name: /^Close (flow|without saving)$/ });
async function newDocument(page: Page, name: string) {
	await title(page).fill(name);
	await page.getByRole('button', { name: 'New flow', exact: true }).click();
	await expect(close(page)).toBeEnabled();
}
async function saved(page: Page, name: string) {
	return page.evaluate((name) => {
		const metadata = JSON.parse(localStorage.getItem('savedFlows') ?? '{}');
		const key = Object.keys(metadata).find((key) => metadata[key].title === name);
		return key ? JSON.parse(localStorage.getItem(key)!) : null;
	}, name);
}

test('shared document lifecycle syncs titles while preserving private notes and recovery', async ({
	browser
}) => {
	test.setTimeout(90000);
	const host = await peer(browser);
	const guest = await peer(browser);
	try {
		await newDocument(host, 'Round one');
		await notes(host).fill('Host prep notes');
		await host.getByPlaceholder('type here', { exact: true }).fill('Host argument');
		await newDocument(guest, 'Private work');
		await guest.getByPlaceholder('type here', { exact: true }).fill('Keep this argument');
		await notes(guest).fill('Keep these notes');
		await connect(host, guest);
		await expect(title(guest)).toHaveValue('Round one');
		await expect(notes(guest)).toHaveValue('Keep these notes');
		await expect(guest.getByPlaceholder('type here', { exact: true })).toHaveValue('Host argument');
		expect((await saved(guest, 'Private work')).sideDocText).toBe('Keep these notes');
		expect(JSON.stringify((await saved(guest, 'Private work')).nodes)).toContain(
			'Keep this argument'
		);
		await title(guest).fill('Renamed round');
		await notes(guest).fill('Guest prep notes');
		await expect(title(host)).toHaveValue('Renamed round');
		await expect(notes(host)).toHaveValue('Host prep notes');
		// Removing the last page leaves an open, named document, not a closed library.
		await host.locator('.grid > .title').getByRole('button').click();
		await expect(guest.getByPlaceholder('type here', { exact: true })).toHaveCount(0);
		await expect(close(guest)).toBeVisible();
		await expect(notes(guest)).toHaveValue('Guest prep notes');
		await close(guest).click();
		await expect(host.getByRole('button', { name: 'New flow', exact: true })).toBeVisible();
		await expect(title(host)).toHaveValue('');
		await expect(notes(host)).toHaveCount(0);
		await newDocument(guest, 'Round two');
		await expect(title(host)).toHaveValue('Round two');
		await expect(host.getByPlaceholder('type here', { exact: true })).toBeVisible();
		await host.getByPlaceholder('type here', { exact: true }).fill('New round argument');
		await expect(guest.getByPlaceholder('type here', { exact: true })).toHaveValue(
			'New round argument'
		);
		// Browser saves stay separate when the host switches to a guest's new document.
		await expect.poll(async () => (await saved(host, 'Round two'))?.title).toBe('Round two');
		expect((await saved(host, 'Renamed round')).sideDocText).toBe('Host prep notes');
		expect((await saved(guest, 'Private work')).sideDocText).toBe('Keep these notes');
		await close(host).click();
		await expect(guest.getByRole('button', { name: 'New flow', exact: true })).toBeVisible();
		await guest.locator('#uploadId').setInputFiles('test-files/persistancy/Round.json');
		await expect(title(host)).toHaveValue('Round');
		await expect(notes(host)).toHaveValue('');
		await expect(notes(guest)).toHaveValue('Round notes');
		await expect(host.getByPlaceholder('type here', { exact: true })).toHaveValue(
			'Original argument'
		);
	} finally {
		await host.context().close();
		await guest.context().close();
	}
});

test('three peers converge after overlapping edits and resync without stale actions', async ({
	browser
}) => {
	test.setTimeout(120000);
	const host = await peer(browser);
	const guest = await peer(browser);
	const other = await peer(browser);
	try {
		await newDocument(host, 'Shared round');
		await connect(host, guest);
		await connect(host, other, false);
		await guest.evaluate(() => window.pauseEdits());
		await title(guest).fill('Guest title');
		await notes(guest).fill('Guest notes');
		await guest.getByPlaceholder('type here', { exact: true }).fill('Guest argument');
		await title(guest).click(); // Commit the pending cell edit while delivery is paused.
		await title(host).fill('Host title');
		await host.getByPlaceholder('type here', { exact: true }).fill('Host argument');
		await title(host).click();
		await expect(other.getByPlaceholder('type here', { exact: true })).toHaveValue('Host argument');
		await guest.evaluate(() => window.flushEdits());
		for (const page of [host, guest, other]) {
			await expect(title(page)).toHaveValue('Guest title');
			await expect(notes(page)).toHaveValue(page === guest ? 'Guest notes' : '');
			await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
				'Guest argument'
			);
		}
		// A resync must flush text and clear prediction without replaying a previous edit.
		await guest.getByPlaceholder('type here', { exact: true }).fill('Before resync');
		await sharing(guest);
		await guest.getByRole('button', { name: 'sync', exact: true }).click();
		await expect(guest.getByRole('button', { name: 'sync', exact: true })).toBeEnabled();
		await guest.locator('.upper > .element > .top').click();
		await expect(notes(guest)).toHaveValue('Guest notes');
		await other.getByPlaceholder('type here', { exact: true }).fill('After resync');
		await title(other).click();
		for (const page of [host, guest, other]) {
			await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue('After resync');
		}
		// Deleting a selected page on a peer should show another available page.
		await host.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
		await host.getByPlaceholder('type name here').fill('Second page');
		await host.getByPlaceholder('type name here').press('Enter');
		await expect(guest.getByRole('button', { name: 'Second page', exact: true })).toBeVisible();
		await guest.locator('.grid > .title').getByRole('button').click();
		for (const page of [host, guest, other]) {
			await expect(page.getByPlaceholder('type name here')).toHaveValue('Second page');
		}
		await guest.evaluate(() => window.pauseEdits());
		await title(guest).fill('Delayed old title');
		await guest.getByPlaceholder('type here', { exact: true }).fill('Delayed old argument');
		await title(guest).click();
		await close(host).click();
		await newDocument(host, 'Fresh document');
		await expect(title(guest)).toHaveValue('Fresh document');
		await guest.evaluate(() => window.flushEdits());
		await other.getByPlaceholder('type here', { exact: true }).fill('Fresh argument');
		await title(other).click();
		for (const page of [host, guest, other]) {
			await expect(title(page)).toHaveValue('Fresh document');
			await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
				'Fresh argument'
			);
		}
	} finally {
		await host.context().close();
		await guest.context().close();
		await other.context().close();
	}
});

test('large shared documents and argument updates cross data-channel message limits', async ({
	browser
}) => {
	test.setTimeout(90000);
	const host = await peer(browser);
	const guest = await peer(browser);
	const largeArgument = 'Debate argument — 📝 '.repeat(24000);
	try {
		await newDocument(host, 'Large round');
		await host.getByPlaceholder('type here', { exact: true }).evaluate((element, text) => {
			(element as HTMLTextAreaElement).focus();
			element.dispatchEvent(
				new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text })
			);
			(element as HTMLTextAreaElement).value = text;
			element.dispatchEvent(new Event('input', { bubbles: true }));
		}, largeArgument);
		await title(host).click();
		await connect(host, guest);
		expect(await guest.getByPlaceholder('type here', { exact: true }).inputValue()).toBe(
			largeArgument
		);
		await guest.getByPlaceholder('type here', { exact: true }).evaluate((element, text) => {
			(element as HTMLTextAreaElement).focus();
			element.dispatchEvent(
				new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text })
			);
			(element as HTMLTextAreaElement).value = text;
			element.dispatchEvent(new Event('input', { bubbles: true }));
		}, largeArgument + 'Guest conclusion');
		await title(guest).click();
		await expect
			.poll(
				async () => (await host.getByPlaceholder('type here', { exact: true }).inputValue()).length
			)
			.toBe((largeArgument + 'Guest conclusion').length);
		expect(await host.getByPlaceholder('type here', { exact: true }).inputValue()).toBe(
			largeArgument + 'Guest conclusion'
		);
	} finally {
		await host.context().close();
		await guest.context().close();
	}
});

test('concurrent text and formatting edits preserve both changes and undo only the local edit', async ({
	browser
}) => {
	test.setTimeout(90000);
	const host = await peer(browser);
	const guest = await peer(browser);
	try {
		await newDocument(host, 'Formatting round');
		await host.getByPlaceholder('type here', { exact: true }).fill('Original argument');
		await title(host).click();
		await connect(host, guest);
		await guest.evaluate(() => window.pauseEdits());
		await guest.getByPlaceholder('type here', { exact: true }).fill('Guest text');
		await title(guest).click();
		await host.getByPlaceholder('type here', { exact: true }).press('Control+b');
		await expect(host.locator('.flow .text.bold')).toHaveCount(1);
		await guest.evaluate(() => window.flushEdits());
		for (const page of [host, guest]) {
			await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue('Guest text');
			await expect(page.locator('.flow .text.bold')).toHaveCount(1);
		}
		await guest.getByPlaceholder('type here', { exact: true }).press('Control+z');
		for (const page of [host, guest]) {
			await expect(page.getByPlaceholder('type here', { exact: true })).toHaveValue(
				'Original argument'
			);
			await expect(page.locator('.flow .text.bold')).toHaveCount(1);
		}
	} finally {
		await host.context().close();
		await guest.context().close();
	}
});

for (const incompatiblePeer of ['host', 'guest'] as const) {
	test(`incompatible ${incompatiblePeer} is rejected without replacing private work`, async ({
		browser
	}) => {
		const host = await peer(browser);
		const guest = await peer(browser);
		try {
			await newDocument(host, 'Host private round');
			await newDocument(guest, 'Guest private round');
			const messages: string[] = [];
			for (const page of [host, guest])
				page.on('dialog', async (dialog) => {
					messages.push(dialog.message());
					await dialog.accept();
				});
			await (incompatiblePeer === 'host' ? host : guest).evaluate(() => {
				const original = RTCDataChannel.prototype.send as (
					this: RTCDataChannel,
					data: string
				) => void;
				RTCDataChannel.prototype.send = function (this: RTCDataChannel, data: string) {
					const message = JSON.parse(data);
					if (message.tag === 'hello') message.protocol = 'older-version';
					original.call(this, JSON.stringify(message));
				} as typeof RTCDataChannel.prototype.send;
			});
			await connect(host, guest, true, false);
			await expect
				.poll(() =>
					messages.some((message) => message.includes('incompatible collaboration version'))
				)
				.toBe(true);
			await expect(title(host)).toHaveValue('Host private round');
			await expect(title(guest)).toHaveValue('Guest private round');
		} finally {
			await host.context().close();
			await guest.context().close();
		}
	});
}
