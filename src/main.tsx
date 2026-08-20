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
import { syncNow, syncEnabled } from './lib/sync';

seedIfEmpty();

if (syncEnabled) {
  const run = () => {
    void syncNow().catch(() => {
      /* offline: se reintenta en el próximo evento online/intervalo */
    });
  };
  run();
  window.addEventListener('online', run);
  // ponytail: intervalo de 60s cubre retries y cambios de otros dispositivos
  setInterval(run, 60_000);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);