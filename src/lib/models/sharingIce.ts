function fingerprintBytes(sdp: string): number[] | null {
	const fingerprint = /^a=fingerprint:sha-256 ([0-9a-f:]+)\r?$/im.exec(sdp)?.[1];
	if (fingerprint == null || !/^(?:[0-9a-f]{2}:){31}[0-9a-f]{2}$/i.test(fingerprint)) return null;
	return fingerprint.split(':').map((value) => parseInt(value, 16));
}

/** Values derived from the fresh certificate's SHA-256 fingerprint. */
export function fingerprintIceCredentials(sdp: string): { ufrag: string; password: string } | null {
	const bytes = fingerprintBytes(sdp);
	if (bytes == null) return null;
	const base64 = (values: number[]) => btoa(String.fromCharCode(...values)).replace(/=+$/, '');
	return { password: base64(bytes.slice(0, 16)), ufrag: base64(bytes.slice(16, 19)) };
}

export function fingerprintSessionId(sdp: string): string | null {
	const bytes = fingerprintBytes(sdp);
	if (bytes == null) return null;
	let id = 0n;
	for (const byte of bytes.slice(19, 27)) id = (id << 8n) | BigInt(byte);
	return (id & 0x7fffffffffffffffn).toString();
}

export function compactCandidateFoundations(sdp: string): string {
	const ids = Array.from(sdp.matchAll(/^a=candidate:([^ ]+) /gm), (match) => match[1]);
	if (ids.every((id) => id.length <= 2)) return sdp;
	const aliases = new Map<string, string>();
	return sdp.replace(/^a=candidate:([^ ]+)(?= )/gm, (_, foundation: string) => {
		if (!aliases.has(foundation)) aliases.set(foundation, aliases.size.toString(36));
		return `a=candidate:${aliases.get(foundation)}`;
	});
}

export function sharingLocalOffer(description: RTCSessionDescriptionInit | null): string {
	if (description?.sdp == null) throw new Error('The local session description is not ready.');
	let sdp = compactCandidateFoundations(description.sdp);
	sdp = sdp.replace(
		/^(a=fingerprint:sha-256 )([0-9a-f:]+)/gim,
		(_, prefix: string, hash: string) => prefix.toLowerCase() + hash.toUpperCase()
	);
	const sessionId = fingerprintSessionId(sdp);
	// o= is signaling identity/version metadata; transport credentials and routes
	// stay intact. This ID stays stable for this certificate across renegotiations.
	if (sessionId != null) sdp = sdp.replace(/^o=(\S+) \d+ /m, `o=$1 ${sessionId} `);
	return JSON.stringify({ type: description.type, sdp });
}

export function sharingRoomId(sdp: string): string {
	const password = /^a=ice-pwd:([^\r\n]+)\r?$/m.exec(sdp)?.[1];
	if (!password) throw new Error('The session description has no ICE password.');
	// The password already supplies a fresh identifier for this connection.
	return `a=ice-pwd:${password}`;
}

export async function setSharingLocalDescription(
	pc: RTCPeerConnection,
	description: RTCSessionDescriptionInit
) {
	const credentials = fingerprintIceCredentials(description.sdp ?? '');
	if (credentials == null) return pc.setLocalDescription(description);
	const compact = {
		type: description.type,
		sdp: description
			.sdp!.replace(/^a=ice-pwd:[^\r\n]+/gm, `a=ice-pwd:${credentials.password}`)
			.replace(/^a=ice-ufrag:[^\r\n]+/gm, `a=ice-ufrag:${credentials.ufrag}`)
	};
	try {
		await pc.setLocalDescription(compact);
	} catch {
		// Some engines enforce the original createOffer/createAnswer credentials.
		// Their ordinary descriptions remain fully supported by the QR codec.
		await pc.setLocalDescription(description);
	}
}

export async function preferredTlsRelay<Key extends { localOffer: string; broadcastId: string }>(
	key: Key,
	pc: RTCPeerConnection
): Promise<Key & { qrRelayCandidate?: string }> {
	// TLS hides TURN control/data from packet filters. If it is unavailable or
	// statistics do not identify a live allocation, keep the complete description.
	let stats: RTCStatsReport;
	try {
		stats = await pc.getStats();
	} catch {
		return key;
	}
	const candidates: { address: string; port: number; priority: number }[] = [];
	stats.forEach((entry) => {
		if (
			entry.type == 'local-candidate' &&
			entry.candidateType == 'relay' &&
			!entry.deleted &&
			(entry.relayProtocol == 'tls' || entry.url?.startsWith('turns:')) &&
			typeof entry.address == 'string' &&
			!entry.address.includes(':')
		) {
			candidates.push({ address: entry.address, port: entry.port, priority: entry.priority ?? 0 });
		}
	});
	const lines = JSON.parse(key.localOffer).sdp.split('\r\n') as string[];
	for (const candidate of candidates.sort((a, b) => b.priority - a.priority)) {
		const line = lines.find((line) => {
			const match = /^a=candidate:[^ ]+ \d+ UDP \d+ ([^ ]+) (\d+) typ relay\b/i.exec(line);
			return match?.[1] == candidate.address && Number(match?.[2]) == candidate.port;
		});
		if (line) return { ...key, qrRelayCandidate: line };
	}
	return key;
}
