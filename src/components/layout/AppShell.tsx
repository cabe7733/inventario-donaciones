import { Suspense } from 'react';
import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { House, Package, Pill, Cube, DotsThree, CaretLeft } from '@phosphor-icons/react';

const TABS = [
  { to: '/inicio', icon: House, key: 'nav.inicio', end: true },
  { to: '/productos', icon: Package, key: 'nav.productos', end: false },
  { to: '/medicamentos', icon: Pill, key: 'nav.medicamentos', end: false },
  { to: '/kits', icon: Cube, key: 'nav.kits', end: false },
  { to: '/mas', icon: DotsThree, key: 'nav.mas', end: false },
] as const;

const TAB_PATHS = TABS.map((t) => t.to);

export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isSubPage = !TAB_PATHS.some((p) => location.pathname === p || location.pathname === p + '/');

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-fg">
      <header className="flex h-14 items-center gap-2 border-b border-border bg-surface-card px-4">
        {isSubPage ? (
          <>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center -ml-2 rounded-lg text-text-secondary hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              aria-label={t('common.back')}
            >
              <CaretLeft size={20} aria-hidden="true" />
            </button>
            <span className="text-h3 text-accent-600">Donario</span>
          </>
        ) : (
          <span className="text-h3 text-accent-600">Donario</span>
        )}
      </header>

      <main id="main" role="main" tabIndex={-1} className="flex-1">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        className="sticky bottom-0 flex border-t border-border bg-surface-card"
        aria-label={t('nav.inicio')}
      >
        {TABS.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset ${
                isActive ? 'text-accent-600' : 'text-text-secondary'
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
