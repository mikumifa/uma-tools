Quick start

```
npm start
```

This runs `vite` (Preact preset) to serve the app on port 8000 with rebuilds.

- `npm run dev` / `npm start`: Vite dev server (port 8000).
- `npm run dev:debug`: Dev server with `CC_DEBUG=true`.
- `npm run build`: Vite build to `dist/` (data lives in `umalator/data`).
- `npm run preview`: Preview the production build locally.

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
