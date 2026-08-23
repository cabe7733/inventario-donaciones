import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import './styles/tokens.css';
import './styles/globals.css';
import './lib/intl/i18n';
import { router } from './router';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './components/auth/AuthProvider';
import { ThemeProvider } from './lib/theme/ThemeProvider';
import { ToastProvider } from './components/ui/Toast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
