import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { deflate } from 'pako';
import { encodeSharingQr, decodeSharingQr } from '../src/lib/models/sharingQr';
import {
	fingerprintIceCredentials,
	sharingRoomId,
	sharingLocalOffer,
	compactCandidateFoundations
} from '../src/lib/models/sharingIce';

function legacyQr(type: string, sdp: string, broadcastId: string) {
	const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
	const bytes = deflate(JSON.stringify([type, sdp, broadcastId]), { level: 9 });
	let result = 'FLEW1.';
	for (let index = 0; index < bytes.length; index += 2) {
		const pair = index + 1 < bytes.length;
		const value = pair ? bytes[index] * 256 + bytes[index + 1] : bytes[index];
		result += alphabet[value % 45] + alphabet[Math.floor(value / 45) % 45];
		if (pair) result += alphabet[Math.floor(value / 2025)];
	}
	return result;
}

function session(browser: 'Firefox' | 'Chrome', type: 'offer' | 'answer') {
	const fingerprint = Array.from(randomBytes(32), (byte) =>
		byte.toString(16).padStart(2, '0').toUpperCase()
	).join(':');
	const candidates = [
		`0 1 UDP 2122187007 ${randomUUID()}.local 44279 typ host`,
		`3 1 UDP 2122252543 ${randomUUID()}.local 33791 typ host`,
		`6 1 TCP 2105458943 ${randomUUID()}.local 9 typ host tcptype active`,
		`1 1 UDP 1685986303 104.28.162.64 35671 typ srflx raddr 0.0.0.0 rport 0`,
		`2 1 UDP 92150783 172.238.160.197 54505 typ relay raddr 0.0.0.0 rport 0`,
		`4 1 UDP 1686052607 2a09:bac5:822f:1b37::2b6:51 35280 typ srflx raddr 0.0.0.0 rport 0`,
		`1 1 UDP 1685985279 104.28.162.64 35489 typ srflx raddr 0.0.0.0 rport 0`,
		`2 1 UDP 92149759 172.238.160.197 41941 typ relay raddr 0.0.0.0 rport 0`,
		`7 1 UDP 8265727 172.238.160.197 33298 typ relay raddr 0.0.0.0 rport 0`,
		`7 1 UDP 8265727 172.238.160.197 59521 typ relay raddr 0.0.0.0 rport 0`
	];
	return [
		'v=0',
		`o=${
			browser == 'Firefox' ? 'mozilla...THIS_IS_SDPARTA-99.0' : '-'
		} 8127184520733962191 0 IN IP4 0.0.0.0`,
		's=-',
		't=0 0',
		'a=sendrecv',
		`a=fingerprint:sha-256 ${fingerprint}`,
		'a=group:BUNDLE 0',
		'a=ice-options:trickle',
		'a=msid-semantic:WMS *',
		'm=application 54505 UDP/DTLS/SCTP webrtc-datachannel',
		'c=IN IP4 172.238.160.197',
		...candidates.map((candidate) => 'a=candidate:' + candidate),
		'a=sendrecv',
		'a=end-of-candidates',
		`a=ice-pwd:${randomBytes(browser == 'Firefox' ? 16 : 18).toString(
			browser == 'Firefox' ? 'hex' : 'base64'
		)}`,
		'a=ice-ufrag:c2d284a3',
		'a=mid:0',
		`a=setup:${type == 'offer' ? 'actpass' : 'active'}`,
		'a=sctp-port:5000',
		'a=max-message-size:1073741823',
		''
	].join('\r\n');
}

test('compact QR preserves all SDP and reduces actual QR module count', ({ browserName }) => {
	test.skip(browserName != 'chromium', 'Pure codec test needs to run only once.');
	for (const browser of ['Firefox', 'Chrome'] as const) {
		for (const type of ['offer', 'answer'] as const) {
			const sdp = session(browser, type);
			const broadcastId = randomUUID();
			const key = { localOffer: JSON.stringify({ type, sdp }), broadcastId };
			const encoded = encodeSharingQr(key);
			const legacy = legacyQr(type, sdp, broadcastId);
			const kind = type == 'offer' ? 'join' : 'confirm';
			expect(decodeSharingQr(encoded, kind)).toEqual(key);
			expect(decodeSharingQr(legacy, kind)).toEqual(key);
			const oldCode = QRCode.create(legacy, { errorCorrectionLevel: 'L' });
			const newCode = QRCode.create(encoded, { errorCorrectionLevel: 'L' });
			console.log(
				`${browser} ${type}: ${legacy.length} → ${encoded.length} characters; QR ${oldCode.modules.size} → ${newCode.modules.size} modules`
			);
			expect(encoded.length).toBeLessThan(legacy.length * 0.4);
			expect(newCode.version).toBeLessThan(oldCode.version);
			expect(() => decodeSharingQr(encoded, kind == 'join' ? 'confirm' : 'join')).toThrow();
		}
	}
});

