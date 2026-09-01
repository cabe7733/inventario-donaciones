import { Suspense, useState } from 'react';
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
  CaretLeft,
  CaretRight,
  SignOut,
  Gear,
} from '@phosphor-icons/react';
import type { IconProps } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthProvider';
import type { UserRole } from '../auth/AuthProvider';
import { BottomNav } from './BottomNav';

interface NavItem {
  to: string;
  icon: React.ComponentType<IconProps>;
  key: string;
  roles?: UserRole[];
  end?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'principal',
    items: [
      { to: '/inicio', icon: House, key: 'nav.inicio', end: true },
    ],
  },
  {
    title: 'inventario',
    items: [
      { to: '/productos', icon: Package, key: 'nav.productos' },
      { to: '/medicamentos', icon: Pill, key: 'nav.medicamentos' },
      { to: '/kits', icon: Cube, key: 'nav.kits' },
    ],
  },
  {
    title: 'operaciones',
    items: [
      { to: '/entradas', icon: ArrowDownRight, key: 'nav.entradas' },
      { to: '/salidas', icon: ArrowUpRight, key: 'nav.salidas' },
    ],
  },
  {
    title: 'almacen',
    items: [
      { to: '/bodegas', icon: Warehouse, key: 'nav.bodegas', roles: ['super_admin', 'admin'] },
      { to: '/bodegas/traslados', icon: ArrowsLeftRight, key: 'nav.traslados', roles: ['super_admin', 'admin'] },
    ],
  },
  {
    title: 'personas',
    items: [
      { to: '/donantes', icon: UserCircle, key: 'nav.donantes' },
      { to: '/beneficiarios', icon: UserCircle, key: 'nav.beneficiarios' },
      { to: '/voluntarios', icon: Users, key: 'nav.voluntarios' },
    ],
  },
  {
    title: 'reportes',
    items: [
      { to: '/informes', icon: ChartBar, key: 'nav.informes', roles: ['super_admin', 'admin'] },
    ],
  },
  {
    title: 'administracion',
    items: [
      { to: '/centro', icon: Buildings, key: 'nav.centro' },
      { to: '/config', icon: Gear, key: 'nav.config', roles: ['super_admin', 'admin'] },
    ],
  },
];

function filterVisibleItems(items: NavItem[], role?: UserRole | null): NavItem[] {
  return items.filter((item) => !item.roles || (role && item.roles.includes(role)));
}

export function AppShellDesktop() {
  const { t } = useTranslation();
  const { role, user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: filterVisibleItems(group.items, role),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      {/* Sidebar */}
      <aside
        className={`hidden flex-col border-r border-border bg-surface-card lg:flex ${
          collapsed ? 'w-[72px]' : 'w-[280px]'
        } transition-all duration-200`}
        aria-label="Navegación principal"
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img src="/donario_logo.png" alt="Donario" className="h-8" />
              <span className="text-h3 font-semibold text-accent-600">Donario</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-100 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed ? <CaretRight size={18} /> : <CaretLeft size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4" aria-label="Navegación por grupos">
          {visibleGroups.map((group) => (
            <div key={group.title} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  {t(`nav.group.${group.title}`)}
                </p>
              )}
              <ul className="space-y-0.5 px-2">
                {group.items.map(({ to, icon: Icon, key, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive: navIsActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${
                          navIsActive
                            ? 'bg-accent-50 text-accent-700 font-semibold'
                            : 'text-text-secondary hover:bg-neutral-100 hover:text-fg'
                        }`
                      }
                      title={collapsed ? t(key) : undefined}
                    >
                      {({ isActive: navIsActive }) => (
                        <>
                          <Icon
                            size={20}
                            weight={navIsActive ? 'fill' : 'regular'}
                            className={navIsActive ? 'text-accent-600' : undefined}
                            aria-hidden
                          />
                          {!collapsed && <span>{t(key)}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-body font-semibold">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-medium truncate">{user?.email}</p>
                <p className="text-caption text-text-secondary capitalize">{role}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={signOut}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-body-sm text-text-secondary hover:bg-neutral-100 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
            >
              <SignOut size={18} aria-hidden />
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface-card px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <img src="/donario_logo.png" alt="Donario" className="h-7" />
            <span className="text-h3 font-semibold text-accent-600">Donario</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex h-10 w-10 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
            aria-label="Cerrar sesión"
          >
            <SignOut size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-[var(--header-height)] lg:pb-0">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
