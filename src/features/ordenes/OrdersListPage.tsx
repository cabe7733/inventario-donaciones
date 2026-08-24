import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { fetchOrders, type OrderWithRefs, type OrderItem } from '../../lib/orderOps';
import { fetchProducts, fetchMedications, fetchKits } from '../../lib/db';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { PageContainer } from '../../components/layout/PageContainer';
import { useAuth } from '../../components/auth/AuthProvider';

interface OrdersListPageProps {
  type: 'entrada' | 'salida';
}

const MAX_VISIBLE_ITEMS = 3;

export function OrdersListPage({ type }: OrdersListPageProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = role === 'super_admin' || role === 'admin';

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', type],
    queryFn: () => fetchOrders(type),
  });

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const { data: medications = [] } = useQuery({ queryKey: ['medications'], queryFn: fetchMedications });
  const { data: kits = [] } = useQuery({ queryKey: ['kits'], queryFn: fetchKits });

  const itemNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(`product:${p.id}`, p.name);
    for (const m of medications) map.set(`medication:${m.id}`, m.name);
    for (const k of kits) map.set(`kit:${k.id}`, k.name);
    return map;
  }, [products, medications, kits]);

  const itemLabel = (it: OrderItem): string => {
    const name = itemNameById.get(`${it.item_type}:${it.item_id}`) ?? 'Item';
    return `${name} ×${it.qty}`;
  };

  const columns: Column<OrderWithRefs>[] = [
    {
      key: 'created_at',
      header: 'Fecha',
      sortable: true,
      render: (r) => new Date(r.created_at).toLocaleDateString('es-VE'),
    },
    {
      key: 'donor_full_name',
      header: type === 'entrada' ? 'Donante' : 'Beneficiario',
      render: (r) => {
        if (type === 'entrada') {
          return r.donors?.full_name ?? r.donor_full_name ?? '-';
        }
        return r.recipients?.full_name ?? r.recipient_full_name ?? '-';
      },
    },
    {
      key: 'warehouse_id',
      header: 'Bodega',
      render: (r) => r.warehouses?.name ?? '-',
      className: 'hidden sm:table-cell',
    },
    {
      key: 'items',
      header: type === 'entrada' ? 'Productos ingresados' : 'Productos egresados',
      render: (r) => {
        const items = r.order_items ?? [];
        if (items.length === 0) return <span className="text-muted">—</span>;
        const visible = items.slice(0, MAX_VISIBLE_ITEMS);
        const rest = items.length - visible.length;
        return (
          <div className="flex max-w-[280px] flex-wrap gap-1">
            {visible.map((it) => (
              <span
                key={it.id}
                className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-caption"
              >
                {itemLabel(it)}
              </span>
            ))}
            {rest > 0 && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-caption text-muted">
                +{rest}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'notes',
      header: 'Notas',
      render: (r) => (
        <span className="max-w-[200px] truncate block">{r.notes || '-'}</span>
      ),
      className: 'hidden md:table-cell',
    },
  ];

  return (
    <PageContainer>
      <header className="flex items-center justify-between">
        <h1 className="text-h2">
          {type === 'entrada' ? 'Entradas' : 'Salidas'}
        </h1>
        {canEdit && (
          <Button onClick={() => navigate(`/entradas/nueva?tipo=${type}`)}>
            <Plus size={18} className="mr-1" />
            Nueva
          </Button>
        )}
      </header>

      <DataTable
        columns={columns}
        data={orders}
        loading={isLoading}
        emptyMessage={`No hay ${type === 'entrada' ? 'entradas' : 'salidas'} registradas`}
      />
    </PageContainer>
  );
}
