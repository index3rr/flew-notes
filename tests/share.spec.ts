import { test, expect, firefox, type Browser } from '@playwright/test';
import QRCode from 'qrcode';
import { encodeSharingQr, decodeSharingQr } from '../src/lib/models/sharingQr';
import {
	sharingRoomId,
	sharingLocalOffer,
	fingerprintIceCredentials,
	preferredTlsRelay
} from '../src/lib/models/sharingIce';

async function installFakeQrCamera(
	page: import('@playwright/test').Page,
	rejectIceOverrides = false,
	forceRelay = false
) {
	await page.addInitScript(
		({ rejectIceOverrides, forceRelay }) => {
			if (forceRelay) {
				const setConfiguration = RTCPeerConnection.prototype.setConfiguration;
				RTCPeerConnection.prototype.setConfiguration = function (configuration) {
					return setConfiguration.call(this, { ...configuration, iceTransportPolicy: 'relay' });
				};
			}
			// These tests use the Promise overloads, not the deprecated callback API.
			const rtcPrototype = RTCPeerConnection.prototype as unknown as {
				createOffer(
					this: RTCPeerConnection,
					options?: RTCOfferOptions
				): Promise<RTCSessionDescriptionInit>;
				createAnswer(
					this: RTCPeerConnection,
					options?: RTCAnswerOptions
				): Promise<RTCSessionDescriptionInit>;
				setLocalDescription(
					this: RTCPeerConnection,
					description?: RTCLocalSessionDescriptionInit
				): Promise<void>;
			};
			if (rejectIceOverrides) {
				const originals = new WeakMap<RTCPeerConnection, string | undefined>();
				const createOffer = rtcPrototype.createOffer;
				const createAnswer = rtcPrototype.createAnswer;
				const setLocal = rtcPrototype.setLocalDescription;
				rtcPrototype.createOffer = async function (options) {
					const description = await createOffer.call(this, options);
					originals.set(this, description.sdp);
					return description;
				};
				rtcPrototype.createAnswer = async function (options) {
					const description = await createAnswer.call(this, options);
					originals.set(this, description.sdp);
					return description;
				};
				rtcPrototype.setLocalDescription = function (description) {
					if (description?.sdp != originals.get(this))
						return Promise.reject(
							new DOMException(
								'ICE credential overrides are disabled for this test',
								'InvalidModificationError'
							)
						);
					return setLocal.call(this, description);
				};
			}
			const setLocalForMeasurement = rtcPrototype.setLocalDescription;
			rtcPrototype.setLocalDescription = function (description) {
				Object.defineProperty(window, '__qrPeer', { configurable: true, value: this });
				return setLocalForMeasurement.call(this, description);
			};
			const canvas = document.createElement('canvas');
			canvas.width = 1024;
			canvas.height = 1024;
			const context = canvas.getContext('2d');
			if (context == null) throw new Error('Could not create fake camera canvas');
			let currentImage: HTMLImageElement | null = null;
			function drawCameraFrame() {
				if (context == null) return;
				context.fillStyle = 'white';
				context.fillRect(0, 0, canvas.width, canvas.height);
				if (currentImage) {
					const size = canvas.width * 0.9;
					context.drawImage(
						currentImage,
						(canvas.width - size) / 2,
						(canvas.height - size) / 2,
						size,
						size
					);
				}
			}
			drawCameraFrame();
			// A camera produces frames continuously. WebKit's media pipeline can
			// miss a single canvas repaint while video.play() is still starting.
			setInterval(drawCameraFrame, 100);
			Object.defineProperty(window, '__setFakeQrData', {
				value: (dataUrl: string) => {
					const image = new Image();
					image.onload = () => {
						currentImage = image;
						drawCameraFrame();
					};
					image.src = dataUrl;
				}
			});

			// Replace the mediaDevices getter itself so WebKit's scanner sees
			// the same virtual device object across asynchronous calls.
			Object.defineProperty(navigator, 'mediaDevices', {
				configurable: true,
				value: {
					enumerateDevices: async () => [
						{
							kind: 'videoinput',
							deviceId: 'fake-qr-camera',
							label: 'Fake QR camera',
							groupId: 'fake'
						}
					],
					getUserMedia: async () => canvas.captureStream(10)
				}
			});
		},
		{ rejectIceOverrides, forceRelay }
	);
}

