import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { MasPage } from './features/configuracion/MasPage';
import { CategoriasPage } from './features/configuracion/CategoriasPage';
import { UnidadesPage } from './features/configuracion/UnidadesPage';
import { ImportarProductosPage } from './features/configuracion/ImportarProductosPage';
import { MovimientoPage } from './features/movimientos/MovimientoPage';
import { MovimientosPage } from './features/movimientos/MovimientosPage';
import { KitsListPage } from './features/kits/KitsListPage';
import { KitDetailPage } from './features/kits/KitDetailPage';
import { PlaceholderPage } from './components/PlaceholderPage';

function SuspenseBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

const ProductosList = lazy(() =>
  import('./features/productos/ProductosListPage').then((m) => ({ default: m.ProductosListPage })),
);

const MedicamentosList = lazy(() =>
  import('./features/medicamentos/MedicamentosPage').then((m) => ({ default: m.MedicamentosPage })),
);

const ImportarMedicamentosPage = lazy(() =>
  import('./features/configuracion/ImportarMedicamentosPage').then((m) => ({ default: m.ImportarMedicamentosPage })),
);

const PLACEHOLDERS = [
  { path: 'mas/operadores', key: 'mas.operadores' },
  { path: 'mas/sincronizacion', key: 'mas.sincronizacion' },
  { path: 'mas/exportar', key: 'mas.exportar' },
  { path: 'mas/acerca', key: 'mas.acercaDe' },
];

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/inicio" replace /> },
      { path: 'inicio', element: <DashboardPage /> },
      { path: 'movimiento', element: <MovimientoPage /> },
      {
        path: 'productos',
        element: (
          <SuspenseBoundary>
            <ProductosList />
          </SuspenseBoundary>
        ),
      },
      {
        path: 'medicamentos',
        element: (
          <SuspenseBoundary>
            <MedicamentosList />
          </SuspenseBoundary>
        ),
      },
      { path: 'mas', element: <MasPage /> },
      { path: 'kits', element: <KitsListPage /> },
      { path: 'kits/:id', element: <KitDetailPage /> },
      { path: 'mas/categorias', element: <CategoriasPage /> },
      { path: 'mas/unidades', element: <UnidadesPage /> },
      { path: 'mas/importar', element: <ImportarProductosPage /> },
      {
        path: 'mas/importar-medicamentos',
        element: (
          <SuspenseBoundary>
            <ImportarMedicamentosPage />
          </SuspenseBoundary>
        ),
      },
      { path: 'mas/movimientos', element: <MovimientosPage /> },
      ...PLACEHOLDERS.map(({ path, key }) => ({
        path,
        element: <PlaceholderPage titleKey={key} />,
      })),
    ],
  },
]);
