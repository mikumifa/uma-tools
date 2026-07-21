Quick start

```
npm start
```

This runs `vite` (Preact preset) to serve the app on port 8000 with rebuilds.

- `npm run dev` / `npm start`: Vite dev server (port 8000).
- `npm run dev:debug`: Dev server with `CC_DEBUG=true`.
- `npm run update:data`: Refresh simulator data and `/intel/` data from `master.mdb`, then build.
- `npm run build`: Vite build to `dist/` (data lives in `umalator/data`).
- `npm run preview`: Preview the production build locally.

Data updates

After replacing `master.mdb`, run:

```
npm run update:data
```

This refreshes frontend skill data, simulator skill effects, skill names, uma/icon metadata, track names, the `/intel/` summary JSON, and then runs the Vite build. Game images are copied only when `UMA_TEXTURE2D_DIR` is configured, for example in `.env.local`:

```
UMA_TEXTURE2D_DIR=D:\Apps\umas\export\Texture2D
```

To update from a database outside the repo, run:

```
python scripts/update_data.py D:\path\to\master.mdb --build
```

Race course geometry needs the extracted `courseeventparam` directory. If you have it, configure `UMA_COURSE_EVENT_PARAM_DIR` or pass `--course-events D:\path\to\courseeventparam`; otherwise the script keeps the existing simulator course geometry and syncs that copy to the frontend.

Project layout

- `umalator/src/app`: app shell, simulation views, worker entry, telemetry.
- `umalator/src/components`: reusable UI components shared by app screens.
- `umalator/src/shared`: small frontend-only shared helpers/data adapters.
- `umalator/data`: generated frontend JSON data consumed through `@data/*`.
- `uma-skill-tools`: simulation/domain library consumed through `@sim/*`.
- `umalator/public`: static assets copied by Vite; `umalator/public/icons` is the only tracked icon asset source.
- `dist/umalator-cn/index.html`: generated compatibility redirect for old `/umalator-cn/` links.
- `var/need-unpack`: ignored data-update scratch directory for icon dat files.

The frontend build is Vite-only. Legacy esbuild entrypoints were removed; use `npm run build` or `scripts/update_data.py --build` after regenerating data.
