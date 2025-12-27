import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
	const debug = mode === 'debug';
	return {
		root: path.resolve(__dirname, 'umalator'),
		base: './',
		plugins: [preact()],
		define: {
			CC_DEBUG: JSON.stringify(debug),
			CC_GLOBAL: 'true',
		},
		resolve: {
			alias: [
				{ find: /^@tanstack\/(.*)/, replacement: path.resolve(__dirname, 'vendor/$1') },
				{ find: 'node:assert', replacement: path.resolve(__dirname, 'mock-assert.ts') },
			],
		},
		server: {
			port: 8000,
			fs: {
				allow: [__dirname],
			},
		},
		build: {
			// Keep the published URL at /umalator-cn/ instead of /umalator/dist/
			outDir: path.resolve(__dirname, 'umalator-cn'),
			emptyOutDir: true,
			assetsDir: '.',
			rollupOptions: {
				input: path.resolve(__dirname, 'umalator', 'index.html'),
				output: {
					entryFileNames: 'bundle.js',
					chunkFileNames: 'bundle-[name].js',
					assetFileNames: (assetInfo) => {
						if (assetInfo.name && assetInfo.name.endsWith('.css')) {
							return 'bundle.css';
						}
						return '[name][extname]';
					},
				},
			},
		},
	};
});
