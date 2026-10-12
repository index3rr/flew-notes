import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SPEECHDROP_ORIGIN = 'https://speechdrop.net';
const MEDIA_ORIGIN = 'https://media.speechdrop.net/uploads';
const MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024;

type SpeechDropFile = { name: string };

export const prerender = false;

function attachmentName(name: string) {
	const safeName = name.replace(/[\r\n"\\]/g, '_').replace(/[\/\\]/g, '_').slice(0, 255) || 'download';
	const fallback = safeName.replace(/[^\x20-\x7E]/g, '_');
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { roomId } = params;
	const fileIndex = Number(params.fileIndex);
	if (!ROOM_ID_PATTERN.test(roomId) || !Number.isSafeInteger(fileIndex) || fileIndex < 0 || fileIndex >= 100) {
		return json({ error: 'Invalid SpeechDrop file.' }, { status: 400 });
	}

	try {
		const indexResponse = await fetch(`${SPEECHDROP_ORIGIN}/${encodeURIComponent(roomId)}/index`, {
			signal: AbortSignal.timeout(8000),
			redirect: 'error',
			headers: { accept: 'application/json' }
		});
		if (!indexResponse.ok) {
			return json({ error: 'SpeechDrop room not found.' }, { status: indexResponse.status === 404 ? 404 : 502 });
		}
		const files: unknown = await indexResponse.json();
		if (!Array.isArray(files) || fileIndex >= files.length) {
			return json({ error: 'SpeechDrop file not found.' }, { status: 404 });
		}
		const file = files[fileIndex] as SpeechDropFile;
		if (!file || typeof file.name !== 'string' || file.name.length === 0 || file.name.length > 255) {
			return json({ error: 'SpeechDrop returned an invalid file.' }, { status: 502 });
		}

		const upstream = await fetch(
			`${MEDIA_ORIGIN}/${encodeURIComponent(roomId)}/${fileIndex}/${encodeURIComponent(file.name)}`,
			{ signal: AbortSignal.timeout(20000), redirect: 'error' }
		);
		if (!upstream.ok) {
			return json({ error: 'SpeechDrop could not download this file.' }, { status: 502 });
		}

		const contentLength = Number(upstream.headers.get('content-length'));
		if (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_SIZE) {
			return json({ error: 'This file is larger than the 50 MB download limit.' }, { status: 413 });
		}
		const data = await upstream.arrayBuffer();
		if (data.byteLength > MAX_DOWNLOAD_SIZE) {
			return json({ error: 'This file is larger than the 50 MB download limit.' }, { status: 413 });
		}

		return new Response(data, {
			headers: {
				'content-type': 'application/octet-stream',
				'content-disposition': attachmentName(file.name),
				'cache-control': 'no-store',
				'content-length': String(data.byteLength)
			}
		});
	} catch {
		return json({ error: 'Could not connect to SpeechDrop. Please try again.' }, { status: 502 });
	}
};
