import { writeSpeechDrop } from '$lib/server/speechDrop';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SPEECHDROP_ORIGIN = 'https://speechdrop.net';

type SpeechDropFile = {
	index: number;
	name: string;
	ctime?: number;
};

export const prerender = false;

function validRoomId(roomId: string) {
	return ROOM_ID_PATTERN.test(roomId);
}

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { roomId } = params;
	if (!validRoomId(roomId)) {
		return json({ error: 'Invalid SpeechDrop room code.' }, { status: 400 });
	}

	try {
		const response = await fetch(`${SPEECHDROP_ORIGIN}/${encodeURIComponent(roomId)}/index`, {
			signal: AbortSignal.timeout(8000),
			redirect: 'error',
			headers: { accept: 'application/json' }
		});
		if (response.status === 404) {
			return json({ error: 'SpeechDrop room not found.' }, { status: 404 });
		}
		if (!response.ok) {
			return json({ error: 'SpeechDrop could not load this room.' }, { status: 502 });
		}

		const rawFiles: unknown = await response.json();
		if (!Array.isArray(rawFiles)) {
			return json({ error: 'SpeechDrop returned an invalid file list.' }, { status: 502 });
		}

		const files: SpeechDropFile[] = [];
		rawFiles.slice(0, 100).forEach((entry: unknown, index: number) => {
			if (typeof entry !== 'object' || entry === null) return;
			const file = entry as Record<string, unknown>;
			if (typeof file.name !== 'string' || file.name.length === 0 || file.name.length > 255) return;
			files.push({
				index,
				name: file.name,
				...(typeof file.ctime === 'number' && Number.isFinite(file.ctime)
					? { ctime: file.ctime }
					: {})
			});
		});

		return json({ files }, { headers: { 'cache-control': 'no-store' } });
	} catch {
		return json({ error: 'Could not connect to SpeechDrop. Please try again.' }, { status: 502 });
	}
};

export const POST: RequestHandler = async ({ params, request, fetch }) => {
	if (!validRoomId(params.roomId)) return json({ error: 'Invalid room code.' }, { status: 400 });
	if (Number(request.headers.get('content-length')) > 50 * 1024 * 1024 + 65536)
		return json({ error: 'Upload limit is 50 MB.' }, { status: 413 });
	try {
		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || !file.size || file.size > 50 * 1024 * 1024)
			return json({ error: 'Choose a file up to 50 MB.' }, { status: 400 });
		const body = new FormData();
		body.append('file', file, file.name);
		const response = await writeSpeechDrop(fetch, params.roomId, 'upload', body);
		if (!response.ok) return json({ error: 'SpeechDrop rejected the upload.' }, { status: 502 });
		return json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
	} catch {
		return json({ error: 'Could not upload to SpeechDrop.' }, { status: 502 });
	}
};
