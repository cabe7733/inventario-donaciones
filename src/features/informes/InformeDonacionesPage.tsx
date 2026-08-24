import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Download } from '@phosphor-icons/react';
import { fetchWarehouses } from '../../lib/warehouseOps';
import { fetchWarehouseDonationsReport } from '../../lib/reportOps';
import { exportToCsv } from '../../lib/exporters';
import { formatDate } from '../../lib/format';
import { WarehouseSelect } from '../../components/ui/WarehouseSelect';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';

export function InformeDonacionesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [warehouseId, setWarehouseId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<'all' | 'entrada' | 'salida'>('all');

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => fetchWarehouses(),
  });

  const dateRange = useMemo(
    () => ({ from: from || undefined, to: to || undefined }),
    [from, to],
  );

  const { data: donations = [], isLoading } = useQuery({
    queryKey: ['warehouse-donations', warehouseId, dateRange, kind],
    queryFn: () =>
      fetchWarehouseDonationsReport(warehouseId, {
        from: dateRange.from,
        to: dateRange.to,
        kind: kind === 'all' ? undefined : kind,
      }),
    enabled: !!warehouseId,
    select: (rows) => rows.map((r) => ({ ...r, id: r.movement_id })),
  });

  const warehouseName = warehouses.find((w) => w.id === warehouseId)?.name ?? '';

  const columns: Column<(typeof donations)[number]>[] = [
    { key: 'fecha', header: t('informes.fecha'), render: (r) => formatDate(r.fecha) },
    {
      key: 'kind',
      header: t('informes.tipo'),
      render: (r) => (
        <span className={r.kind === 'entrada' ? 'text-success-700' : 'text-danger-700'}>
          {r.kind === 'entrada' ? t('movimientos.entrada') : t('movimientos.salida')}
        </span>
      ),
    },
    {
      key: 'item_type',
      header: t('informes.tipoItem'),
      render: (r) => (
        <span className="capitalize">
          {r.item_type === 'product' ? t('informes.producto') : r.item_type === 'medication' ? t('informes.medicamento') : t('informes.kit')}
        </span>
      ),
    },
    { key: 'item_name', header: t('informes.nombre') },
    { key: 'qty', header: t('movimientos.cantidad'), className: 'text-right' },
    {
      key: 'party',
      header: t('informes.deQuien'),
      render: (r) =>
        r.kind === 'entrada'
          ? r.donor_name ?? t('informes.sinDonante')
          : r.recipient_name ?? t('informes.sinReceptor'),
    },
    { key: 'nota', header: t('movimientos.nota'), render: (r) => r.nota ?? '-' },
  ];

  const handleExport = () => {
    if (!donations.length) {
      toast.push({ message: t('informes.noData'), tone: 'neutral' });
      return;
    }
    exportToCsv(
      `donaciones-${warehouseName.replace(/\s+/g, '-')}.csv`,
      donations.map((r) => ({
        Fecha: formatDate(r.fecha),
        Tipo: r.kind === 'entrada' ? t('movimientos.entrada') : t('movimientos.salida'),
        'Tipo de item':
          r.item_type === 'product' ? t('informes.producto') : r.item_type === 'medication' ? t('informes.medicamento') : t('informes.kit'),
        Item: r.item_name,
        Cantidad: r.qty,
        [r.kind === 'entrada' ? 'Donante' : 'Beneficiario']:
          r.kind === 'entrada' ? r.donor_name ?? '' : r.recipient_name ?? '',
        Nota: r.nota ?? '',
      })),
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{t('informes.donacionesTitulo')}</h1>
      </header>

      <WarehouseSelect value={warehouseId} onChange={setWarehouseId} required />

      {warehouseId && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="dn-from" label={t('informes.desde')}>
              <input id="dn-from" type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field id="dn-to" label={t('informes.hasta')}>
              <input id="dn-to" type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
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

          <Segmented
            ariaLabel={t('informes.filtrarPor')}
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: t('informes.todos') },
              { value: 'entrada', label: t('movimientos.entrada') },
              { value: 'salida', label: t('movimientos.salida') },
            ]}
          />

          <div className="flex items-center justify-between gap-2">
            <p className="text-caption text-muted">
              {t('informes.resultados', { count: donations.length })}
            </p>
            {donations.length > 0 && (
              <Button onClick={handleExport}>
                <Download size={18} aria-hidden="true" />
                {t('informes.csv')}
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            data={donations}
            loading={isLoading}
            emptyMessage={t('informes.donaciones.empty')}
          />
        </>
      )}
    </div>
  );
}
