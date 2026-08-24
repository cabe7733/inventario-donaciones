import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Download } from '@phosphor-icons/react';
import { fetchGeneralReport } from '../../lib/reportOps';
import { exportToCsv } from '../../lib/exporters';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';

const itemLabel = (t: (k: string) => string, type: string) =>
  type === 'product' ? t('informes.producto') : type === 'medication' ? t('informes.medicamento') : t('informes.kit');

export function InformeGeneralPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['general-report', from, to],
    queryFn: () => fetchGeneralReport(from || undefined, to || undefined),
    select: (rs) => rs.map((r) => ({ ...r, id: `${r.item_type}-${r.item_id}` })),
  });

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'item_type',
      header: t('informes.tipo'),
      render: (r) => <span className="capitalize">{itemLabel(t, r.item_type)}</span>,
    },
    { key: 'item_name', header: t('informes.nombre'), sortable: true },
    { key: 'total_in', header: t('informes.entradas'), className: 'text-right' },
    { key: 'total_out', header: t('informes.salidas'), className: 'text-right' },
    { key: 'current_stock', header: t('informes.stockActual'), className: 'text-right font-semibold' },
    { key: 'warehouse_count', header: t('informes.bodegasConStock'), className: 'text-right' },
  ];

  const handleExport = () => {
    if (!rows.length) {
      toast.push({ message: t('informes.noData'), tone: 'neutral' });
      return;
    }
    exportToCsv(
      `informe-general.csv`,
      rows.map((r) => ({
        Tipo: itemLabel(t, r.item_type),
        Nombre: r.item_name,
        Entradas: r.total_in,
        Salidas: r.total_out,
        'Stock actual': r.current_stock,
        'Bodegas con stock': r.warehouse_count,
      })),
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{t('informes.general')}</h1>
        {rows.length > 0 && (
          <Button onClick={handleExport}>
            <Download size={18} aria-hidden="true" />
            {t('informes.csv')}
          </Button>
        )}
      </header>

      <p className="text-body-sm text-muted">{t('informes.general.desc')}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field id="gen-from" label={t('informes.desde')}>
          <input id="gen-from" type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="gen-to" label={t('informes.hasta')}>
          <input id="gen-to" type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button
            variant="ghost"
            onClick={() => { setFrom(''); setTo(''); }}
            className="w-full"
          >
            {t('movimientos.limpiar')}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        emptyMessage={t('informes.empty')}
      />
    </div>
  );
}
