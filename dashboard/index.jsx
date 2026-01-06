import React from 'react';
import { createRoot } from 'https://esm.sh/react-dom@^19.2.3/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

const root = createRoot(rootElement);
root.render(
  React.createElement(React.StrictMode, null,
    React.createElement(App)
  )
);
