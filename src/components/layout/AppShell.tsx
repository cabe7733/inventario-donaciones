import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { House, Package, Pill, Cube, DotsThree } from '@phosphor-icons/react';

const TABS = [
  { to: '/inicio', icon: House, key: 'nav.inicio', end: true },
  { to: '/productos', icon: Package, key: 'nav.productos', end: false },
  { to: '/medicamentos', icon: Pill, key: 'nav.medicamentos', end: false },
  { to: '/kits', icon: Cube, key: 'nav.kits', end: false },
  { to: '/mas', icon: DotsThree, key: 'nav.mas', end: false },
] as const;

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-fg">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <span className="text-h3 text-primary-700">Donario</span>
      </header>

      <main id="main" role="main" tabIndex={-1} className="flex-1">
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-12 text-muted">{t('common.loading')}</div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <nav
        className="sticky bottom-0 flex border-t border-border bg-card"
        aria-label={t('nav.inicio')}
      >
        {TABS.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-primary-700' : 'text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={24} aria-hidden="true" aria-current={isActive ? 'page' : undefined} />
                <span className="text-caption">{t(key)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
