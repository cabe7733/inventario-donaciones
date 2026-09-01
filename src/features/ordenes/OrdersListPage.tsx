import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { deleteOrder, fetchOrders, type OrderWithRefs, type OrderItem } from '../../lib/orderOps';
import { fetchProducts, fetchMedications, fetchKits } from '../../lib/db';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PageContainer } from '../../components/layout/PageContainer';
import { useAuth } from '../../components/auth/AuthProvider';
import { useToast } from '../../components/ui/Toast';

interface OrdersListPageProps {
  type: 'entrada' | 'salida';
}

const MAX_VISIBLE_ITEMS = 3;

export function OrdersListPage({ type }: OrdersListPageProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canCreate = role === 'super_admin' || role === 'admin';
  // ponytail: solo super_admin edita/elimina órdenes (RLS + RPC lo enforcen).
  const canEdit = role === 'super_admin';
  const queryClient = useQueryClient();
  const toast = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      toast.push({
        message: type === 'entrada' ? 'Entrada eliminada y stock revertido' : 'Salida eliminada y stock revertido',
        tone: 'success',
      });
      setDeletingId(null);
    },
    onError: (e) => {
      toast.push({
        message: e instanceof Error ? e.message : 'Error al eliminar',
        tone: 'error',
      });
    },
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
    {
      key: 'actions',
      header: '',
      className: 'w-px',
      render: (r) =>
        canEdit ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Editar ${type}`}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/entradas/nueva?id=${r.id}`);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-neutral-100 hover:text-fg dark:hover:bg-neutral-800"
            >
              <PencilSimple size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Eliminar ${type}`}
              onClick={(e) => {
                e.stopPropagation();
                setDeletingId(r.id);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-danger-700 hover:bg-danger-500/10"
            >
              <Trash size={16} aria-hidden="true" />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <PageContainer className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-h2">
          {type === 'entrada' ? 'Entradas' : 'Salidas'}
        </h1>
        {canCreate && (
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

      {deletingId && (
        <Modal
          open
          onClose={() => { if (!deleteMutation.isPending) setDeletingId(null); }}
          title={`Eliminar ${type}`}
        >
          <div className="flex flex-col gap-4">
            <p className="text-body">
              ¿Eliminar esta {type === 'entrada' ? 'entrada' : 'salida'}? El stock será revertido.
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeletingId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
