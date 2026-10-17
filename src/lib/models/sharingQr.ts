import { deflateRaw, inflateRaw, inflate } from 'pako';
import { fingerprintIceCredentials, sharingRoomId, fingerprintSessionId } from './sharingIce';

type SharingKey = {
	localOffer: string;
	broadcastId: string;
	qrRelayCandidate?: string;
	qrRelayOnly?: boolean;
};

const QR_PREFIX = 'FLEW1.';
const BASE45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

// F2's dictionary is part of the wire format. Both peers get it with the static
// app; changing it requires a new format version. No signaling service is used.
const COMPACT_PREFIX = 'F2:';
const DERIVED_PREFIX = 'F3:';
const CONTEXT_PREFIX = 'F3+';
const MINIMAL_RELAY_PREFIX = 'F5:';
const MINIMAL_RELAY_CONTEXT_PREFIX = 'F5+';
const PRIORITY_PREFIXES = [126, 100, 0, 5, 110];
const SDP_PHRASES = [
	'v=0\r\no=mozilla...THIS_IS_SDPARTA-99.0 ',
	' IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n',
	'o=- ',
	' 2 IN IP4 127.0.0.1\r\n',
	'a=sendrecv\r\n',
	'a=group:BUNDLE 0\r\n',
	'a=ice-options:trickle\r\n',
	'a=msid-semantic:WMS *\r\n',
	'a=msid-semantic: WMS\r\n',
	'a=extmap-allow-mixed\r\n',
	'm=application ',
	' UDP/DTLS/SCTP webrtc-datachannel\r\n',
	'c=IN IP4 ',
	'a=candidate:',
	' 1 UDP ',
	' 1 udp ',
	' 1 TCP ',
	' typ host',
	' typ srflx raddr 0.0.0.0 rport 0',
	' typ relay raddr 0.0.0.0 rport 0',
	' tcptype active',
	' generation 0 network-cost 999',
	'.local ',
	'a=end-of-candidates\r\n',
	'a=ice-pwd:',
	'a=ice-ufrag:',
	'a=mid:0\r\n',
	'a=setup:actpass\r\n',
	'a=setup:active\r\n',
	'a=sctp-port:5000\r\n',
	'a=max-message-size:1073741823\r\n',
	'a=max-message-size:262144\r\n',
	'a=fingerprint:sha-256 ',
	'2122187007',
	'2122252543',
	'2105458943',
	'1685986303',
	'92150783',
	'1686052607',
	'1685985279',
	'92149759',
	'8265727',
	'2113937151',
	'2113939711',
	'1677729535',
	'1677732095',
	'50340607',
	'50340095',
	'16785919',
	'\r\n',
	' typ srflx raddr ',
	' typ relay raddr ',
	' rport ',
	' generation 0',
	' network-id ',
	' network-cost ',
	'a=ice-options:trickle renomination\r\n',
	' ',
	'0',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	' 0 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n',
	'c=IN IP4 0.0.0.0\r\n',
	'a=candidate:0 1 UDP 2122187007 ',
	'a=candidate:3 1 UDP 2122252543 ',
	'a=candidate:6 1 TCP 2105458943 ',
	'a=candidate:8 1 TCP 2105524479 ',
	'a=candidate:1 1 UDP 1685986303 ',
	'a=candidate:1 1 UDP 1685987327 ',
	'a=candidate:1 1 UDP 1685986815 ',
	'a=candidate:1 1 UDP 1685985279 ',
	'a=candidate:2 1 UDP 92150783 ',
	'a=candidate:2 1 UDP 92149759 ',
	'a=candidate:4 1 UDP 1686052607 ',
	'a=candidate:7 1 UDP 8265727 '
];
const PHRASE_PATTERN = new RegExp(
	[...SDP_PHRASES]
		.sort((a, b) => b.length - a.length)
		.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.join('|'),
	'g'
);
const DICTIONARY_TEXT = SDP_PHRASES.join('');
// Static grammar examples improve matches in the separated structure stream.
// Documentation addresses and zero credentials are dictionary training only.
const TRAINING_TEXT = [
	'00000000-0000-4000-8000-000000000000',
	'v=0',
	'o=mozilla...THIS_IS_SDPARTA-99.0 8127184520733962191 0 IN IP4 0.0.0.0',
	's=-',
	't=0 0',
	'a=sendrecv',
	'a=fingerprint:sha-256 ' + Array(32).fill('00').join(':'),
	'a=group:BUNDLE 0',
	'a=ice-options:trickle',
	'a=msid-semantic:WMS *',
	'm=application 50123 UDP/DTLS/SCTP webrtc-datachannel',
	'c=IN IP4 203.0.113.1',
	'a=candidate:0 1 UDP 2122187007 00000000-0000-4000-8000-000000000000.local 50123 typ host',
	'a=candidate:3 1 UDP 2122252543 00000000-0000-4000-8000-000000000000.local 50123 typ host',
	'a=candidate:6 1 TCP 2105458943 00000000-0000-4000-8000-000000000000.local 9 typ host tcptype active',
	'a=candidate:1 1 UDP 1685986303 198.51.100.1 50123 typ srflx raddr 0.0.0.0 rport 0',
	'a=candidate:2 1 UDP 92150783 203.0.113.1 50123 typ relay raddr 0.0.0.0 rport 0',
	'a=candidate:7 1 UDP 8265727 203.0.113.1 50123 typ relay raddr 0.0.0.0 rport 0',
	'a=candidate:4 1 UDP 1686052607 2001:db8::1 50123 typ srflx raddr 0.0.0.0 rport 0',
	'a=sendrecv',
	'a=end-of-candidates',
	'a=ice-pwd:00000000000000000000000000000000',
	'a=ice-ufrag:00000000',
	'a=mid:0',
	'a=setup:actpass',
	'a=sctp-port:5000',
	'a=max-message-size:1073741823',
	''
].join('\r\n');
const SDP_DICTIONARY = Uint8Array.from([
	...new TextEncoder().encode(DICTIONARY_TEXT),
	...packText(TRAINING_TEXT, true),
	...splitPacked(packText(TRAINING_TEXT, true))
]);

