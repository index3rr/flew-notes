/// <reference lib="webworker" />
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
env.allowLocalModels = false;
let transcriber: AutomaticSpeechRecognitionPipeline | undefined;
self.onmessage = async (event: MessageEvent<{ audio?: Float32Array }>) => {
	try {
		if (!transcriber) {
			transcriber = await pipeline(
				'automatic-speech-recognition',
				'onnx-community/whisper-tiny.en',
				{ device: 'wasm', dtype: 'q8' }
			);
		}
		if (!event.data.audio) {
			self.postMessage({ ready: true });
			return;
		}
		const result = await transcriber(event.data.audio, { return_timestamps: false });
		self.postMessage({
			text: Array.isArray(result) ? result.map((item) => item.text).join(' ') : result.text
		});
	} catch (error) {
		self.postMessage({ error: (error as Error).message });
	}
};
