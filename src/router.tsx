import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet } from 'react-router-dom';
import { Skeleton } from './components/ui/Skeleton';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGuard } from './components/auth/RoleGuard';
import { AppShellDesktop } from './components/layout/AppShellDesktop';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';

const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const OnboardingPage = lazy(() =>
  import('./features/centros/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);
const CreateCenterPage = lazy(() =>
  import('./features/centros/CreateCenterPage').then((m) => ({ default: m.CreateCenterPage })),
);
const JoinCenterPage = lazy(() =>
  import('./features/centros/JoinCenterPage').then((m) => ({ default: m.JoinCenterPage })),
);
const CentroPage = lazy(() =>
  import('./features/centro/CentroPage').then((m) => ({ default: m.CentroPage })),
);
const EditCenterPage = lazy(() =>
  import('./features/centro/EditCenterPage').then((m) => ({ default: m.EditCenterPage })),
);
const MembersPage = lazy(() =>
  import('./features/centro/MembersPage').then((m) => ({ default: m.MembersPage })),
);
const CategoriasPage = lazy(() =>
  import('./features/configuracion/CategoriasPage').then((m) => ({ default: m.CategoriasPage })),
);
const UnidadesPage = lazy(() =>
  import('./features/configuracion/UnidadesPage').then((m) => ({ default: m.UnidadesPage })),
);
const AutorizadoresPage = lazy(() =>
  import('./features/configuracion/AutorizadoresPage').then((m) => ({ default: m.AutorizadoresPage })),
);
const ProductosList = lazy(() =>
  import('./features/productos/ProductosListPage').then((m) => ({ default: m.ProductosListPage })),
);
const MedicamentosList = lazy(() =>
  import('./features/medicamentos/MedicamentosPage').then((m) => ({ default: m.MedicamentosPage })),
);
const KitsListPage = lazy(() =>
  import('./features/kits/KitsListPage').then((m) => ({ default: m.KitsListPage })),
);
const KitDetailPage = lazy(() =>
  import('./features/kits/KitDetailPage').then((m) => ({ default: m.KitDetailPage })),
);
const MovimientosPage = lazy(() =>
  import('./features/movimientos/MovimientosPage').then((m) => ({ default: m.MovimientosPage })),
);
const VoluntariosListPage = lazy(() =>
  import('./features/voluntarios/VoluntariosListPage').then((m) => ({ default: m.VoluntariosListPage })),
);
const OrdersListPage = lazy(() =>
  import('./features/ordenes/OrdersListPage').then((m) => ({ default: m.OrdersListPage })),
);
const OrderFormPage = lazy(() =>
  import('./features/ordenes/OrderFormPage').then((m) => ({ default: m.OrderFormPage })),
);
const BodegasListPage = lazy(() =>
  import('./features/bodegas/BodegasListPage').then((m) => ({ default: m.BodegasListPage })),
);
const TrasladosPage = lazy(() =>
  import('./features/bodegas/TrasladosPage').then((m) => ({ default: m.TrasladosPage })),
);
const PersonasListPage = lazy(() =>
  import('./features/personas/PersonasListPage').then((m) => ({ default: m.PersonasListPage })),
);
const InformesIndexPage = lazy(() =>
  import('./features/informes/InformesIndexPage').then((m) => ({ default: m.InformesIndexPage })),
);
const InformeBodegaPage = lazy(() =>
  import('./features/informes/InformeBodegaPage').then((m) => ({ default: m.InformeBodegaPage })),
);
const InformeDonacionesPage = lazy(() =>
  import('./features/informes/InformeDonacionesPage').then((m) => ({ default: m.InformeDonacionesPage })),
);
const InformeGeneralPage = lazy(() =>
  import('./features/informes/InformeGeneralPage').then((m) => ({ default: m.InformeGeneralPage })),
);
const InformeKitsPorBodegaPage = lazy(() =>
  import('./features/informes/InformeKitsPorBodegaPage').then((m) => ({ default: m.InformeKitsPorBodegaPage })),
);
const InformeProductosPorBodegaPage = lazy(() =>
  import('./features/informes/InformeProductosPorBodegaPage').then((m) => ({ default: m.InformeProductosPorBodegaPage })),
);
const ComedorPersonasPage = lazy(() =>
  import('./features/comedor/ComedorPersonasPage').then((m) => ({ default: m.ComedorPersonasPage })),
);
const FormulasMedicasPage = lazy(() =>
  import('./features/formulas/FormulasMedicasPage').then((m) => ({ default: m.FormulasMedicasPage })),
);

function PageLoader() {
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-4 w-72 rounded-lg" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function SuspenseBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

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
      { index: true, element: <SuspenseBoundary><OnboardingPage /></SuspenseBoundary> },
      { path: 'crear-centro', element: <SuspenseBoundary><CreateCenterPage /></SuspenseBoundary> },
      { path: 'unirse-centro', element: <SuspenseBoundary><JoinCenterPage /></SuspenseBoundary> },
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
      { path: 'inicio', element: <SuspenseBoundary><DashboardPage /></SuspenseBoundary> },
      { path: 'productos', element: <SuspenseBoundary><ProductosList /></SuspenseBoundary> },
      { path: 'medicamentos', element: <SuspenseBoundary><MedicamentosList /></SuspenseBoundary> },
      { path: 'formulas', element: <SuspenseBoundary><FormulasMedicasPage /></SuspenseBoundary> },
      { path: 'kits', element: <SuspenseBoundary><KitsListPage /></SuspenseBoundary> },
      { path: 'kits/:id', element: <SuspenseBoundary><KitDetailPage /></SuspenseBoundary> },
      { path: 'mas/movimientos', element: <SuspenseBoundary><MovimientosPage /></SuspenseBoundary> },
      // Orders
      { path: 'entradas', element: <SuspenseBoundary><OrdersListPage type="entrada" /></SuspenseBoundary> },
      { path: 'entradas/nueva', element: <SuspenseBoundary><OrderFormPage /></SuspenseBoundary> },
      { path: 'salidas', element: <SuspenseBoundary><OrdersListPage type="salida" /></SuspenseBoundary> },
      { path: 'salidas/nueva', element: <SuspenseBoundary><OrderFormPage /></SuspenseBoundary> },
      // Volunteers
      { path: 'voluntarios', element: <SuspenseBoundary><VoluntariosListPage /></SuspenseBoundary> },
      { path: 'comedor', element: <SuspenseBoundary><ComedorPersonasPage /></SuspenseBoundary> },
      // Warehouses
      {
        path: 'bodegas',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <SuspenseBoundary><BodegasListPage /></SuspenseBoundary>
          </RoleGuard>
        ),
      },
      {
        path: 'bodegas/traslados',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <SuspenseBoundary><TrasladosPage /></SuspenseBoundary>
          </RoleGuard>
        ),
      },
      // Donors / Recipients
      { path: 'donantes', element: <SuspenseBoundary><PersonasListPage kind="donor" /></SuspenseBoundary> },
      { path: 'beneficiarios', element: <SuspenseBoundary><PersonasListPage kind="recipient" /></SuspenseBoundary> },
      // Reports
      {
        path: 'informes',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <Outlet />
          </RoleGuard>
        ),
        children: [
          { index: true, element: <SuspenseBoundary><InformesIndexPage /></SuspenseBoundary> },
          { path: 'bodega', element: <SuspenseBoundary><InformeBodegaPage /></SuspenseBoundary> },
          { path: 'bodega/donaciones', element: <SuspenseBoundary><InformeDonacionesPage /></SuspenseBoundary> },
          { path: 'general', element: <SuspenseBoundary><InformeGeneralPage /></SuspenseBoundary> },
          { path: 'kits', element: <SuspenseBoundary><InformeKitsPorBodegaPage /></SuspenseBoundary> },
          { path: 'productos', element: <SuspenseBoundary><InformeProductosPorBodegaPage /></SuspenseBoundary> },
        ],
      },
      // Center
      {
        path: 'centro',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <SuspenseBoundary><CentroPage /></SuspenseBoundary>
          </RoleGuard>
        ),
      },
      {
        path: 'centro/editar',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <SuspenseBoundary><EditCenterPage /></SuspenseBoundary>
          </RoleGuard>
        ),
      },
      {
        path: 'centro/miembros',
        element: (
          <RoleGuard roles={['super_admin', 'admin']}>
            <SuspenseBoundary><MembersPage /></SuspenseBoundary>
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
                    { to: '/config/autorizadores', label: 'Autorizadores de salida' },
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
          { path: 'categorias', element: <SuspenseBoundary><CategoriasPage /></SuspenseBoundary> },
          { path: 'unidades', element: <SuspenseBoundary><UnidadesPage /></SuspenseBoundary> },
          { path: 'autorizadores', element: <SuspenseBoundary><AutorizadoresPage /></SuspenseBoundary> },
        ],
      },
    ],
  },
]);
