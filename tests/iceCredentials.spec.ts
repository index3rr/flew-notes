import { test, expect } from '@playwright/test';

test('probe whether ICE credential overrides actually establish a data channel', async ({
	page,
	browserName
}) => {
	test.setTimeout(90_000);
	await page.goto('/app');
	const results = await page.evaluate(async () => {
		const results: { change: string; result: string }[] = [];
		for (const change of [
			'control',
			'offer ufrag',
			'offer password',
			'offer both',
			'answer both'
		]) {
			const host = new RTCPeerConnection({ iceServers: [] });
			const guest = new RTCPeerConnection({ iceServers: [] });
			const channel = host.createDataChannel('credential-probe');
			const opened = new Promise<boolean>((resolve) => {
				channel.onopen = () => resolve(true);
				setTimeout(() => resolve(false), 5_000);
			});
			const gather = (pc: RTCPeerConnection) =>
				new Promise<void>((resolve) => {
					if (pc.iceGatheringState == 'complete') return resolve();
					pc.addEventListener('icegatheringstatechange', () => {
						if (pc.iceGatheringState == 'complete') resolve();
					});
					setTimeout(resolve, 2_000);
				});
			const modify = (description: RTCSessionDescriptionInit, side: 'offer' | 'answer') => ({
				type: description.type,
				sdp: description
					.sdp!.replace(
						/a=ice-ufrag:[^\r\n]+/g,
						change.startsWith(side) && !change.endsWith('password') ? 'a=ice-ufrag:tiny' : '$&'
					)
					.replace(
						/a=ice-pwd:[^\r\n]+/g,
						change.startsWith(side) && !change.endsWith('ufrag')
							? 'a=ice-pwd:abcdefghijklmnopqrstuv'
							: '$&'
					)
			});
			try {
				const hostDescription = modify(await host.createOffer(), 'offer');
				await host.setLocalDescription(hostDescription);
				for (const name of ['ice-ufrag', 'ice-pwd']) {
					const pattern = new RegExp(`a=${name}:[^\\r\\n]+`);
					if (
						hostDescription.sdp.match(pattern)?.[0] !=
						host.localDescription!.sdp.match(pattern)?.[0]
					)
						throw new Error('Browser ignored the host credential override');
				}
				await gather(host);
				await guest.setRemoteDescription(host.localDescription!);
				const guestDescription = modify(await guest.createAnswer(), 'answer');
				await guest.setLocalDescription(guestDescription);
				for (const name of ['ice-ufrag', 'ice-pwd']) {
					const pattern = new RegExp(`a=${name}:[^\\r\\n]+`);
					if (
						guestDescription.sdp.match(pattern)?.[0] !=
						guest.localDescription!.sdp.match(pattern)?.[0]
					)
						throw new Error('Browser ignored the guest credential override');
				}
				await gather(guest);
				await host.setRemoteDescription(guest.localDescription!);
				results.push({
					change,
					result: (await opened) ? 'connected' : 'accepted SDP but did not connect'
				});
			} catch (error) {
				results.push({
					change,
					result: error instanceof Error ? `${error.name}: ${error.message}` : String(error)
				});
			} finally {
				host.close();
				guest.close();
			}
		}
		return results;
	});
	console.log(browserName, JSON.stringify(results, null, 2));
	expect(results.find((result) => result.change == 'control')?.result).toBe('connected');
});
