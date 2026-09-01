import { NavLink } from 'react-router-dom';
import { House, Package, ArrowDownRight, ArrowUpRight } from '@phosphor-icons/react';
import type { IconProps } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface NavItem {
  to: string;
  icon: React.ComponentType<IconProps>;
  key: string;
  end?: boolean;
}

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { to: '/inicio', icon: House, key: 'nav.inicio', end: true },
  { to: '/productos', icon: Package, key: 'nav.productos' },
  { to: '/entradas', icon: ArrowDownRight, key: 'nav.entradas' },
  { to: '/salidas', icon: ArrowUpRight, key: 'nav.salidas' },
];

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-surface-card lg:hidden"
      style={{ height: 'var(--header-height)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      {BOTTOM_NAV_ITEMS.map(({ to, icon: Icon, key, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset ${
              isActive
                ? 'text-accent-600'
                : 'text-text-secondary hover:text-fg'
            }`
          }
        >
          <Icon size={24} weight="regular" aria-hidden />
          <span className="text-xs font-medium">{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
