import { test, expect, type Page } from '@playwright/test';

import { peer, connect, sharing } from './helpers/collaboration';

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