test('compact QR preserves arbitrary attributes and Unicode, and rejects truncation', ({
	browserName
}) => {
	test.skip(browserName != 'chromium', 'Pure codec test needs to run only once.');
	for (let index = 0; index < 32; index++) {
		const sdp =
			session('Firefox', 'offer') +
			'a=unknown:00012 18446744073709551615 18446744073709551616 001.002.003.004 ' +
			':: ::1 1:: 2001:0db8::0001 fe80::1234:5678:abcd:ef00 FE80::ABCD ' +
			'é🦊'.repeat(index * 3) +
			'\r\n';
		const key = { localOffer: JSON.stringify({ type: 'offer', sdp }), broadcastId: randomUUID() };
		const encoded = encodeSharingQr(key);
		expect(decodeSharingQr(encoded, 'join')).toEqual(key);
		expect(() => decodeSharingQr(encoded.slice(0, -12), 'join')).toThrow();
	}
});

test('derived ICE and offer context shrink both QR codes without losing credentials', ({
	browserName
}) => {
	test.skip(browserName != 'chromium', 'Pure codec test needs to run only once.');
	for (const browser of ['Firefox', 'Chrome'] as const) {
		const originalOffer = session(browser, 'offer');
		const derive = (sdp: string) => {
			const credentials = fingerprintIceCredentials(sdp)!;
			expect(credentials.password).toHaveLength(22);
			expect(credentials.ufrag).toHaveLength(4);
			return sdp
				.replace(/^a=ice-pwd:[^\r\n]+/gm, `a=ice-pwd:${credentials.password}`)
				.replace(/^a=ice-ufrag:[^\r\n]+/gm, `a=ice-ufrag:${credentials.ufrag}`);
		};
		const offerSdp = derive(originalOffer);
		const broadcastId = sharingRoomId(offerSdp);
		const hostKey = {
			broadcastId,
			localOffer: sharingLocalOffer({ type: 'offer', sdp: offerSdp })
		};
		const guestKey = {
			broadcastId,
			localOffer: sharingLocalOffer({ type: 'answer', sdp: derive(session(browser, 'answer')) })
		};
		const before = encodeSharingQr({
			broadcastId: randomUUID(),
			localOffer: JSON.stringify({ type: 'offer', sdp: originalOffer })
		});
		const offer = encodeSharingQr(hostKey);
		const standaloneAnswer = encodeSharingQr(guestKey);
		const answer = encodeSharingQr(guestKey, hostKey);
		expect(decodeSharingQr(offer, 'join')).toEqual(hostKey);
		expect(decodeSharingQr(answer, 'confirm', hostKey)).toEqual(guestKey);
		expect(offer.length).toBeLessThan(before.length);
		expect(answer.length).toBeLessThan(standaloneAnswer.length);
		expect(answer.startsWith('F3+')).toBe(true);
		expect(() => decodeSharingQr(answer, 'confirm')).toThrow('matching host room');
		expect(() =>
			decodeSharingQr(answer, 'confirm', { ...hostKey, broadcastId: randomUUID() })
		).toThrow('different room');
		expect(() =>
			decodeSharingQr(answer, 'confirm', {
				...hostKey,
				localOffer: JSON.stringify({ type: 'offer', sdp: originalOffer })
			})
		).toThrow('different room');
		console.log(
			`${browser}: previous ${before.length}, derived host ${offer.length}, guest standalone ${
				standaloneAnswer.length
			}, contextual guest ${answer.length}; grids ${
				QRCode.create(offer, { errorCorrectionLevel: 'L' }).modules.size
			} / ${QRCode.create(answer, { errorCorrectionLevel: 'L' }).modules.size}`
		);
		// A browser that rejects credential munging can still use the smaller room ID format.
		const native = {
			broadcastId: sharingRoomId(originalOffer),
			localOffer: JSON.stringify({ type: 'offer', sdp: originalOffer })
		};
		expect(decodeSharingQr(encodeSharingQr(native), 'join')).toEqual(native);
	}
});

test('candidate aliases preserve every route and the original foundation groups', ({
	browserName
}) => {
	test.skip(browserName != 'chromium', 'Pure metadata test needs to run only once.');
	const sdp = session('Chrome', 'offer').replace(
		/^a=candidate:(\d+)/gm,
		(_, id) => `a=candidate:${Number(id) + 3000000000}`
	);
	const compact = compactCandidateFoundations(sdp);
	const routes = (value: string) => value.replace(/^a=candidate:[^ ]+/gm, 'a=candidate:_');
	expect(routes(compact)).toEqual(routes(sdp));
	const foundations = (value: string) =>
		Array.from(value.matchAll(/^a=candidate:([^ ]+) /gm), (match) => match[1]);
	const oldIds = foundations(sdp);
	const newIds = foundations(compact);
	expect(newIds.length).toEqual(oldIds.length);
	for (let first = 0; first < oldIds.length; first++) {
		for (let second = 0; second < oldIds.length; second++)
			expect(newIds[first] == newIds[second]).toBe(oldIds[first] == oldIds[second]);
	}
	expect(compact.length).toBeLessThan(sdp.length);
	expect(compactCandidateFoundations(compact)).toEqual(compact);
});

