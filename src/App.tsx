import React from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { CounterErrorBoundary } from './components/ErrorBoundary';
import Counter from './components/Counter';
import './App.css';

/**
 * Initialize Convex client with environment configuration.
 * 
 * The Convex URL is automatically set by the Convex CLI during development
 * and should be configured for production deployments.
 */
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

/**
 * Main application component for Digit Duel.
 * 
 * This component sets up the application structure with:
 * - Convex provider for real-time data synchronization
 * - Error boundary for graceful error handling
 * - Main counter interface
 * 
 * The application follows SOLID principles with clean separation of concerns
 * and comprehensive error handling throughout the component tree.
 * 
 * @returns JSX element for the complete application
 */
function App(): React.ReactElement {
  return (
    <ConvexProvider client={convex}>
      <CounterErrorBoundary
        onError={(error, errorInfo) => {
          // In production, you would send this to your error monitoring service
          console.error('Application error:', error, errorInfo);
        }}
      >
        <Counter />
      </CounterErrorBoundary>
    </ConvexProvider>
  );
}

export default App;
