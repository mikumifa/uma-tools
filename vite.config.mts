import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyRedirectHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="0; url=../">
  <link rel="canonical" href="../">
</head>
<body>
  <p>Redirecting to <a href="../">../</a>...</p>
  <script>window.location.replace("../" + window.location.hash);</script>
</body>
</html>
`;

function legacyCnRedirect() {
  return {
    name: "legacy-cn-redirect",
    writeBundle(options) {
      if (!options.dir) return;
      const legacyDir = path.resolve(options.dir, "umalator-cn");
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.writeFileSync(path.join(legacyDir, "index.html"), legacyRedirectHtml);
    },
  };
}

const intelHtml = `<!doctype html>
<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>赛马娘活动情报汇总</title>
		<link rel="icon" type="image/png" href="../favicon.ico">
		<script type="module" crossorigin src="../bundle.js"></script>
		<link rel="stylesheet" crossorigin href="../bundle.css">
	</head>
	<body>
		<div id="app"></div>
	</body>
</html>
`;

function intelRouteHtml() {
  return {
    name: "intel-route-html",
    writeBundle(options) {
      if (!options.dir) return;
      const intelDir = path.resolve(options.dir, "intel");
      fs.mkdirSync(intelDir, { recursive: true });
      fs.writeFileSync(path.join(intelDir, "index.html"), intelHtml);
    },
  };
}

export default defineConfig(({ mode }) => {
  const debug = mode === "debug";
  return {
    root: path.resolve(__dirname, "umalator"),
    base: "./",
    plugins: [preact(), legacyCnRedirect(), intelRouteHtml()],
    define: {
      CC_DEBUG: JSON.stringify(debug),
      CC_GLOBAL: "true",
    },
    resolve: {
      alias: [
        {
          find: "@app",
          replacement: path.resolve(__dirname, "umalator/src/app"),
        },
        {
          find: "@components",
          replacement: path.resolve(__dirname, "umalator/src/components"),
        },
        {
          find: "@shared",
          replacement: path.resolve(__dirname, "umalator/src/shared"),
        },
        {
          find: "@data",
          replacement: path.resolve(__dirname, "umalator/data"),
        },
        {
          find: "@sim",
          replacement: path.resolve(__dirname, "uma-skill-tools"),
        },
        {
          find: /^@tanstack\/(.*)/,
          replacement: path.resolve(__dirname, "vendor/$1"),
        },
        {
          find: "node:assert",
          replacement: path.resolve(__dirname, "umalator/src/shims/assert.ts"),
        },
      ],
    },
    server: {
      host: "0.0.0.0",
      port: 8000,
      fs: {
        allow: [__dirname],
      },
    },
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      assetsDir: ".",
      rollupOptions: {
        input: path.resolve(__dirname, "umalator", "index.html"),
        output: {
          entryFileNames: "bundle.js",
          chunkFileNames: "bundle-[name].js",
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith(".css")) {
              return "bundle.css";
            }
            return "[name][extname]";
          },
        },
      },
    },
  };
});
