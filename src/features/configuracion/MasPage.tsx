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
  UploadSimple,
  Pill,
} from '@phosphor-icons/react';
import { useTheme } from '../../lib/theme/ThemeProvider';

export function MasPage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-h2">{t('mas.title')}</h1>

      <nav className="flex flex-col gap-1" aria-label={t('mas.title')}>
        <Link
          to="/mas/movimientos"
          className="flex items-center gap-3 rounded-lg px-3 py-3 text-body hover:bg-neutral-100 dark:hover:bg-neutral-100"
        >
          <Package size={20} className="text-muted" aria-hidden="true" />
          <span className="flex-1">{t('mas.movimientos')}</span>
          <CaretRight size={16} className="text-muted" aria-hidden="true" />
        </Link>
        <Link
          to="/mas/categorias"
          className="flex items-center gap-3 rounded-lg px-3 py-3 text-body hover:bg-neutral-100 dark:hover:bg-neutral-100"
        >
          <Tag size={20} className="text-muted" aria-hidden="true" />
          <span className="flex-1">{t('mas.categorias')}</span>
          <CaretRight size={16} className="text-muted" aria-hidden="true" />
        </Link>
        <Link
          to="/mas/unidades"
          className="flex items-center gap-3 rounded-lg px-3 py-3 text-body hover:bg-neutral-100 dark:hover:bg-neutral-100"
        >
          <Ruler size={20} className="text-muted" aria-hidden="true" />
          <span className="flex-1">{t('mas.unidades')}</span>
          <CaretRight size={16} className="text-muted" aria-hidden="true" />
        </Link>
        <Link
          to="/mas/importar"
          className="flex items-center gap-3 rounded-lg px-3 py-3 text-body hover:bg-neutral-100 dark:hover:bg-neutral-100"
        >
          <UploadSimple size={20} className="text-muted" aria-hidden="true" />
          <span className="flex-1">{t('mas.importar')}</span>
          <CaretRight size={16} className="text-muted" aria-hidden="true" />
        </Link>
        <Link
          to="/mas/importar-medicamentos"
          className="flex items-center gap-3 rounded-lg px-3 py-3 text-body hover:bg-neutral-100 dark:hover:bg-neutral-100"
        >
          <Pill size={20} className="text-muted" aria-hidden="true" />
          <span className="flex-1">{t('mas.importarMedicamentos')}</span>
          <CaretRight size={16} className="text-muted" aria-hidden="true" />
        </Link>
        <Link
          to="/mas/exportar"
          className="flex items-center gap-3 rounded-lg px-3 py-3 text-body hover:bg-neutral-100 dark:hover:bg-neutral-100"
        >
          <Archive size={20} className="text-muted" aria-hidden="true" />
          <span className="flex-1">{t('mas.exportar')}</span>
          <CaretRight size={16} className="text-muted" aria-hidden="true" />
        </Link>
      </nav>

      <section className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <span className="text-body">{t('mas.apariencia')}</span>
        <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label={t('mas.apariencia')}>
          <button
            type="button"
            onClick={() => setTheme('light')}
            aria-pressed={theme === 'light'}
            className={`flex items-center gap-1.5 px-3 py-2 text-caption font-semibold ${
              theme === 'light' ? 'bg-primary-600 text-inverse' : 'text-muted'
            }`}
          >
            <Sun size={16} aria-hidden="true" />
            {t('mas.apar.light')}
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            aria-pressed={theme === 'dark'}
            className={`flex items-center gap-1.5 px-3 py-2 text-caption font-semibold ${
              theme === 'dark' ? 'bg-primary-600 text-inverse' : 'text-muted'
            }`}
          >
            <Moon size={16} aria-hidden="true" />
            {t('mas.apar.dark')}
          </button>
        </div>
      </section>
    </div>
  );
}