test('share', async ({ context }) => {
	const hostPage = await context.newPage();
	await hostPage.goto('/app');
	await hostPage.getByRole('button', { name: 'New flow', exact: true }).click();
	await hostPage.getByPlaceholder('type name here').fill('test');
	await hostPage.getByPlaceholder('type name here').press('Enter');
	await hostPage.getByPlaceholder('type here').fill('test');
	await hostPage.locator('.addTab').getByRole('button', { name: 'neg', exact: true }).click();
	await hostPage.getByPlaceholder('type name here').fill('test 2');
	await hostPage.getByPlaceholder('type name here').press('Enter');
	await hostPage.getByPlaceholder('type here').fill('test 2');
	await hostPage.getByPlaceholder('type here').press('Shift+Enter');
	await hostPage
		.locator('.grid > .title, .grid > .flow')
		.getByRole('textbox')
		.nth(2)
		.fill('test 3');
	await hostPage
		.locator('.grid > .title, .grid > .flow')
		.getByRole('textbox')
		.nth(2)
		.press('ArrowLeft');
	await hostPage.locator('.sidebar .header .buttons div:nth-child(4) > .top').first().click();
	await hostPage.getByRole('button', { name: 'host new room' }).click();
	await hostPage.getByRole('button', { name: 'add guest' }).click();
	const joinLink = await hostPage.locator('.copyBox > .text').first().textContent();
	if (!joinLink) throw new Error('joinLink is null');
	expect(joinLink).toContain('/app?join=');

	const guestPage = await context.newPage();
	await guestPage.goto(joinLink);

	const confirmLink = await guestPage.locator('.copyBox > .text').first().textContent();
	if (!confirmLink) throw new Error('confirmLink is null');
	expect(confirmLink).toContain('/app?confirm=');

	const confirmPage = await context.newPage();
	await confirmPage.goto(confirmLink);

	await expect(guestPage.getByText('connected as guest 1')).toBeVisible();

	await expect(hostPage.getByText('connected to guest 1')).toBeVisible();

	// make flows are equal
	for (const page of [hostPage, guestPage]) {
		// close share modal
		await page.locator('.upper > .element > .top').click();

		// tabs
		await expect(page.getByRole('button', { name: 'test', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'test 2' })).toBeVisible();
		// first tab
		await page.getByRole('button', { name: 'test', exact: true }).click();
		await expect(page.getByPlaceholder('type here').first()).toHaveValue('test');
		// second tab
		await page.getByRole('button', { name: 'test 2' }).click();
		await expect(page.getByPlaceholder('type here').first()).toHaveValue('test 2');
		await expect(
			page.locator('.grid > .title, .grid > .flow').getByRole('textbox').nth(2)
		).toHaveValue('test 3');
	}
	// see if edits go both ways
	let i = 0;
	for (const [page, otherPage] of [
		[hostPage, guestPage],
		[guestPage, hostPage]
	]) {
		// add tab on page
		await page.locator('.addTab').getByRole('button', { name: 'aff', exact: true }).click();
		await page.getByPlaceholder('type name here').first().fill(`share test ${i}`);
		await page.getByPlaceholder('type name here').first().press('Enter');
		// check if otherPage has the new tab
		await expect(otherPage.getByRole('button', { name: `share test ${i}` })).toBeVisible();
		i += 1;
	}
});

