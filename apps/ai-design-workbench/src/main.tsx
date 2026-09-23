import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@forma/ui/styles.css';
import '@forma/ui/studio-tokens.css';
import '@forma/ui/canvas.css';
import { StudioThemeProvider } from '@forma/ui/studio-theme';
import App from './App.tsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><StudioThemeProvider><App /></StudioThemeProvider></React.StrictMode>,
);