test('priority packing retains every preference bit and opaque SDP numbers', ({ browserName }) => {
	test.skip(browserName != 'chromium', 'Pure codec test needs to run only once.');
	const preferences = [0, 5, 100, 110, 126];
	for (const prefix of preferences) {
		for (const local of [0, 1, 5000, 32768, 65535]) {
			const priority = prefix * 16777216 + local * 256 + 255;
			const sdp = session('Chrome', 'offer').replace(
				/(a=candidate:[^ ]+ 1 UDP )\d+/g,
				`$1${priority}`
			);
			const key = { broadcastId: randomUUID(), localOffer: JSON.stringify({ type: 'offer', sdp }) };
			expect(decodeSharingQr(encodeSharingQr(key), 'join')).toEqual(key);
		}
	}
});

test('minimal relay QR retains an actual endpoint and supports full-answer fallback', ({
	browserName
}) => {
	test.skip(browserName != 'chromium', 'Pure codec test needs to run only once.');
	const original = session('Chrome', 'offer');
	const credentials = fingerprintIceCredentials(original)!;
	const sdp = original
		.replace(/^a=ice-pwd:[^\r\n]+/gm, `a=ice-pwd:${credentials.password}`)
		.replace(/^a=ice-ufrag:[^\r\n]+/gm, `a=ice-ufrag:${credentials.ufrag}`);
	const full = {
		broadcastId: sharingRoomId(sdp),
		localOffer: sharingLocalOffer({ type: 'offer', sdp })
	};
	const qrRelayCandidate = JSON.parse(full.localOffer)
		.sdp.split('\r\n')
		.find((line: string) => /^a=candidate:.* typ relay\b/.test(line));
	const hostKey = { ...full, qrRelayCandidate };
	const code = encodeSharingQr(hostKey, undefined, true);
	const scanned = decodeSharingQr(code, 'join');
	expect(code).toMatch(/^F6:/);
	expect(code.length).toBe(68);
	// Even byte mode cannot fit a full fingerprint plus a dynamic port in version 2.
	expect(() =>
		QRCode.create([{ data: Buffer.alloc(34), mode: 'byte' }], {
			version: 2,
			errorCorrectionLevel: 'L'
		})
	).toThrow();
	expect(QRCode.create(code, { errorCorrectionLevel: 'L' }).modules.size).toBe(29);
	expect(scanned.broadcastId).toBe(hostKey.broadcastId);
	const endpoint = qrRelayCandidate.split(' ').slice(4, 6).join(' ');
	expect(JSON.parse(scanned.localOffer).sdp).toContain(endpoint);
	expect(() => decodeSharingQr(code.slice(0, -3), 'join')).toThrow();
	expect(() => decodeSharingQr(code, 'confirm', hostKey)).toThrow();
	const guestKey = {
		broadcastId: full.broadcastId,
		localOffer: sharingLocalOffer({ type: 'answer', sdp: session('Firefox', 'answer') })
	};
	const answer = encodeSharingQr(guestKey, scanned);
	expect(decodeSharingQr(answer, 'confirm', hostKey)).toEqual(guestKey);
	expect(
		JSON.parse(decodeSharingQr(answer, 'confirm', hostKey).localOffer).sdp.match(/^a=candidate:/gm)
	).toHaveLength(10);
	const guestCandidate = JSON.parse(guestKey.localOffer)
		.sdp.split('\r\n')
		.find((line: string) => /^a=candidate:.* typ relay\b/.test(line));
	const answerSdp = JSON.parse(guestKey.localOffer).sdp;
	const answerCredentials = fingerprintIceCredentials(answerSdp)!;
	const compactGuest = {
		...guestKey,
		localOffer: sharingLocalOffer({
			type: 'answer',
			sdp: answerSdp
				.replace(/^a=ice-pwd:[^\r\n]+/gm, `a=ice-pwd:${answerCredentials.password}`)
				.replace(/^a=ice-ufrag:[^\r\n]+/gm, `a=ice-ufrag:${answerCredentials.ufrag}`)
		}),
		qrRelayCandidate: guestCandidate
	};
	const reply = encodeSharingQr(compactGuest, scanned);
	expect(reply).toMatch(/^F6:/);
	expect(reply.length).toBe(74);
	expect(QRCode.create(reply, { errorCorrectionLevel: 'L' }).modules.size).toBe(29);
	expect(() =>
		decodeSharingQr(reply, 'confirm', { ...hostKey, broadcastId: 'another room' })
	).toThrow();
	const futureKey = {
		...hostKey,
		localOffer: hostKey.localOffer.replace('a=mid:0', 'a=future:test\\r\\na=mid:0')
	};
	expect(encodeSharingQr(futureKey, undefined, true)).toMatch(/^F5:/);
	expect(
		JSON.parse(decodeSharingQr(reply, 'confirm', hostKey).localOffer).sdp.match(/^a=candidate:/gm)
	).toHaveLength(1);
	console.log(
		`Minimal TLS relay: host ${code.length} chars / ${
			QRCode.create(code, { errorCorrectionLevel: 'L' }).modules.size
		} modules; reply ${reply.length} chars / ${
			QRCode.create(reply, { errorCorrectionLevel: 'L' }).modules.size
		} modules`
	);
});
