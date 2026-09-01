import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  CaretRight,
  Moon,
  Sun,
  Tag,
  Ruler,
  Package,
  Archive,
  Warehouse,
  UserCircle,
  ChartBar,
  Gear,
  ArrowsLeftRight,
} from '@phosphor-icons/react';
import type { IconProps } from '@phosphor-icons/react';
import { useTheme } from '../../lib/theme/ThemeProvider';

interface SettingsGroup {
  title: string;
  items: Array<{
    to: string;
    icon: React.ComponentType<IconProps>;
    label: string;
  }>;
}

export function MasPage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const groups: SettingsGroup[] = [
    {
      title: 'Inventario',
      items: [
        { to: '/mas/movimientos', icon: Package, label: t('mas.movimientos') },
        { to: '/bodegas', icon: Warehouse, label: 'Bodegas' },
        { to: '/bodegas/traslados', icon: ArrowsLeftRight, label: 'Traslados' },
      ],
    },
    {
      title: 'Personas',
      items: [
        { to: '/donantes', icon: UserCircle, label: 'Donantes' },
        { to: '/beneficiarios', icon: UserCircle, label: 'Beneficiarios' },
      ],
    },
    {
      title: 'Reportes',
      items: [
        { to: '/informes/bodega', icon: ChartBar, label: 'Informe por Bodega' },
      ],
    },
    {
      title: 'Configuración',
      items: [
        { to: '/config/categorias', icon: Tag, label: t('mas.categorias') },
        { to: '/config/unidades', icon: Ruler, label: t('mas.unidades') },
        { to: '/config', icon: Gear, label: 'Configuración general' },
        { to: '/mas/exportar', icon: Archive, label: t('mas.exportar') },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-h2">{t('mas.title')}</h1>

      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="mb-2 px-1 text-caption font-semibold uppercase tracking-wider text-text-tertiary">
            {group.title}
          </h2>
          <nav className="flex flex-col gap-0.5 rounded-xl border border-border bg-surface-card" aria-label={group.title}>
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-body transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset"
              >
                <item.icon size={20} className="text-text-tertiary" aria-hidden />
                <span className="flex-1">{item.label}</span>
                <CaretRight size={16} className="text-text-tertiary" aria-hidden />
              </Link>
            ))}
          </nav>
        </section>
      ))}

      <section className="rounded-xl border border-border bg-surface-card p-4">
        <h2 className="mb-3 text-caption font-semibold uppercase tracking-wider text-text-tertiary">
          Apariencia
        </h2>
        <div className="flex items-center justify-between">
          <span className="text-body">{t('mas.apariencia')}</span>
          <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label={t('mas.apariencia')}>
            <button
              type="button"
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
              className={`flex items-center gap-1.5 px-4 py-2 text-caption font-semibold transition-colors ${
                theme === 'light' ? 'bg-accent-600 text-white' : 'text-text-secondary hover:bg-neutral-50'
              }`}
            >
              <Sun size={16} aria-hidden="true" />
              {t('mas.apar.light')}
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`flex items-center gap-1.5 px-4 py-2 text-caption font-semibold transition-colors ${
                theme === 'dark' ? 'bg-accent-600 text-white' : 'text-text-secondary hover:bg-neutral-50'
              }`}
            >
              <Moon size={16} aria-hidden="true" />
              {t('mas.apar.dark')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
