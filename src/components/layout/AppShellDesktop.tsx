import { Suspense } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  House,
  Package,
  Pill,
  Cube,
  ArrowsLeftRight,
  ArrowDownRight,
  ArrowUpRight,
  Users,
  Buildings,
  Warehouse,
  UserCircle,
  ChartBar,
  DotsThree,
} from '@phosphor-icons/react';
import type { IconProps } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthProvider';
import type { UserRole } from '../auth/AuthProvider';

interface NavItem {
  to: string;
  icon: React.ComponentType<IconProps>;
  key: string;
  roles?: UserRole[];
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/inicio', icon: House, key: 'nav.inicio', end: true },
  { to: '/productos', icon: Package, key: 'nav.productos' },
  { to: '/medicamentos', icon: Pill, key: 'nav.medicamentos' },
  { to: '/kits', icon: Cube, key: 'nav.kits' },
  { to: '/bodegas', icon: Warehouse, key: 'nav.bodegas', roles: ['super_admin', 'admin'] },
  { to: '/bodegas/traslados', icon: ArrowsLeftRight, key: 'nav.traslados', roles: ['super_admin', 'admin'] },
  { to: '/entradas', icon: ArrowDownRight, key: 'nav.entradas' },
  { to: '/salidas', icon: ArrowUpRight, key: 'nav.salidas' },
  { to: '/donantes', icon: UserCircle, key: 'nav.donantes' },
  { to: '/beneficiarios', icon: UserCircle, key: 'nav.beneficiarios' },
  { to: '/informes', icon: ChartBar, key: 'nav.informes', roles: ['super_admin', 'admin'] },
  { to: '/voluntarios', icon: Users, key: 'nav.voluntarios' },
  { to: '/centro', icon: Buildings, key: 'nav.centro' },
  { to: '/config', icon: DotsThree, key: 'nav.config', roles: ['super_admin', 'admin'] },
];

export function AppShellDesktop() {
  const { t } = useTranslation();
  const { role, user, signOut } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-surface text-fg">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-border bg-card lg:flex">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <img src="/donario_logo.png" alt="Donario" className="h-8" />
          <span className="text-h3 text-primary-700">Donario</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Navegación principal">
          {visibleItems.map(({ to, icon: Icon, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-body transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/20'
                    : 'text-fg hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} className={isActive ? 'text-primary-700' : undefined} aria-hidden />
                  <span>{t(key)}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-caption font-medium">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-caption font-medium truncate">{user?.email}</p>
              <p className="text-caption text-muted capitalize">{role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-2 w-full rounded-lg px-3 py-1.5 text-caption text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
