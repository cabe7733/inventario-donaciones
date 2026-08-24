import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChartBar, CubeFocus, Truck, Package, FileText } from '@phosphor-icons/react';
import type { IconProps } from '@phosphor-icons/react';

interface Card {
  to: string;
  icon: React.ComponentType<IconProps>;
  titleKey: string;
  descKey: string;
}

const CARDS: Card[] = [
  {
    to: '/informes/bodega',
    icon: ChartBar,
    titleKey: 'informes.index.bodega.title',
    descKey: 'informes.index.bodega.desc',
  },
  {
    to: '/informes/general',
    icon: CubeFocus,
    titleKey: 'informes.index.general.title',
    descKey: 'informes.index.general.desc',
  },
  {
    to: '/informes/productos',
    icon: Package,
    titleKey: 'informes.index.productos.title',
    descKey: 'informes.index.productos.desc',
  },
  {
    to: '/informes/bodega/donaciones',
    icon: Truck,
    titleKey: 'informes.index.donaciones.title',
    descKey: 'informes.index.donaciones.desc',
  },
];

export function InformesIndexPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center gap-2">
        <FileText size={22} className="text-primary-700" aria-hidden="true" />
        <h1 className="text-h2">{t('informes.index.title')}</h1>
      </header>

      <p className="text-body text-muted">{t('informes.index.subtitle')}</p>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
        {CARDS.map(({ to, icon: Icon, titleKey, descKey }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h2 className="text-h3 text-fg">{t(titleKey)}</h2>
              </div>
              <p className="text-body-sm text-muted">{t(descKey)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
