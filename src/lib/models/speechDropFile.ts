export type SpeechDropFile = { room: string; index: number; name: string; ctime?: number };
const maxDocumentBytes = 50 * 1024 * 1024;
let cached: { file: SpeechDropFile; blob: Blob } | null = null;
export function clearSpeechDropFile() {
	cached = null;
}
export function cacheSpeechDropFile(file: SpeechDropFile, blob: Blob) {
	cached = { file, blob };
}
export async function readSpeechDropFile(
	file: SpeechDropFile,
	signal?: AbortSignal
): Promise<Blob> {
	const saved = cached;
	if (
		saved &&
		(['room', 'index', 'name', 'ctime'] as const).every((key) => saved.file[key] === file[key])
	)
		return saved.blob;
	const response = await fetch(`/api/speechdrop/${encodeURIComponent(file.room)}/${file.index}`, {
		signal
	});
	if (!response.ok) throw new Error('Could not load speech document.');
	if (Number(response.headers.get('content-length')) > maxDocumentBytes)
		throw new Error('This document exceeds the 50 MB limit.');
	const blob = await response.blob();
	if (blob.size > maxDocumentBytes) throw new Error('This document exceeds the 50 MB limit.');
	if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
	cacheSpeechDropFile(file, blob);
	return blob;
}