function formatIpv6(bytes: Uint8Array): string {
	const groups = Array.from(
		{ length: 8 },
		(_, index) => bytes[index * 2] * 256 + bytes[index * 2 + 1]
	);
	let start = -1;
	let length = 1;
	for (let index = 0; index < 8; ) {
		if (groups[index] != 0) {
			index++;
			continue;
		}
		const from = index;
		while (index < 8 && groups[index] == 0) index++;
		if (index - from > length) {
			start = from;
			length = index - from;
		}
	}
	const hex = groups.map((group) => group.toString(16));
	return start < 0
		? hex.join(':')
		: hex.slice(0, start).join(':') + '::' + hex.slice(start + length).join(':');
}

function parseIpv6(value: string): number[] | null {
	const halves = value.split('::');
	if (halves.length > 2) return null;
	const left = halves[0] ? halves[0].split(':') : [];
	const right = halves.length == 2 && halves[1] ? halves[1].split(':') : [];
	const count = left.length + right.length;
	if (halves.length == 1 ? count != 8 : count >= 8) return null;
	const groups = [...left, ...Array(8 - count).fill('0'), ...right];
	if (groups.some((group) => !/^[a-f0-9]{1,4}$/.test(group))) return null;
	const bytes = groups.flatMap((group) => {
		const number = parseInt(group, 16);
		return [number >> 8, number & 255];
	});
	return formatIpv6(Uint8Array.from(bytes)) == value ? bytes : null;
}

