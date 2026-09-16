import { Suspense } from 'react';
import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { House, Package, Pill, Cube, DotsThree, CaretLeft } from '@phosphor-icons/react';
import { ContextHelp } from './ContextHelp';

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
      <header className="relative flex h-14 items-center gap-2 border-b border-border bg-surface-card/80 px-4 backdrop-blur-lg">
        {isSubPage && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center -ml-1 rounded-xl text-text-secondary transition-colors hover:bg-neutral-100 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
            aria-label={t('common.back')}
          >
            <CaretLeft size={18} aria-hidden="true" />
          </button>
        )}
        <span className="text-h3 font-semibold tracking-tight text-primary-600">Donario</span>
        <div className="flex-1" />
        <ContextHelp />
      </header>

      <main id="main" role="main" tabIndex={-1} className="flex-1 pb-20">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 flex border-t border-border bg-neutral-0/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
        aria-label={t('nav.inicio')}
      >
        {TABS.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-inset ${
                isActive
                  ? 'text-primary-600'
                  : 'text-text-secondary active:text-primary-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-1.5 h-1.5 w-5 rounded-full bg-primary-500" aria-hidden="true" />
                )}
                <Icon
                  size={22}
                  weight={isActive ? 'fill' : 'regular'}
                  aria-hidden="true"
                  aria-current={isActive ? 'page' : undefined}
                />
                <span className={`text-[10px] ${isActive ? 'font-semibold' : ''}`}>{t(key)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
