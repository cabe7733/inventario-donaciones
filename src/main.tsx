import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './styles/tokens.css';
import './styles/globals.css';
import './lib/intl/i18n';
import { router } from './router';
import { ThemeProvider } from './lib/theme/ThemeProvider';
import { ToastProvider } from './components/ui/Toast';
import { seedIfEmpty } from './db/seed';

seedIfEmpty();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);