// Literal blocks are 1..127 bytes. Higher tags encode exact textual forms of
// high-entropy fields that deflate alone cannot compress efficiently.
function packText(value: string, tokens = false, compactPriorities = false): Uint8Array {
	const result: number[] = [];
	const rawLiteral = (text: string) => {
		const bytes = new TextEncoder().encode(text);
		for (let offset = 0; offset < bytes.length; ) {
			let end = Math.min(offset + 127, bytes.length);
			while (end < bytes.length && (bytes[end] & 0xc0) == 0x80) end--;
			const block = bytes.subarray(offset, end);
			result.push(block.length, ...block);
			offset = end;
		}
	};
	const literal = (text: string) => {
		if (!tokens) return rawLiteral(text);
		let offset = 0;
		for (const match of text.matchAll(PHRASE_PATTERN)) {
			rawLiteral(text.slice(offset, match.index));
			result.push(138 + SDP_PHRASES.indexOf(match[0]));
			offset = match.index! + match[0].length;
		}
		rawLiteral(text.slice(offset));
	};
	const fields =
		/[0-9A-F]{2}(?::[0-9A-F]{2}){31}|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}|[a-f0-9]{32}|(?<=a=ice-ufrag:)[a-f0-9]{8}|(?<![a-f0-9:])(?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}(?![a-f0-9:])|(?<=a=ice-pwd:)[A-Za-z0-9+/]{16,256}|(?<![0-9])\d{4,20}(?![0-9])|(?:\d{1,3}\.){3}\d{1,3}/g;
	let offset = 0;
	for (const match of value.matchAll(fields)) {
		const field = match[0];
		let tag: number;
		let bytes: number[];
		if (tokens && (SDP_PHRASES.includes(field) || field == '0.0.0.0')) continue;
		if (field.includes(':')) {
			if (/^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/.test(field)) {
				tag = 128;
				bytes = field.split(':').map((byte) => parseInt(byte, 16));
			} else {
				const address = parseIpv6(field);
				if (address == null) continue;
				tag = 137;
				bytes = address;
			}
		} else if (field.includes('-')) {
			tag = 129;
			bytes = field
				.replaceAll('-', '')
				.match(/../g)!
				.map((byte) => parseInt(byte, 16));
		} else if (/^[a-f0-9]{32}$/.test(field) || /^[a-f0-9]{8}$/.test(field)) {
			tag = field.length == 8 ? 136 : 130;
			bytes = field.match(/../g)!.map((byte) => parseInt(byte, 16));
		} else if (/^\d{4,20}$/.test(field)) {
			let number = BigInt(field);
			if (number > 0xffffffffffffffffn || number.toString() != field) continue;
			// Let complete static SDP attributes use a single phrase token.
			if (tokens && /a=(sctp-port|max-message-size):$/.test(value.slice(0, match.index))) continue;
			const prefix =
				compactPriorities && (number & 255n) == 255n
					? PRIORITY_PREFIXES.indexOf(Number(number >> 24n))
					: -1;
			if (prefix >= 0) {
				tag = 250 + prefix;
				number = (number >> 8n) & 65535n;
				bytes = Array(2).fill(0);
			} else {
				tag = number <= 0xffffn ? 134 : number <= 0xffffffffn ? 135 : 131;
				bytes = Array(tag == 134 ? 2 : tag == 135 ? 4 : 8).fill(0);
			}
			for (let index = bytes.length - 1; index >= 0; index--) {
				bytes[index] = Number(number & 255n);
				number >>= 8n;
			}
		} else if (field.includes('.')) {
			tag = 132;
			bytes = field.split('.').map(Number);
			if (bytes.some((byte) => byte > 255) || bytes.join('.') != field) continue;
		} else {
			// Pack only canonical, unpadded base64; arbitrary ICE passwords stay literal.
			try {
				const binary = atob(field);
				if (btoa(binary).replace(/=+$/, '') != field) continue;
				bytes = Array.from(binary, (byte) => byte.charCodeAt(0));
			} catch {
				continue;
			}
			tag = 133;
			bytes.unshift(bytes.length);
		}
		literal(value.slice(offset, match.index));
		result.push(tag, ...bytes);
		offset = match.index! + field.length;
	}
	literal(value.slice(offset));
	return Uint8Array.from(result);
}

function packedPriority(tag: number): boolean {
	return tag >= 250 && tag < 255;
}

function fieldLength(tag: number): number {
	if (packedPriority(tag)) return 2;
	if (tag == 128) return 32;
	if (tag == 129 || tag == 130 || tag == 137) return 16;
	if (tag == 131) return 8;
	if (tag == 132 || tag == 135 || tag == 136) return 4;
	if (tag == 134) return 2;
	throw new Error('The sharing QR code is invalid.');
}

// Separate the repetitive SDP structure from random credentials/addresses.
// Deflate can then match entire candidate structures across their random fields.
function splitPacked(bytes: Uint8Array): Uint8Array {
	const structure: number[] = [];
	const fields: number[] = [];
	for (let offset = 0; offset < bytes.length; ) {
		const tag = bytes[offset++];
		structure.push(tag);
		if (tag < 128) {
			structure.push(...bytes.subarray(offset, offset + tag));
			offset += tag;
		} else if (tag < 138 || packedPriority(tag)) {
			const length = tag == 133 ? bytes[offset++] : fieldLength(tag);
			if (tag == 133) structure.push(length);
			fields.push(...bytes.subarray(offset, offset + length));
			offset += length;
		}
	}
	if (structure.length > 65535) throw new Error('The sharing key is too large for a QR code.');
	return Uint8Array.from([structure.length >> 8, structure.length & 255, ...structure, ...fields]);
}