async function verifyQrSharing(
	hostBrowser: Browser,
	guestBrowser: Browser,
	rejectIceOverrides = false,
	confirmationDelayMs = 0,
	forceRelay = false
) {
	// Separate devices cannot use shared localStorage or BroadcastChannel signaling.
	const hostContext = await hostBrowser.newContext();
	const guestContext = await guestBrowser.newContext();
	const hostPage = await hostContext.newPage();
	const guestPage = await guestContext.newPage();
	await installFakeQrCamera(hostPage, rejectIceOverrides, forceRelay);
	await installFakeQrCamera(guestPage, rejectIceOverrides, forceRelay);
	hostPage.on('pageerror', (error) => console.log('host page error:', error.stack));
	guestPage.on('pageerror', (error) => console.log('guest page error:', error.stack));
	guestPage.on('console', (message) => {
		if (message.type() == 'error') console.log('guest console error:', message.text());
	});

	for (const page of [hostPage, guestPage]) {
		await page.goto('http://localhost:4173/app');
		await page.locator('.sidebar .header .buttons div:nth-child(4) > .top').first().click();
		if (forceRelay)
			test.skip(
				await page.locator('.turnWarning').isVisible(),
				'Relay-only test needs the configured Metered TURN service.'
			);
		await page.getByRole('button', { name: 'QR code' }).click();
	}

	await hostPage.getByRole('button', { name: 'host new room' }).click();
	await hostPage.getByRole('button', { name: 'add guest' }).click();
	const hostQr = hostPage.locator('img[alt="QR code for this sharing link"]');
	await expect(hostQr).toBeVisible({ timeout: 30_000 });
	const hostQrData = await hostQr.getAttribute('src');
	if (hostQrData == null) throw new Error('Host QR image is missing its data URL');

	await guestPage.bringToFront();
	await guestPage.getByRole('button', { name: 'join room' }).click();
	await guestPage.evaluate((dataUrl) => {
		(window as typeof window & { __setFakeQrData: (dataUrl: string) => void }).__setFakeQrData(
			dataUrl
		);
	}, hostQrData);

	const guestQr = guestPage.locator('img[alt="QR code for this sharing link"]');
	try {
		await expect(guestQr).toBeVisible({ timeout: 30_000 });
	} catch (error) {
		console.log(
			'guest negotiation snapshot',
			await guestPage.evaluate(() => {
				const pc = (window as typeof window & { __qrPeer?: RTCPeerConnection }).__qrPeer;
				return pc
					? {
							gathering: pc.iceGatheringState,
							ice: pc.iceConnectionState,
							signaling: pc.signalingState,
							connection: pc.connectionState,
							candidates: pc.localDescription?.sdp.match(/^a=candidate:/gm)?.length
					  }
					: 'No local description was attempted';
			})
		);
		throw error;
	}
	const guestQrData = await guestQr.getAttribute('src');
	if (guestQrData == null) throw new Error('Guest confirm QR image is missing its data URL');

	const getLocalOffer = (page: import('@playwright/test').Page) =>
		page.evaluate(() =>
			JSON.stringify(
				(window as typeof window & { __qrPeer: RTCPeerConnection }).__qrPeer.localDescription
			)
		);
	const hostLocalOffer = sharingLocalOffer(JSON.parse(await getLocalOffer(hostPage)));
	const broadcastId = sharingRoomId(JSON.parse(hostLocalOffer).sdp);
	const hostKey = { localOffer: hostLocalOffer, broadcastId };
	const guestKey = {
		localOffer: sharingLocalOffer(JSON.parse(await getLocalOffer(guestPage))),
		broadcastId
	};
	const hostSdp = JSON.parse(hostLocalOffer).sdp;
	const derived = fingerprintIceCredentials(hostSdp);
	console.log(
		'Host wire credentials:',
		hostSdp.includes(`a=ice-pwd:${derived?.password}\r\n`) ? 'derived' : 'native',
		'fingerprint case:',
		/^[0-9A-F:]+$/.test(hostSdp.match(/^a=fingerprint:sha-256 ([^\r\n]+)/m)?.[1] ?? '')
			? 'uppercase'
			: 'other'
	);
	const enhance = async (page: import('@playwright/test').Page, key: typeof hostKey) => {
		const entries = await page.evaluate(async () =>
			Array.from(
				await (window as typeof window & { __qrPeer: RTCPeerConnection }).__qrPeer.getStats()
			)
		);
		return preferredTlsRelay(key, {
			getStats: async () => new Map(entries)
		} as unknown as RTCPeerConnection);
	};
	const readyHost = await enhance(hostPage, hostKey);
	const hostCode = encodeSharingQr(readyHost, undefined, true);
	const scannedHostKey = decodeSharingQr(hostCode, 'join');
	const readyGuest = scannedHostKey.qrRelayOnly ? await enhance(guestPage, guestKey) : guestKey;
	const guestCode = encodeSharingQr(readyGuest, scannedHostKey);
	console.log(
		`Real ${hostBrowser.browserType().name()} → ${guestBrowser.browserType().name()}${
			rejectIceOverrides ? ' fallback' : ''
		}: host ${hostCode.length} chars / ${
			QRCode.create(hostCode, { errorCorrectionLevel: 'L' }).modules.size
		} modules; guest ${guestCode.length} chars / ${
			QRCode.create(guestCode, { errorCorrectionLevel: 'L' }).modules.size
		} modules`
	);

	// Deliberate handoff delay: retain the photographed image, not the updated UI.
	if (confirmationDelayMs) await new Promise((resolve) => setTimeout(resolve, confirmationDelayMs));
	await hostPage.bringToFront();
	await hostPage.getByRole('button', { name: 'scan guest QR code' }).click();
	await hostPage.evaluate((dataUrl) => {
		(window as typeof window & { __setFakeQrData: (dataUrl: string) => void }).__setFakeQrData(
			dataUrl
		);
	}, guestQrData);

	try {
		await expect(guestPage.getByText('connected as guest 1')).toBeVisible({ timeout: 30_000 });
		await expect(hostPage.getByText('connected to guest 1')).toBeVisible({ timeout: 30_000 });
	} catch (error) {
		for (const [name, page] of [
			['host', hostPage],
			['guest', guestPage]
		] as const) {
			console.log(
				name,
				'QR failure',
				await page.locator('.error').allTextContents(),
				await page.evaluate(() => {
					const pc = (window as typeof window & { __qrPeer: RTCPeerConnection }).__qrPeer;
					const video = document.querySelector('video');
					return {
						ice: pc.iceConnectionState,
						connection: pc.connectionState,
						signaling: pc.signalingState,
						hasRemoteDescription: !!pc.remoteDescription,
						cameraState: video?.readyState,
						cameraWidth: video?.videoWidth
					};
				})
			);
		}
		throw error;
	}
	if (forceRelay) {
		for (const page of [hostPage, guestPage]) {
			const localType = await page.evaluate(async () => {
				const stats = await (
					window as typeof window & { __qrPeer: RTCPeerConnection }
				).__qrPeer.getStats();
				let pairId: string | undefined;
				stats.forEach((entry) => {
					if (entry.type == 'transport' && entry.selectedCandidatePairId)
						pairId = entry.selectedCandidatePairId;
				});
				let pair = pairId ? stats.get(pairId) : undefined;
				if (!pair)
					stats.forEach((entry) => {
						if (entry.type == 'candidate-pair' && entry.nominated && entry.state == 'succeeded')
							pair = entry;
					});
				return pair ? stats.get(pair.localCandidateId)?.candidateType : null;
			});
			expect(localType).toBe('relay');
		}
	}
	for (const page of [hostPage, guestPage]) await page.locator('.upper > .element > .top').click();
	for (const [page, partner, name] of [
		[hostPage, guestPage, 'QR host edit'],
		[guestPage, hostPage, 'QR guest edit']
	] as const) {
		if (
			await page.locator('.addTab').getByRole('button', { name: 'aff', exact: true }).isDisabled()
		)
			await page.getByRole('button', { name: 'New flow', exact: true }).click();
		else await page.locator('.addTab').getByRole('button', { name: 'aff', exact: true }).click();
		await page.getByPlaceholder('type name here').first().fill(name);
		await page.getByPlaceholder('type name here').first().press('Enter');
		await expect(partner.getByRole('button', { name, exact: true })).toBeVisible();
	}
	await hostContext.close();
	await guestContext.close();
}

