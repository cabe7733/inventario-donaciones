import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGuard } from './components/auth/RoleGuard';
import { AppShellDesktop } from './components/layout/AppShellDesktop';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { OnboardingPage } from './features/centros/OnboardingPage';
import { CreateCenterPage } from './features/centros/CreateCenterPage';
import { JoinCenterPage } from './features/centros/JoinCenterPage';
import { CentroPage } from './features/centro/CentroPage';
import { MembersPage } from './features/centro/MembersPage';
import { CategoriasPage } from './features/configuracion/CategoriasPage';
import { UnidadesPage } from './features/configuracion/UnidadesPage';
import { KitsListPage } from './features/kits/KitsListPage';
import { KitDetailPage } from './features/kits/KitDetailPage';
import { VoluntariosListPage } from './features/voluntarios/VoluntariosListPage';
import { OrdersListPage } from './features/ordenes/OrdersListPage';
import { OrderFormPage } from './features/ordenes/OrderFormPage';

function SuspenseBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

const ProductosList = lazy(() =>
  import('./features/productos/ProductosListPage').then((m) => ({ default: m.ProductosListPage })),
);

const MedicamentosList = lazy(() =>
  import('./features/medicamentos/MedicamentosPage').then((m) => ({ default: m.MedicamentosPage })),
);

const ImportarProductosPage = lazy(() =>
  import('./features/configuracion/ImportarProductosPage').then((m) => ({ default: m.ImportarProductosPage })),
);

const ImportarMedicamentosPage = lazy(() =>
  import('./features/configuracion/ImportarMedicamentosPage').then((m) => ({ default: m.ImportarMedicamentosPage })),
);

const ImportarVoluntariosPage = lazy(() =>
  import('./features/configuracion/ImportarVoluntariosPage').then((m) => ({ default: m.ImportarVoluntariosPage })),
);

export const router = createBrowserRouter([
  // Auth routes (no sidebar)
  {
    path: '/auth',
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'registro', element: <RegisterPage /> },
      { index: true, element: <Navigate to="/auth/login" replace /> },
    ],
  },
  // Onboarding routes (protected, no sidebar)
  {
    path: '/onboarding',
    element: (
      <ProtectedRoute requireCenter={false}>
        <OnboardingPage />
      </ProtectedRoute>
    ),
    children: [
      { path: 'crear-centro', element: <CreateCenterPage /> },
      { path: 'unirse-centro', element: <JoinCenterPage /> },
    ],
  },
  // Main app routes (protected, with sidebar)
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShellDesktop />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/inicio" replace /> },
      { path: 'inicio', element: <DashboardPage /> },
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
      { path: 'kits', element: <KitsListPage /> },
      { path: 'kits/:id', element: <KitDetailPage /> },
      // Orders
      { path: 'entradas', element: <OrdersListPage type="entrada" /> },
      { path: 'entradas/nueva', element: <OrderFormPage /> },
      { path: 'salidas', element: <OrdersListPage type="salida" /> },
      { path: 'salidas/nueva', element: <OrderFormPage /> },
      // Volunteers
      { path: 'voluntarios', element: <VoluntariosListPage /> },
      // Center
      {
        path: 'centro',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <CentroPage />
          </RoleGuard>
        ),
      },
      {
        path: 'centro/miembros',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <MembersPage />
          </RoleGuard>
        ),
      },
      // Config (admin only)
      {
        path: 'config',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <div className="flex flex-col gap-4 p-4 lg:p-6">
              <h1 className="text-h2">Configuración</h1>
              <div className="flex flex-col gap-2">
                <a href="/config/categorias" className="text-primary-600 hover:text-primary-700">Categorías</a>
                <a href="/config/unidades" className="text-primary-600 hover:text-primary-700">Unidades</a>
                <a href="/config/importar-productos" className="text-primary-600 hover:text-primary-700">Importar Productos</a>
                <a href="/config/importar-medicamentos" className="text-primary-600 hover:text-primary-700">Importar Medicamentos</a>
              </div>
            </div>
          </RoleGuard>
        ),
        children: [
          { path: 'categorias', element: <CategoriasPage /> },
          { path: 'unidades', element: <UnidadesPage /> },
          {
            path: 'importar-productos',
            element: (
              <SuspenseBoundary>
                <ImportarProductosPage />
              </SuspenseBoundary>
            ),
          },
          {
            path: 'importar-medicamentos',
            element: (
              <SuspenseBoundary>
                <ImportarMedicamentosPage />
              </SuspenseBoundary>
            ),
          },
          {
            path: 'importar-voluntarios',
            element: (
              <SuspenseBoundary>
                <ImportarVoluntariosPage />
              </SuspenseBoundary>
            ),
          },
        ],
      },
    ],
  },
]);