function joinPacked(bytes: Uint8Array): Uint8Array {
	const end = 2 + (bytes[0] * 256 + bytes[1]);
	if (bytes.length < 2 || end > bytes.length) throw new Error('The sharing QR code is invalid.');
	const result: number[] = [];
	let fieldOffset = end;
	for (let offset = 2; offset < end; ) {
		const tag = bytes[offset++];
		result.push(tag);
		if (tag < 128) {
			if (tag == 0 || offset + tag > end) throw new Error('The sharing QR code is invalid.');
			result.push(...bytes.subarray(offset, offset + tag));
			offset += tag;
		} else if (tag < 138 || packedPriority(tag)) {
			if (tag == 133 && offset >= end) throw new Error('The sharing QR code is invalid.');
			const length = tag == 133 ? bytes[offset++] : fieldLength(tag);
			if (tag == 133) result.push(length);
			if (fieldOffset + length > bytes.length) throw new Error('The sharing QR code is invalid.');
			result.push(...bytes.subarray(fieldOffset, fieldOffset + length));
			fieldOffset += length;
		}
	}
	if (fieldOffset != bytes.length) throw new Error('The sharing QR code is invalid.');
	return Uint8Array.from(result);
}

function unpackText(bytes: Uint8Array, compactPriorities = false): string {
	let result = '';
	for (let offset = 0; offset < bytes.length; ) {
		const tag = bytes[offset++];
		if (packedPriority(tag)) {
			if (!compactPriorities || offset + 2 > bytes.length)
				throw new Error('The sharing QR code is invalid.');
			const localPreference = bytes[offset++] * 256 + bytes[offset++];
			result += String(PRIORITY_PREFIXES[tag - 250] * 16777216 + localPreference * 256 + 255);
			continue;
		}
		if (tag >= 138) {
			const phrase = SDP_PHRASES[tag - 138];
			if (phrase == undefined) throw new Error('The sharing QR code is invalid.');
			result += phrase;
			continue;
		}
		const length = tag < 128 ? tag : tag == 133 ? bytes[offset++] : fieldLength(tag);
		if (tag == 0 || tag > 137 || !Number.isInteger(length) || offset + length > bytes.length) {
			throw new Error('The sharing QR code is invalid.');
		}
		const block = bytes.subarray(offset, offset + length);
		offset += length;
		if (tag < 128) result += new TextDecoder('utf-8', { fatal: true }).decode(block);
		else if (tag == 128)
			result += Array.from(block, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(
				':'
			);
		else if (tag == 129) {
			const hex = Array.from(block, (byte) => byte.toString(16).padStart(2, '0')).join('');
			result += `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
				16,
				20
			)}-${hex.slice(20)}`;
		} else if (tag == 137) result += formatIpv6(block);
		else if (tag == 130 || tag == 136)
			result += Array.from(block, (byte) => byte.toString(16).padStart(2, '0')).join('');
		else if (tag == 131 || tag == 134 || tag == 135) {
			let number = 0n;
			for (const byte of block) number = (number << 8n) | BigInt(byte);
			result += number.toString();
		} else if (tag == 132) result += Array.from(block).join('.');
		else result += btoa(String.fromCharCode(...block)).replace(/=+$/, '');
	}
	return result;
}

function toBase45(bytes: Uint8Array): string {
	let result = '';
	for (let index = 0; index < bytes.length; index += 2) {
		const hasSecondByte = index + 1 < bytes.length;
		// Base45 encodes a byte pair as a 16-bit value, but an unpaired
		// final byte is encoded directly as a single byte value.
		let value = hasSecondByte ? bytes[index] * 256 + bytes[index + 1] : bytes[index];
		const low = value % 45;
		value = Math.floor(value / 45);
		const middle = value % 45;
		value = Math.floor(value / 45);
		result += BASE45[low] + BASE45[middle];
		if (hasSecondByte) result += BASE45[value];
	}
	return result;
}

function fromBase45(value: string, recoverLegacyTrailingByte = false): Uint8Array {
	if (value.length % 3 == 1) throw new Error('The sharing QR code is invalid.');
	const bytes: number[] = [];
	for (let index = 0; index < value.length; ) {
		const remaining = value.length - index;
		const groupSize = remaining >= 3 ? 3 : 2;
		const low = BASE45.indexOf(value[index++]);
		const middle = BASE45.indexOf(value[index++]);
		const high = groupSize == 3 ? BASE45.indexOf(value[index++]) : 0;
		if (low < 0 || middle < 0 || high < 0) throw new Error('The sharing QR code is invalid.');
		const decoded = low + middle * 45 + high * 2025;
		if (groupSize == 2 && recoverLegacyTrailingByte) {
			// Older builds encoded an unpaired byte as byte * 256, then omitted
			// the third Base45 digit. Recover that byte so already-shared QR codes
			// from those builds remain readable.
			let recoveredByte = -1;
			for (let byte = 0; byte <= 0xff; byte++) {
				if ((byte * 256) % 2025 == decoded) {
					recoveredByte = byte;
					break;
				}
			}
			if (recoveredByte < 0) throw new Error('The sharing QR code is invalid.');
			bytes.push(recoveredByte);
			continue;
		}
		if (decoded > (groupSize == 3 ? 0xffff : 0xff)) {
			throw new Error('The sharing QR code is invalid.');
		}
		if (groupSize == 3) bytes.push(decoded >> 8);
		bytes.push(decoded & 0xff);
	}
	return Uint8Array.from(bytes);
}

export function minimalRelayQrKey(key: SharingKey): SharingKey {
	const description = JSON.parse(key.localOffer);
	const line =
		key.qrRelayCandidate ??
		(key.qrRelayOnly
			? description.sdp
					.split('\r\n')
					.find((line: string) => /^a=candidate:.* typ relay\b/.test(line))
			: undefined);
	if (!line) return key;
	const endpoint = /^a=candidate:[^ ]+ \d+ UDP \d+ ([^ ]+) (\d+) typ relay\b/i.exec(line);
	if (!endpoint || !description.sdp.split('\r\n').includes(line))
		throw new Error('The relay candidate is not in this connection.');
	description.sdp = description.sdp
		.replace(
			/^a=(?:candidate:[^\r\n]*|remote-candidates:[^\r\n]*|end-of-candidates)(?:\r?\n|$)/gm,
			''
		)
		.replace(/^m=application \d+ /gm, `m=application ${endpoint[2]} `)
		.replace(/^c=IN IP[46] [^\r\n]+/gm, `c=IN IP4 ${endpoint[1]}`);
	if (!description.sdp.endsWith('\r\n')) description.sdp += '\r\n';
	description.sdp += line + '\r\n';
	return {
		broadcastId: key.broadcastId,
		localOffer: JSON.stringify(description),
		qrRelayOnly: true
	};
}

// F6 is a fixed data-channel template. It is used only for fingerprint-derived
// credentials and a verified single relay endpoint; other descriptions use F5.
function tinyRelayQr(key: SharingKey, hostKey?: SharingKey): string | null {
	if (!key.qrRelayOnly) return null;
	const { type, sdp } = JSON.parse(key.localOffer);
	const credentials = fingerprintIceCredentials(sdp);
	if (
		sdp.match(/^m=/gm)?.length != 1 ||
		!sdp.includes(`a=setup:${type == 'answer' ? 'active' : 'actpass'}\r\n`)
	)
		return null;
	if (
		!credentials ||
		!sdp.includes(`a=ice-pwd:${credentials.password}\r\n`) ||
		!sdp.includes(`a=ice-ufrag:${credentials.ufrag}\r\n`)
	)
		return null;
	if (!/^a=mid:0\r?$/m.test(sdp) || !/^a=sctp-port:5000\r?$/m.test(sdp)) return null;
	const size = /^a=max-message-size:(262144|1073741823)\r?$/m.exec(sdp)?.[1];
	const fingerprint = /^a=fingerprint:sha-256 ([0-9A-F:]{95})\r?$/m.exec(sdp)?.[1];
	const candidate =
		/^a=candidate:[^ ]+ 1 UDP (\d+) ((?:\d+\.){3}\d+) (\d+) typ relay[^\r\n]*\r?$/im.exec(sdp);
	if (!size || !fingerprint || !candidate || (type == 'answer' && !hostKey)) return null;
	// Unknown negotiated attributes must remain available to the full codec.
	const known =
		/^(?:v=|o=|s=|t=|m=|c=|a=(?:sendrecv|fingerprint:|group:BUNDLE 0|ice-options:trickle(?: renomination)?|msid-semantic:|extmap-allow-mixed|candidate:|ice-pwd:|ice-ufrag:|mid:0|setup:|sctp-port:5000|max-message-size:))/;
	if (sdp.split('\r\n').some((line: string) => line && !known.test(line))) return null;
	const bytes = new Uint8Array(type == 'answer' ? 47 : 43);
	bytes[0] = (type == 'answer' ? 1 : 0) | (size == '262144' ? 2 : 0);
	bytes.set(
		fingerprint.split(':').map((part: string) => parseInt(part, 16)),
		1
	);
	bytes.set(candidate[2].split('.').map(Number), 33);
	const view = new DataView(bytes.buffer);
	view.setUint16(37, Number(candidate[3]));
	view.setUint32(39, Number(candidate[1]));
	if (hostKey) {
		// Bind replies to the photographed host code, even when its SDP template differs.
		if (type == 'answer')
			bytes.set(
				contextTag({ localOffer: JSON.stringify({ sdp: '' }), broadcastId: hostKey.broadcastId }),
				43
			);
	}
	return 'F6:' + toBase45(bytes);
}

function readTinyRelay(value: string, kind: 'join' | 'confirm', hostKey?: SharingKey): SharingKey {
	const bytes = fromBase45(value.slice(3));
	if (bytes.length != 43 && bytes.length != 47) throw new Error('The sharing QR code is invalid.');
	const answer = !!(bytes[0] & 1);
	if (bytes[0] > 3 || bytes.length != (answer ? 47 : 43) || answer != (kind == 'confirm'))
		throw new Error('This is not a Flew Notes ' + kind + ' QR code.');
	if (answer) {
		if (!hostKey) throw new Error('Scan the host room code before its confirmation.');
		const tag = contextTag({
			localOffer: JSON.stringify({ sdp: '' }),
			broadcastId: hostKey.broadcastId
		});
		if (tag.some((byte, i) => byte != bytes[43 + i]))
			throw new Error('This confirm code belongs to a different room.');
	}
	const fingerprint = Array.from(bytes.slice(1, 33), (byte) =>
		byte.toString(16).padStart(2, '0').toUpperCase()
	).join(':');
	const address = Array.from(bytes.slice(33, 37)).join('.');
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const port = view.getUint16(37);
	if (!port) throw new Error('The sharing QR code is invalid.');
	let sdp = [
		'v=0',
		'o=- 0 0 IN IP4 0.0.0.0',
		's=-',
		't=0 0',
		'a=group:BUNDLE 0',
		`m=application ${port} UDP/DTLS/SCTP webrtc-datachannel`,
		`c=IN IP4 ${address}`,
		`a=fingerprint:sha-256 ${fingerprint}`,
		'a=mid:0',
		`a=setup:${answer ? 'active' : 'actpass'}`,
		'a=sctp-port:5000',
		`a=max-message-size:${bytes[0] & 2 ? 262144 : 1073741823}`,
		`a=candidate:0 1 UDP ${view.getUint32(39)} ${address} ${port} typ relay raddr 0.0.0.0 rport 0`,
		''
	].join('\r\n');
	const credentials = fingerprintIceCredentials(sdp)!;
	sdp += `a=ice-pwd:${credentials.password}\r\na=ice-ufrag:${credentials.ufrag}\r\n`;
	return {
		localOffer: JSON.stringify({ type: answer ? 'answer' : 'offer', sdp }),
		broadcastId: answer ? hostKey!.broadcastId : sharingRoomId(sdp),
		qrRelayOnly: true
	};
}

function compactIce(sdp: string): { sdp: string; flag: number } {
	let flag = 0;
	const credentials = fingerprintIceCredentials(sdp);
	if (
		credentials != null &&
		sdp.includes(`a=ice-pwd:${credentials.password}\r\n`) &&
		sdp.includes(`a=ice-ufrag:${credentials.ufrag}\r\n`)
	) {
		sdp = sdp
			.replaceAll(`a=ice-pwd:${credentials.password}\r\n`, 'a=ice-pwd:~\r\n')
			.replaceAll(`a=ice-ufrag:${credentials.ufrag}\r\n`, 'a=ice-ufrag:~\r\n');
		flag |= 8;
	}
	const sessionId = fingerprintSessionId(sdp);
	if (sessionId != null && /^o=\S+ (\d+) /m.exec(sdp)?.[1] == sessionId) {
		sdp = sdp.replace(/^o=(\S+) \d+ /m, 'o=$1 ~ ');
		flag |= 32;
	}
	return { sdp, flag };
}

function expandIce(sdp: string): string {
	const credentials = fingerprintIceCredentials(sdp);
	if (credentials == null) throw new Error('The sharing QR code is invalid.');
	return sdp
		.replaceAll('a=ice-pwd:~\r\n', `a=ice-pwd:${credentials.password}\r\n`)
		.replaceAll('a=ice-ufrag:~\r\n', `a=ice-ufrag:${credentials.ufrag}\r\n`);
}

function offerDictionary(key: SharingKey): Uint8Array {
	const sdp = compactIce(JSON.parse(key.localOffer).sdp).sdp;
	return Uint8Array.from([
		...SDP_DICTIONARY,
		...new TextEncoder().encode(sdp),
		...packText(sdp, true),
		...splitPacked(packText(sdp, true)),
		...packText(sdp, true, true),
		...splitPacked(packText(sdp, true, true))
	]);
}

function contextTag(key: SharingKey): Uint8Array {
	let hash = 2166136261;
	for (const byte of new TextEncoder().encode(
		key.broadcastId + '\n' + JSON.parse(key.localOffer).sdp
	)) {
		hash = Math.imul(hash ^ byte, 16777619) >>> 0;
	}
	return Uint8Array.from([hash >>> 24, (hash >>> 16) & 255, (hash >>> 8) & 255, hash & 255]);
}

export function encodeSharingQr(
	key: SharingKey,
	hostKey?: SharingKey,
	minimalRelay = false
): string {
	if (minimalRelay || (hostKey?.qrRelayOnly && key.qrRelayCandidate)) key = minimalRelayQrKey(key);
	const tiny = tinyRelayQr(key, hostKey);
	if (tiny) return tiny;
	const relayOnly = key.qrRelayOnly == true;
	const description = JSON.parse(key.localOffer);
	if (
		!description ||
		!['offer', 'answer'].includes(description.type) ||
		typeof description.sdp != 'string' ||
		key.broadcastId.includes('\n')
	) {
		throw new Error('The sharing key did not contain a valid session description.');
	}
	const compact = compactIce(description.sdp);
	let autoRoom = false;
	try {
		autoRoom = description.type == 'offer' && key.broadcastId == sharingRoomId(description.sdp);
	} catch {
		/* Legacy IDs remain supported. */
	}
	const contexts: {
		prefix: string;
		dictionary: Uint8Array;
		tag: Uint8Array;
		omitRoom: boolean;
		priorities: boolean;
	}[] = [
		{
			prefix: relayOnly
				? MINIMAL_RELAY_PREFIX
				: compact.flag || autoRoom
				? DERIVED_PREFIX
				: COMPACT_PREFIX,
			dictionary: SDP_DICTIONARY,
			tag: new Uint8Array(),
			omitRoom: autoRoom,
			priorities: false
		}
	];
	contexts.push({
		...contexts[0],
		prefix: relayOnly ? MINIMAL_RELAY_PREFIX : DERIVED_PREFIX,
		priorities: true
	});
	if (description.type == 'answer' && hostKey?.broadcastId == key.broadcastId) {
		const referenceKeys = hostKey.qrRelayOnly
			? [{ prefix: MINIMAL_RELAY_CONTEXT_PREFIX, key: minimalRelayQrKey(hostKey) }]
			: [{ prefix: CONTEXT_PREFIX, key: hostKey }];
		for (const reference of referenceKeys) {
			contexts.push({
				prefix: reference.prefix,
				dictionary: offerDictionary(reference.key),
				tag: contextTag(reference.key),
				omitRoom: true,
				priorities: false
			});
			contexts.push({ ...contexts[contexts.length - 1], priorities: true });
		}
	}
	let smallest = '';
	for (const context of contexts) {
		const text = context.omitRoom ? compact.sdp : `${key.broadcastId}\n${compact.sdp}`;
		for (const mode of [0, 2, 4, 6]) {
			const packed =
				mode != 0 ? packText(text, mode >= 4, context.priorities) : new TextEncoder().encode(text);
			const body = mode == 6 ? splitPacked(packed) : packed;
			const payload = Uint8Array.from([
				(description.type == 'answer' ? 1 : 0) |
					mode |
					compact.flag |
					(context.omitRoom ? 16 : 0) |
					(context.priorities ? 64 : 0),
				...body
			]);
			for (const strategy of [0, 4]) {
				const compressed = deflateRaw(payload, {
					level: 9,
					dictionary: context.dictionary,
					strategy
				});
				const code = context.prefix + toBase45(Uint8Array.from([...context.tag, ...compressed]));
				if (!smallest || code.length < smallest.length) smallest = code;
			}
		}
	}
	return smallest;
}

export function decodeSharingQr(
	value: string,
	kind: 'join' | 'confirm',
	hostKey?: SharingKey
): SharingKey {
	let decoded: unknown;
	if (value.startsWith('F6:')) return readTinyRelay(value, kind, hostKey);
	if (
		[
			COMPACT_PREFIX,
			DERIVED_PREFIX,
			CONTEXT_PREFIX,
			MINIMAL_RELAY_PREFIX,
			MINIMAL_RELAY_CONTEXT_PREFIX
		].some((prefix) => value.startsWith(prefix))
	) {
		const contextual =
			value.startsWith(CONTEXT_PREFIX) || value.startsWith(MINIMAL_RELAY_CONTEXT_PREFIX);
		let bytes = fromBase45(value.slice(3));
		if (contextual) {
			if (kind != 'confirm' || hostKey == null)
				throw new Error('Scan this confirm code from the matching host room.');
			if (value.startsWith(MINIMAL_RELAY_CONTEXT_PREFIX)) {
				const reduced = minimalRelayQrKey(hostKey);
				const tag = contextTag(reduced);
				if (tag.every((byte, index) => bytes[index] == byte)) hostKey = reduced;
				else {
					const tiny = tinyRelayQr(reduced);
					hostKey = minimalRelayQrKey(tiny ? readTinyRelay(tiny, 'join') : reduced);
				}
			}
			const tag = contextTag(hostKey);
			if (!tag.every((byte, index) => bytes[index] == byte))
				throw new Error('This confirm code belongs to a different room.');
			bytes = bytes.subarray(4);
		}
		const payload = inflateRaw(bytes, {
			dictionary: contextual ? offerDictionary(hostKey!) : SDP_DICTIONARY
		});
		if (!payload || payload.length < 2 || payload[0] > (value.startsWith(COMPACT_PREFIX) ? 7 : 127))
			throw new Error('The sharing QR code is invalid.');
		const type = (payload[0] & 1) == 0 ? 'offer' : 'answer';
		if (type != (kind == 'join' ? 'offer' : 'answer'))
			throw new Error(
				`This code contains a WebRTC ${type}, not a ${kind == 'join' ? 'offer' : 'answer'}.`
			);
		const body = payload.subarray(1);
		const text =
			(payload[0] & 6) != 0
				? unpackText((payload[0] & 6) == 6 ? joinPacked(body) : body, (payload[0] & 64) != 0)
				: new TextDecoder('utf-8', { fatal: true }).decode(body);
		const omittedRoom = (payload[0] & 16) != 0;
		const separator = omittedRoom ? -1 : text.indexOf('\n');
		if (!omittedRoom && separator < 1) throw new Error('The sharing QR code is invalid.');
		let sdp = omittedRoom ? text : text.slice(separator + 1);
		if ((payload[0] & 8) != 0) sdp = expandIce(sdp);
		if ((payload[0] & 32) != 0) {
			const sessionId = fingerprintSessionId(sdp);
			if (sessionId == null) throw new Error('The sharing QR code is invalid.');
			sdp = sdp.replace(/^o=(\S+) ~ /m, `o=$1 ${sessionId} `);
		}
		const broadcastId = omittedRoom
			? contextual
				? hostKey!.broadcastId
				: sharingRoomId(sdp)
			: text.slice(0, separator);
		decoded = {
			broadcastId,
			localOffer: JSON.stringify({ type, sdp }),
			...(value.startsWith(MINIMAL_RELAY_PREFIX) ||
			(value.startsWith(MINIMAL_RELAY_CONTEXT_PREFIX) && sdp.match(/^a=candidate:/gm)?.length == 1)
				? { qrRelayOnly: true }
				: {})
		};
	} else if (value.startsWith(QR_PREFIX)) {
		const encoded = value.slice(QR_PREFIX.length);
		let compact: unknown;
		try {
			compact = JSON.parse(new TextDecoder().decode(inflate(fromBase45(encoded))));
		} catch (error) {
			try {
				compact = JSON.parse(new TextDecoder().decode(inflate(fromBase45(encoded, true))));
			} catch {
				throw error;
			}
		}
		if (
			!Array.isArray(compact) ||
			compact.length != 3 ||
			typeof compact[0] != 'string' ||
			typeof compact[1] != 'string' ||
			typeof compact[2] != 'string'
		) {
			throw new Error('The sharing QR code is invalid.');
		}
		const expectedType = kind == 'join' ? 'offer' : 'answer';
		if (compact[0] != expectedType) {
			throw new Error(`This code contains a WebRTC ${compact[0]}, not a ${expectedType}.`);
		}
		decoded = {
			localOffer: JSON.stringify({ type: compact[0], sdp: compact[1] }),
			broadcastId: compact[2]
		};
	} else {
		const url = new URL(value, location.href);
		const raw = url.searchParams.get(kind);
		if (raw == null) throw new Error(`This is not a Flew Notes ${kind} QR code.`);
		decoded = JSON.parse(raw);
	}

	if (
		typeof decoded != 'object' ||
		decoded == null ||
		!('localOffer' in decoded) ||
		typeof decoded.localOffer != 'string' ||
		!('broadcastId' in decoded) ||
		typeof decoded.broadcastId != 'string'
	) {
		throw new Error(`The ${kind} QR code is invalid.`);
	}
	const description: unknown = JSON.parse(decoded.localOffer);
	if (
		typeof description != 'object' ||
		description == null ||
		!('type' in description) ||
		description.type != (kind == 'join' ? 'offer' : 'answer')
	) {
		throw new Error(`This is not a valid Flew Notes ${kind} code.`);
	}
	return decoded as SharingKey;
}