for (const rejectIceOverrides of [false, true]) {
	test(`QR connection joins and confirms through the scanner flow${
		rejectIceOverrides ? ' when ICE overrides are rejected' : ''
	}`, async ({ browser }) => {
		test.setTimeout(90_000);
		await verifyQrSharing(browser, browser, rejectIceOverrides);
	});
}

for (const firefoxHosts of [false, true]) {
	test(`QR collaboration across Chromium and Firefox with ${
		firefoxHosts ? 'Firefox' : 'Chromium'
	} hosting`, async ({ browser, browserName }) => {
		test.skip(browserName != 'chromium', 'Run each mixed-browser combination once.');
		test.setTimeout(90_000);
		const firefoxBrowser = await firefox.launch();
		try {
			await verifyQrSharing(
				firefoxHosts ? firefoxBrowser : browser,
				firefoxHosts ? browser : firefoxBrowser
			);
		} finally {
			await firefoxBrowser.close();
		}
	});
}

test('QR mixed browser fallback with Firefox hosting', async ({ browser, browserName }) => {
	test.skip(browserName != 'chromium', 'Run mixed browser test once.');
	test.setTimeout(90_000);
	const firefoxBrowser = await firefox.launch();
	try {
		await verifyQrSharing(firefoxBrowser, browser, true);
	} finally {
		await firefoxBrowser.close();
	}
});

test('QR photographed reply still connects after a 35 second handoff', async ({
	browser,
	browserName
}) => {
	test.skip(browserName != 'chromium', 'Run this physical-handoff scenario once.');
	test.setTimeout(90_000);
	const firefoxBrowser = await firefox.launch();
	try {
		await verifyQrSharing(firefoxBrowser, browser, false, 35_000);
	} finally {
		await firefoxBrowser.close();
	}
});

test('QR relay-only pairing uses TURN without a LAN shortcut', async ({ browser, browserName }) => {
	test.skip(browserName != 'chromium', 'Run the mixed-browser relay scenario once.');
	test.setTimeout(90_000);
	const firefoxBrowser = await firefox.launch();
	try {
		await verifyQrSharing(firefoxBrowser, browser, false, 35_000, true);
	} finally {
		await firefoxBrowser.close();
	}
});
