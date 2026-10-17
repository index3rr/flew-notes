const fallbackIceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

let iceServersPromise: Promise<RTCIceServer[]> | null = null;

export function hasTurnServerConfigured() {
	return Boolean(
		import.meta.env.VITE_METERED_APP_NAME?.trim() &&
			import.meta.env.VITE_METERED_TURN_API_KEY?.trim()
	);
}

export function getIceServers(): Promise<RTCIceServer[]> {
	if (iceServersPromise != null) return iceServersPromise;

	const appName = import.meta.env.VITE_METERED_APP_NAME?.trim();
	const apiKey = import.meta.env.VITE_METERED_TURN_API_KEY?.trim();
	if (!appName || !apiKey) return Promise.resolve(fallbackIceServers);

	const url = `https://${encodeURIComponent(
		appName
	)}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
	iceServersPromise = fetch(url)
		.then(async (response) => {
			if (!response.ok) throw new Error(`TURN credentials request failed (${response.status})`);
			const turnServers: unknown = await response.json();
			if (
				!Array.isArray(turnServers) ||
				!turnServers.every(
					(server) =>
						typeof server == 'object' &&
						server != null &&
						'urls' in server &&
						(typeof server.urls == 'string' || Array.isArray(server.urls))
				)
			) {
				throw new Error('TURN credentials response was not an ICE server list');
			}
			return [...fallbackIceServers, ...(turnServers as RTCIceServer[])];
		})
		.catch((error: unknown) => {
			iceServersPromise = null;
			throw error;
		});

	return iceServersPromise;
}
