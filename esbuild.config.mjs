import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const absWorkingDir = path.join(dirname, 'umalator', 'dist');
const dataDir = path.join(dirname, 'umalator', 'data');

const args = process.argv.slice(2);
const serve = args.includes('--serve');
const debug = args.includes('--debug');
const portArgIndex = args.findIndex((arg) => arg === '--port');
const port = portArgIndex !== -1 ? Number(args[portArgIndex + 1]) : 8000;

const redirectData = {
	name: 'redirectData',
	setup(build) {
		build.onResolve({ filter: /^\.\.?(?:\/uma-skill-tools)?\/data\// }, (args) => ({
			path: path.join(dataDir, args.path.split('/data/')[1]),
		}));
		build.onResolve({ filter: /skill_meta.json$/ }, () => ({
			path: path.join(dataDir, 'skill_meta.json'),
		}));
		build.onResolve({ filter: /umas.json$/ }, () => ({
			path: path.join(dataDir, 'umas.json'),
		}));
	},
};

const mockAssert = {
	name: 'mockAssert',
	setup(build) {
		const mockAssertFn = debug ? 'console.assert' : 'function(){}';
		build.onResolve({ filter: /^node:assert$/ }, (args) => ({
			path: args.path,
			namespace: 'mockAssert-ns',
		}));
		build.onLoad({ filter: /.*/, namespace: 'mockAssert-ns' }, () => ({
			contents: `module.exports={strict:${mockAssertFn}};`,
			loader: 'js',
		}));
	},
};

const redirectTable = {
	name: 'redirectTable',
	setup(build) {
		build.onResolve({ filter: /^@tanstack\// }, (args) => ({
			path: path.join(dirname, 'vendor', args.path.slice(10), 'index.ts'),
		}));
	},
};

const buildOptions = {
	absWorkingDir,
	entryPoints: [
		{ in: '../umalator/app.tsx', out: 'bundle' },
		'../umalator/simulator.worker.ts',
	],
	bundle: true,
	minify: !debug,
	sourcemap: debug,
	outdir: '.',
	define: { CC_DEBUG: debug.toString(), CC_GLOBAL: 'true' },
	external: ['*.ttf'],
	plugins: [redirectData, mockAssert, redirectTable],
	logLevel: 'info',
};

async function run() {
	if (serve) {
		const ctx = await esbuild.context({ ...buildOptions, write: true });
		await ctx.watch();
		const server = await ctx.serve({
			port,
			servedir: dirname,
		});
		console.log(`Dev server running at http://localhost:${server.port}/umalator/dist/`);
	} else {
		await esbuild.build(buildOptions);
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
