import { writable } from 'svelte/store';
import { settings } from './settings';
type Ready = { worker: Worker; model?: string; device?: string };
export const speechModelState = writable<{
	status: 'idle' | 'loading' | 'ready' | 'error';
	label: string;
	error: string;
	progress?: number;
}>({ status: 'idle', label: '', error: '' });
let model: number | null = null;
let worker: Worker | undefined;
let pending: Promise<Ready> | null = null;
let rejectPending: ((error: Error) => void) | null = null;
export async function loadSpeechModel(
	choice = Number(settings.data.transcriptModel.value)
): Promise<Ready> {
	if (pending && worker && choice === model) return pending;
	rejectPending?.(new Error('Speech model selection changed.'));
	worker?.terminate();
	worker = undefined;
	pending = null;
	rejectPending = null;
	model = choice;
	const current = new Worker(new URL('./transcript.worker.ts', import.meta.url), {
		type: 'module'
	});
	worker = current;
	speechModelState.set({ status: 'loading', label: '', error: '' });
	pending = new Promise<Ready>((resolve, reject) => {
		rejectPending = reject;
		current.onerror = () => fail('Could not load the speech model.');
		const downloads = new Map<string, { loaded: number; total: number }>();
		current.onmessage = (event) => {
			if (worker !== current) return;
			const data = event.data.progress;
			if (data?.file && data.total) {
				downloads.set(data.file, { loaded: data.loaded ?? 0, total: data.total });
				const values = [...downloads.values()];
				speechModelState.set({
					status: 'loading',
					label: '',
					error: '',
					progress: Math.round(
						(values.reduce((n, file) => n + file.loaded, 0) /
							values.reduce((n, file) => n + file.total, 0)) *
							100
					)
				});
			}
			if (event.data.error) fail(String(event.data.error));
			else if (event.data.ready) {
				rejectPending = null;
				current.onmessage = null;
				current.onerror = null;
				speechModelState.set({ status: 'ready', label: event.data.model ?? '', error: '' });
				resolve({ worker: current, model: event.data.model, device: event.data.device });
			}
		};
		function fail(message: string) {
			if (worker === current) {
				pending = null;
				rejectPending = null;
				speechModelState.set({ status: 'error', label: '', error: message });
			}
			reject(new Error(message));
		}
		current.postMessage({ model: choice });
	});
	return pending;
}
export function releaseSpeechModel(current: Worker | undefined) {
	if (current && current === worker) {
		current.onmessage = null;
		current.onerror = null;
	}
}
export function preloadSelectedSpeechModel() {
	let selected = Number(settings.data.transcriptModel.value);
	return settings.subscribe(['transcriptModel'], () => {
		const next = Number(settings.data.transcriptModel.value);
		if (next !== selected) {
			selected = next;
			void loadSpeechModel(next).catch(() => undefined);
		}
	});
}
