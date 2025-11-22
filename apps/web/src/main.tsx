import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { registerServiceWorker } from './service-worker-registration';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Make sure there is a <div id="root"></div> in your HTML.');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);

// Register service worker for PWA support
registerServiceWorker({
  onReady: (registration) => {
    console.log('PDFLover is ready for offline use');
    // Pre-cache critical routes
    if (registration.active) {
      registration.active.postMessage({
        type: 'CACHE_URLS',
        payload: {
          urls: ['/merge', '/split', '/compress', '/convert'],
        },
      });
    }
  },
  onUpdateAvailable: () => {
    console.log('A new version of PDFLover is available');
  },
  onError: (error) => {
    console.error('Service worker registration failed:', error);
  },
});
