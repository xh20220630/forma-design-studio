import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import App from './app/App';
import './app/styles/theme.css';
import './app/styles/styles.css';
import { StudioThemeProvider } from './shared/theme/StudioTheme';
import StudioRuntime from './app/providers/StudioRuntime';
import './shared/theme/studio-tokens.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StudioThemeProvider>
      <StudioRuntime>
        <App />
      </StudioRuntime>
    </StudioThemeProvider>
  </React.StrictMode>,
);
