// SpeechDrop uses signed double-submit tokens even though rooms have no accounts.
export async function writeSpeechDrop(
	fetcher: typeof fetch,
	room: string,
	action: 'upload' | 'delete',
	body: FormData | URLSearchParams
) {
	const tokenResponse = await fetcher('https://speechdrop.net/', {
		redirect: 'error',
		signal: AbortSignal.timeout(8000)
	});
	const cookies = tokenResponse.headers.getSetCookie();
	const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
	const token = cookies
		.map((value) => value.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1])
		.find(Boolean);
	if (!tokenResponse.ok || !token) throw new Error('Could not obtain a SpeechDrop upload token.');
	return fetcher(`https://speechdrop.net/${encodeURIComponent(room)}/${action}`, {
		method: 'POST',
		body,
		redirect: 'error',
		signal: AbortSignal.timeout(30000),
		headers: { cookie, 'X-XSRF-TOKEN': decodeURIComponent(token) }
	});
}
