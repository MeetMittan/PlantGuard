import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';

const root = createRoot(document.getElementById('root')!);

/**
 * Configuration is validated at startup. An invalid deployment configuration
 * shows an explicit message instead of a blank page or silently wrong behaviour.
 */
async function start() {
  try {
    const { App } = await import('./app/App');
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    root.render(
      <div style={{ maxWidth: 560, margin: '15vh auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>PlantGuard could not start</h1>
        <p>The app configuration or startup failed. If you deployed this build, check the environment variables (see docs/ENVIRONMENT.md).</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f3efe4', padding: 12, borderRadius: 8 }}>{message}</pre>
      </div>,
    );
  }
}

void start();
