import { expect, type Browser, type Page } from '@playwright/test';
declare global {
	interface Window {
		pauseEdits(): void;
		flushEdits(): void;
	}
}

export async function peer(browser: Browser) {
	const context = await browser.newContext();
	await context.addInitScript(() => {
		localStorage.setItem(
			'settings',
			JSON.stringify({
				version: 1,
				isSettings: true,
				settings: { showSideDoc: true, telemetry: 0 }
			})
		);
		const send = RTCDataChannel.prototype.send as (this: RTCDataChannel, data: string) => void;
		const queue: (() => void)[] = [];
		let paused = false;
		Object.assign(window, {
			pauseEdits() {
				paused = true;
			},
			flushEdits() {
				paused = false;
				for (const send of queue.splice(0)) send();
			}
		});
		RTCDataChannel.prototype.send = function (this: RTCDataChannel, data: string) {
			const transmit = () => send.call(this, data);
			if (paused && ['action', 'metadata'].includes(JSON.parse(data).tag)) queue.push(transmit);
			else transmit();
		} as typeof RTCDataChannel.prototype.send;
	});
	const page = await context.newPage();
	page.on('pageerror', (error) => {
		throw error;
	});
	await page.goto('/app');
	return page;
}
export async function sharing(page: Page) {
	await page.locator('.sidebar .header .buttons div:nth-child(4) > .top').first().click();
}
export async function connect(host: Page, guest: Page, first = true, expectConnected = true) {
	await sharing(host);
	await host.getByRole('button', { name: 'manual connect', exact: true }).click();
	if (first) await host.getByRole('button', { name: 'host new room' }).click();
	await host.getByRole('button', { name: 'add guest' }).click();
	const hostKey = host.locator('.panels > .panel').first().locator('.copyBox > .text');
	await expect(hostKey).toContainText('localOffer', { timeout: 20000 });
	await sharing(guest);
	await guest.getByRole('button', { name: 'manual connect', exact: true }).click();
	await guest.getByRole('button', { name: 'join room', exact: true }).click();
	await guest.locator('.copyBox textarea').fill((await hostKey.textContent())!);
	await guest.getByRole('button', { name: 'submit', exact: true }).click();
	const guestKey = guest.locator('.panels > .panel').nth(1).locator('.copyBox > .text');
	await expect(guestKey).toContainText('localOffer', { timeout: 20000 });
	await host.locator('.copyBox textarea').fill((await guestKey.textContent())!);
	await host.getByRole('button', { name: 'submit', exact: true }).click();
	if (!expectConnected) return;
	await expect(guest.getByText(/connected as guest/)).toBeVisible({ timeout: 20000 });
	await expect(guest.getByRole('button', { name: 'sync', exact: true })).toBeEnabled({
		timeout: 20000
	});
	for (const page of [host, guest]) await page.locator('.upper > .element > .top').click();
}
