import { build } from 'vite';
import { fileURLToPath } from 'node:url';

build({
	configFile: false,
	build: {
		lib: {
			entry: fileURLToPath(new URL('../integrations/cardmirror/plugin.ts', import.meta.url)),
			name: 'FlewCardMirror',
			formats: ['iife'],
			fileName: () => 'plugin.js'
		},
		outDir: 'static/integrations/cardmirror',
		emptyOutDir: false,
		sourcemap: false,
		minify: true
	}
}).catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
