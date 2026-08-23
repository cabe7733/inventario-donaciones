import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { fetchOrders, type Order } from '../../lib/orderOps';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
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

  const columns: Column<Order>[] = [
    {
      key: 'created_at',
      header: 'Fecha',
      sortable: true,
      render: (r) => new Date(r.created_at).toLocaleDateString('es-VE'),
    },
    {
      key: 'donor_full_name',
      header: type === 'entrada' ? 'Donante' : 'Destinatario',
      render: (r) => {
        if (type === 'entrada') {
          return r.donor_entity_name ?? r.donor_full_name ?? '-';
        }
        return r.recipient_entity_name ?? r.recipient_full_name ?? '-';
      },
    },
    {
      key: 'vehicle_plate',
      header: 'Vehículo',
      render: (r) => r.vehicle_plate ?? '-',
    },
    {
      key: 'notes',
      header: 'Notas',
      render: (r) => (
        <span className="max-w-[200px] truncate block">{r.notes || '-'}</span>
      ),
    },
    {
      key: 'created_by',
      header: 'Registrado por',
      render: (r) => r.created_by.slice(0, 8) + '...',
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-h2">
          {type === 'entrada' ? 'Entradas' : 'Salidas'}
        </h1>
        {canEdit && (
          <Button onClick={() => navigate(`/entradas/nueva?tipo=${type}`)}>
            <Plus size={18} className="mr-1" />
            Nueva {type === 'entrada' ? 'entrada' : 'salida'}
          </Button>
        )}
      </header>

      <DataTable
        columns={columns}
        data={orders}
        loading={isLoading}
        emptyMessage={`No hay ${type === 'entrada' ? 'entradas' : 'salidas'} registradas`}
      />
    </div>
  );
}
