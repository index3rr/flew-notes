/// <reference lib="webworker" />
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
env.allowLocalModels = false;

// Model choices, indexed by the transcriptModel setting (0 = automatic).
type Choice = 'fast' | 'balanced' | 'accurate' | 'best';
const models: Record<Choice, { id: string; multilingual: boolean; label: string }> = {
	fast: { id: 'onnx-community/whisper-tiny.en', multilingual: false, label: 'Fast' },
	balanced: { id: 'onnx-community/whisper-base.en', multilingual: false, label: 'Balanced' },
	accurate: { id: 'onnx-community/whisper-small.en', multilingual: false, label: 'Accurate' },
	best: { id: 'onnx-community/whisper-large-v3-turbo', multilingual: true, label: 'Best' }
};

let transcriber: AutomaticSpeechRecognitionPipeline | undefined;
let loaded: { choice: Choice; device: 'webgpu' | 'wasm' } | undefined;

async function gpu(): Promise<{ f16: boolean } | null> {
	const nav = self.navigator as Navigator & {
		gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> };
	};
	try {
		const adapter = await nav.gpu?.requestAdapter();
		return adapter ? { f16: adapter.features.has('shader-f16') } : null;
	} catch {
		return null;
	}
}

function progress(event: { status?: string; file?: string; loaded?: number; total?: number }) {
	if (event.status === 'progress' && event.total)
		self.postMessage({ progress: { file: event.file, loaded: event.loaded, total: event.total } });
}

async function load(setting: number) {
	const webgpu = await gpu();
	const choices: Choice[] = ['fast', 'balanced', 'accurate', 'best'];
	let choice: Choice = choices[setting - 1] ?? (webgpu?.f16 ? 'best' : 'accurate');
	// Large-v3-turbo is only practical with half-precision WebGPU.
	if (choice === 'best' && !webgpu?.f16) choice = 'accurate';
	if (loaded?.choice === choice && transcriber) return loaded;
	await transcriber?.dispose();
	transcriber = undefined;
	const model = models[choice];
	if (webgpu) {
		try {
			transcriber = await pipeline('automatic-speech-recognition', model.id, {
				device: 'webgpu',
				// Quantizing Whisper's encoder costs accuracy; its decoder tolerates 4-bit well.
				dtype:
					choice === 'best'
						? { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' }
						: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
				progress_callback: progress
			});
			loaded = { choice, device: 'webgpu' };
			return loaded;
		} catch {
			// Fall back to the CPU build below.
		}
	}
	if (choice === 'best') choice = 'accurate';
	transcriber = await pipeline('automatic-speech-recognition', models[choice].id, {
		device: 'wasm',
		dtype: 'q8',
		progress_callback: progress
	});
	loaded = { choice, device: 'wasm' };
	return loaded;
}

type Request = { audio?: Float32Array; model?: number; requestId?: string };
let work = Promise.resolve();
self.onmessage = (event: MessageEvent<Request>) => {
	// A stopped recording may leave one inference finishing. Keep the cached model serial.
	work = work.then(() => processRequest(event.data));
};
async function processRequest(data: Request) {
	try {
		if (!data.audio) {
			const { choice, device } = await load(data.model ?? 0);
			self.postMessage({ ready: true, model: models[choice].label, device });
			return;
		}
		if (!transcriber || !loaded) await load(0);
		const seconds = data.audio.length / 16000;
		const audio = data.audio;
		let peak = 0;
		for (const sample of audio) peak = Math.max(peak, Math.abs(sample));
		const gain = peak > 0.005 ? Math.min(8, 0.9 / peak) : 1;
		if (gain > 1) for (let i = 0; i < audio.length; i++) audio[i] *= gain;
		const result = await transcriber!(data.audio, {
			return_timestamps: false,
			// Allow headroom for fast speech and technical vocabulary; cap runaway decoding.
			max_new_tokens: Math.min(440, Math.ceil(seconds * 16) + 24),
			...(models[loaded!.choice].multilingual ? { language: 'english', task: 'transcribe' } : {})
		});
		self.postMessage({
			requestId: data.requestId,
			text: Array.isArray(result) ? result.map((item) => item.text).join(' ') : result.text
		});
	} catch (error) {
		self.postMessage({ requestId: data.requestId, error: (error as Error).message });
	}
}
