import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  House,
  Package,
  Pill,
  ClipboardText,
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
  BowlFood,
  List,
  X,
  Sun,
  Moon,
} from '@phosphor-icons/react';
import type { IconProps } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthProvider';
import type { UserRole } from '../auth/AuthProvider';
import { useTheme } from '../../lib/theme/ThemeProvider';
import { BottomNav } from './BottomNav';
import { ContextHelp } from './ContextHelp';

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
      { to: '/formulas', icon: ClipboardText, key: 'nav.formulas' },
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
      { to: '/comedor', icon: BowlFood, key: 'nav.comedor' },
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
      { to: '/centro/necesidades', icon: ClipboardText, key: 'nav.necesidades', roles: ['super_admin', 'admin'] },
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
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const el = mobileMenuRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    el.addEventListener('keydown', trap);
    el.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('keydown', trap); el.removeEventListener('keydown', onKey); };
  }, [mobileMenuOpen]);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: filterVisibleItems(group.items, role),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      {/* Sidebar */}
      <aside
        className={`hidden flex-col border-r border-white/5 bg-sidebar text-sidebar-text lg:flex ${
          collapsed ? 'w-[88px]' : 'w-[280px]'
        } transition-all duration-200`}
        aria-label="Navegación principal"
      >
        {/* Logo */}
        <div className={`flex h-20 items-center border-b border-white/10 ${collapsed ? 'flex-col justify-center gap-2 px-2' : 'justify-between px-4'}`}>
          {collapsed ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-400/15 ring-1 ring-primary-300/30">
              <img src="/donario_logo.png" alt="Donario" className="h-8 w-8" />
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-400/15 ring-1 ring-primary-300/30">
                <img src="/donario_logo.png" alt="Donario" className="h-8 w-8" />
              </div>
              <div>
                <span className="block text-h3 font-semibold tracking-tight text-white">Donario</span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-primary-200/70">Gestión solidaria</span>
              </div>
            </div>
          )}
          <div className={`flex items-center gap-1 ${collapsed ? 'flex-row' : ''}`}>
            <ContextHelp />
            {!collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                aria-label="Colapsar sidebar"
              >
                <CaretLeft size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-5" aria-label="Navegación por grupos">
          {visibleGroups.map((group) => (
            <div key={group.title} className="mb-4">
              {!collapsed && (
                <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-muted">
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
                        `mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
                          navIsActive
                            ? 'bg-sidebar-active-bg text-sidebar-active-text font-semibold shadow-[inset_3px_0_0_var(--sidebar-active-text)]'
                            : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-white'
                        }`
                      }
                      title={collapsed ? t(key) : undefined}
                    >
                      {({ isActive: navIsActive }) => (
                        <>
                          <Icon
                            size={22}
                            weight={navIsActive ? 'fill' : 'regular'}
                            className={navIsActive ? 'text-primary-300' : undefined}
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

        {/* User footer with Theme Switcher */}
        <div className="border-t border-white/10 p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-300/15 text-primary-200 text-body font-semibold ring-1 ring-primary-300/20">
                {user?.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                aria-label="Expandir sidebar"
              >
                <CaretRight size={18} />
              </button>
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-hover hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                aria-label="Cambiar tema de color"
              >
                {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-300/15 text-primary-200 text-body font-semibold ring-1 ring-primary-300/20">
                  {user?.email?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-body-sm font-medium text-white">{user?.email}</p>
                  <p className="text-caption capitalize text-sidebar-muted">{role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-hover hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  aria-label="Cambiar tema de color"
                >
                  {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
                </button>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-body-sm text-sidebar-muted hover:bg-sidebar-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2"
              >
                <SignOut size={18} aria-hidden />
                <span>Cerrar sesión</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between border-b border-border/60 bg-surface-card px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="mr-1 flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label="Abrir menú de navegación"
              aria-expanded={mobileMenuOpen}
            >
              <List size={22} />
            </button>
            <ContextHelp />
            <img src="/donario_logo.png" alt="Donario" className="h-8 w-8" />
            <span className="text-h3 font-semibold text-primary-600 dark:text-primary-400">Donario</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label="Cambiar tema de color"
            >
              {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex h-10 w-10 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
              aria-label="Cerrar sesión"
            >
              <SignOut size={18} />
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
            <button type="button" className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú" />
            <aside ref={mobileMenuRef} className="relative flex h-full w-[min(88vw,320px)] flex-col bg-surface-card shadow-elev-4 animate-slide-in-right">
              <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
                <div className="flex items-center gap-2.5">
                  <img src="/donario_logo.png" alt="Donario" className="h-9 w-9" />
                  <span className="text-h3 font-semibold text-primary-600 dark:text-primary-400">Donario</span>
                </div>
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Cerrar menú">
                  <X size={22} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-4" aria-label="Todas las funcionalidades">
                {visibleGroups.map((group) => (
                  <div key={group.title} className="mb-4">
                    <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-text-tertiary">{t(`nav.group.${group.title}`)}</p>
                    <ul className="space-y-0.5 px-2">
                      {group.items.map(({ to, icon: Icon, key, end }) => (
                        <li key={to}>
                          <NavLink to={to} end={end} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-3 text-body transition-colors ${isActive ? 'bg-primary-50 dark:bg-primary-950 font-semibold text-primary-700 dark:text-primary-300' : 'text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-fg'}`}>
                            <Icon size={21} aria-hidden />
                            <span>{t(key)}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
              <div className="border-t border-border/60 p-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-body-sm text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-fg"
                >
                  {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
                  <span>Modo {theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
                </button>
                <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-body-sm text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-fg">
                  <SignOut size={18} aria-hidden />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </aside>
          </div>
        )}

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
