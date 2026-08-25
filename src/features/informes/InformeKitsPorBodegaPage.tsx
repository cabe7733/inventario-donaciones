import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Download } from '@phosphor-icons/react';
import { fetchKits } from '../../lib/db';
import { fetchWarehouses } from '../../lib/warehouseOps';
import { fetchKitsByWarehouseMatrix } from '../../lib/reportOps';
import { exportToCsv } from '../../lib/exporters';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export function InformeKitsPorBodegaPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => fetchWarehouses(),
  });

  const { data: kits = [] } = useQuery({
    queryKey: ['kits'],
    queryFn: fetchKits,
  });

  const { data: cells = [], isLoading } = useQuery({
    queryKey: ['kits-by-warehouse-matrix'],
    queryFn: () => fetchKitsByWarehouseMatrix(),
  });

  // Índice bodega+kit → stock
  const stockByCell = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cells) m.set(`${c.warehouse_id}|${c.kit_id}`, c.stock);
    return m;
  }, [cells]);

  const activeWarehouses = useMemo(() => warehouses, [warehouses]);
  const activeKits = useMemo(
    () => kits.filter((k) => k.is_active).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [kits],
  );

  const totalByWarehouse = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cells) {
      m.set(c.warehouse_id, (m.get(c.warehouse_id) ?? 0) + c.stock);
    }
    return m;
  }, [cells]);

  const totalByKit = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cells) {
      m.set(c.kit_id, (m.get(c.kit_id) ?? 0) + c.stock);
    }
    return m;
  }, [cells]);

  const grandTotal = useMemo(() => cells.reduce((acc, c) => acc + c.stock, 0), [cells]);

  const handleExport = () => {
    if (!activeWarehouses.length || !activeKits.length) {
      toast.push({ message: t('informes.noData'), tone: 'neutral' });
      return;
    }
    exportToCsv(
      'kits-por-bodega.csv',
      activeKits.map((k) => {
        const row: Record<string, unknown> = { Kit: k.name };
        for (const w of activeWarehouses) {
          row[w.name] = stockByCell.get(`${w.id}|${k.id}`) ?? 0;
        }
        row.Total = totalByKit.get(k.id) ?? 0;
        return row;
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{t('informes.kitsTitulo')}</h1>
        {activeKits.length > 0 && activeWarehouses.length > 0 && (
          <Button onClick={handleExport}>
            <Download size={18} aria-hidden="true" />
            {t('informes.csv')}
          </Button>
        )}
      </header>

      <p className="text-body-sm text-muted">{t('informes.kits.desc')}</p>

      {isLoading ? (
        <p className="text-body text-muted">{t('common.loading')}</p>
      ) : activeWarehouses.length === 0 || activeKits.length === 0 ? (
        <p className="text-body text-muted">{t('informes.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="bg-surface text-left text-label text-muted">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">{t('informes.kit')}</th>
                {activeWarehouses.map((w) => (
                  <th key={w.id} className="px-3 py-2 font-medium">{w.name}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold text-fg">{t('informes.total')}</th>
              </tr>
            </thead>
            <tbody>
              {activeKits.map((k) => (
                <tr key={k.id} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">{k.name}</td>
                  {activeWarehouses.map((w) => {
                    const stock = stockByCell.get(`${w.id}|${k.id}`);
                    const has = stock !== undefined && stock !== 0;
                    return (
                      <td
                        key={w.id}
                        className={`px-3 py-2 text-right tabular-nums ${
                          !has ? 'text-muted' : stock! < 0 ? 'text-danger-700 font-semibold' : 'text-fg'
                        }`}
                      >
                        {has ? stock : '·'}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary-700">
                    {totalByKit.get(k.id) ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface">
                <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-semibold">{t('informes.total')}</td>
                {activeWarehouses.map((w) => (
                  <td key={w.id} className="px-3 py-2 text-right font-semibold tabular-nums text-primary-700">
                    {totalByWarehouse.get(w.id) ?? 0}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary-700">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
