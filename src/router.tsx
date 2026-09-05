import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet } from 'react-router-dom';
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
import { EditCenterPage } from './features/centro/EditCenterPage';
import { MembersPage } from './features/centro/MembersPage';
import { CategoriasPage } from './features/configuracion/CategoriasPage';
import { UnidadesPage } from './features/configuracion/UnidadesPage';
import { KitsListPage } from './features/kits/KitsListPage';
import { KitDetailPage } from './features/kits/KitDetailPage';
import { MovimientosPage } from './features/movimientos/MovimientosPage';
import { VoluntariosListPage } from './features/voluntarios/VoluntariosListPage';
import { OrdersListPage } from './features/ordenes/OrdersListPage';
import { OrderFormPage } from './features/ordenes/OrderFormPage';
import { BodegasListPage } from './features/bodegas/BodegasListPage';
import { TrasladosPage } from './features/bodegas/TrasladosPage';
import { PersonasListPage } from './features/personas/PersonasListPage';
import { InformeBodegaPage } from './features/informes/InformeBodegaPage';
import { InformesIndexPage } from './features/informes/InformesIndexPage';
import { InformeDonacionesPage } from './features/informes/InformeDonacionesPage';
import { InformeGeneralPage } from './features/informes/InformeGeneralPage';
import { InformeKitsPorBodegaPage } from './features/informes/InformeKitsPorBodegaPage';
import { InformeProductosPorBodegaPage } from './features/informes/InformeProductosPorBodegaPage';
import { ComedorPersonasPage } from './features/comedor/ComedorPersonasPage';

function SuspenseBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

const ProductosList = lazy(() =>
  import('./features/productos/ProductosListPage').then((m) => ({ default: m.ProductosListPage })),
);

const MedicamentosList = lazy(() =>
  import('./features/medicamentos/MedicamentosPage').then((m) => ({ default: m.MedicamentosPage })),
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
        <Outlet />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <OnboardingPage /> },
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
      { path: 'mas/movimientos', element: <MovimientosPage /> },
      // Orders
      { path: 'entradas', element: <OrdersListPage type="entrada" /> },
      { path: 'entradas/nueva', element: <OrderFormPage /> },
      { path: 'salidas', element: <OrdersListPage type="salida" /> },
      { path: 'salidas/nueva', element: <OrderFormPage /> },
      // Volunteers
      { path: 'voluntarios', element: <VoluntariosListPage /> },
      { path: 'comedor', element: <ComedorPersonasPage /> },
      // Warehouses
      {
        path: 'bodegas',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <BodegasListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'bodegas/traslados',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <TrasladosPage />
          </RoleGuard>
        ),
      },
      // Donors / Recipients
      { path: 'donantes', element: <PersonasListPage kind="donor" /> },
      { path: 'beneficiarios', element: <PersonasListPage kind="recipient" /> },
      // Reports
      {
        path: 'informes',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <Outlet />
          </RoleGuard>
        ),
        children: [
          { index: true, element: <InformesIndexPage /> },
          { path: 'bodega', element: <InformeBodegaPage /> },
          { path: 'bodega/donaciones', element: <InformeDonacionesPage /> },
          { path: 'general', element: <InformeGeneralPage /> },
          { path: 'kits', element: <InformeKitsPorBodegaPage /> },
          { path: 'productos', element: <InformeProductosPorBodegaPage /> },
        ],
      },
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
        path: 'centro/editar',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <EditCenterPage />
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
            <Outlet />
          </RoleGuard>
        ),
        children: [
          {
            index: true,
            element: (
              <div className="flex flex-col gap-4 p-4 lg:p-6">
                <h1 className="text-h2">Configuración</h1>
                <div className="flex flex-col gap-1">
                  {[
                    { to: '/config/categorias', label: 'Categorías' },
                    { to: '/config/unidades', label: 'Unidades' },
                  ].map(({ to, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className="rounded-lg px-3 py-2 text-body text-primary-700 hover:bg-primary-50"
                    >
                      {label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ),
          },
          { path: 'categorias', element: <CategoriasPage /> },
          { path: 'unidades', element: <UnidadesPage /> },
        ],
      },
    ],
  },
]);
