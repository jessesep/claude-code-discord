// Use esbuild-wasm to transpile TypeScript in the browser
import * as esbuild from 'https://esm.sh/esbuild-wasm@0.19.12';

// Initialize esbuild
await esbuild.initialize({
  wasmURL: 'https://esm.sh/esbuild-wasm@0.19.12/esbuild.wasm',
  worker: false
});

// Fetch and transpile App.tsx
const appResponse = await fetch('./App.tsx');
const appCode = await appResponse.text();

const { code } = await esbuild.transform(appCode, {
  loader: 'tsx',
  jsx: 'automatic',
  format: 'esm',
  target: 'es2022'
});

// Create a module from the transpiled code
const module = await import(`data:text/javascript;base64,${btoa(code)}`);
const App = module.default;

// Now render
import React from 'react';
import { createRoot } from 'https://esm.sh/react-dom@^19.2.3/client';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = createRoot(rootElement);
root.render(
  React.createElement(React.StrictMode, null,
    React.createElement(App)
  )
);
