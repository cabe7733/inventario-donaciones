import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { fetchOrders, type OrderWithRefs } from '../../lib/orderOps';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { PageContainer } from '../../components/layout/PageContainer';
import { useAuth } from '../../components/auth/AuthProvider';

interface OrdersListPageProps {
  type: 'entrada' | 'salida';
}

export function OrdersListPage({ type }: OrdersListPageProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = role === 'super_admin' || role === 'admin';

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', type],
    queryFn: () => fetchOrders(type),
  });

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
      key: 'notes',
      header: 'Notas',
      render: (r) => (
        <span className="max-w-[200px] truncate block">{r.notes || '-'}</span>
      ),
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
