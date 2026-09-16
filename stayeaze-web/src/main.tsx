import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App.tsx';
import { Toaster } from '@/components/ui/sonner';
import { initFrontendTelemetry } from '@/lib/telemetry';
import './index.css';

initFrontendTelemetry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevents redundant background requests on window focus
      staleTime: 1000 * 60 * 2,    // Serve from cache without refetching for 2 minutes
      gcTime: 1000 * 60 * 5,       // Garbage-collect inactive cache entries after 5 minutes
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
