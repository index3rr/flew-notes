import { test, expect } from '@playwright/test';
import { writeSpeechDrop } from '../src/lib/server/speechDrop';

test('SpeechDrop writes forward a fresh signed cookie and matching CSRF header', async () => {
	const calls: { url: string; init?: RequestInit }[] = [];
	const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ url: String(input), init });
		return calls.length === 1
			? new Response('', { headers: { 'set-cookie': 'XSRF-TOKEN=signed%3Atoken; Path=/; Secure' } })
			: new Response('[]');
	};
	const body = new URLSearchParams({ fileIndex: '2' });
	await writeSpeechDrop(fetcher as typeof fetch, 'roomAB', 'delete', body);
	expect(calls[1].url).toBe('https://speechdrop.net/roomAB/delete');
	expect(calls[1].init?.body).toBe(body);
	expect(calls[1].init?.headers).toEqual({
		cookie: 'XSRF-TOKEN=signed%3Atoken',
		'X-XSRF-TOKEN': 'signed:token'
	});
});

test('SpeechDrop does not write when token acquisition fails', async () => {
	let calls = 0;
	await expect(
		writeSpeechDrop(
			(async () => {
				calls++;
				return new Response('', { status: 503 });
			}) as typeof fetch,
			'roomAB',
			'upload',
			new FormData()
		)
	).rejects.toThrow('token');
	expect(calls).toBe(1);
});
