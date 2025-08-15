@echo off
..\node_modules\.bin\esbuild app.tsx --bundle --external:assert --outfile=bundle.js && ^
..\node_modules\.bin\unassert bundle.js > bundle.2.js
rem ..\node_modules\.bin\esbuild bundle.2.js --minify --outfile=bundle.js && ^
rem del bundle.2.js