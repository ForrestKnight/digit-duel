import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

/**
 * Application entry point for Digit Duel.
 * 
 * This sets up the React application with:
 * - Strict mode for development warnings and future compatibility
 * - Root element mounting
 * - Error handling for mounting failures
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Failed to find the root element. Make sure your HTML file contains an element with id="root".'
  );
}

const root = createRoot(rootElement);

try {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  console.error('Failed to render the application:', error);
  
  // Fallback error display
  rootElement.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: system-ui, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 20px;
    ">
      <div>
        <h1 style="font-size: 2rem; margin-bottom: 1rem;">Application Error</h1>
        <p style="margin-bottom: 1rem;">Sorry, we encountered an error loading the application.</p>
        <button 
          onclick="window.location.reload()" 
          style="
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
          "
        >
          Reload Page
        </button>
      </div>
    </div>
  `;
}
