import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, MinusCircle, PencilSimple, Plus } from '@phosphor-icons/react';
import { fetchWarehouses, toggleWarehouseActive, type Warehouse } from '../../lib/warehouseOps';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../components/auth/AuthProvider';
import { useToast } from '../../components/ui/Toast';
import { BodegaFormModal } from './BodegaFormModal';

export function BodegasListPage() {
  const { role } = useAuth();
  const canEdit = role === 'super_admin' || role === 'admin';
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: bodegas = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => fetchWarehouses(true),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleWarehouseActive(id, active),
    onSuccess: (_data, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.push({
        message: active ? 'Bodega activada' : 'Bodega desactivada',
        tone: active ? 'success' : 'neutral',
      });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : 'Error al cambiar estado';
      toast.push({ message: msg, tone: 'error' });
    },
  });

  const columns: Column<Warehouse>[] = [
    {
      key: 'name',
      header: 'Nombre',
      sortable: true,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold">{r.name}</span>
          <span className="text-caption text-muted">Código: {r.code}</span>
        </div>
      ),
    },
    { key: 'code', header: 'Código', sortable: true, className: 'hidden md:table-cell' },
    {
      key: 'address',
      header: 'Dirección',
      render: (r) => r.address || '-',
      className: 'hidden sm:table-cell',
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (r) => (
        <Badge variant={r.is_active ? 'success' : 'danger'}>{r.is_active ? 'Activa' : 'Inactiva'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) =>
        canEdit ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Editar ${r.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setEditing(r);
                setFormOpen(true);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-neutral-100 hover:text-fg dark:hover:bg-neutral-800"
            >
              <PencilSimple size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={r.is_active ? `Desactivar ${r.name}` : `Activar ${r.name}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleMutation.mutate({ id: r.id, active: !r.is_active });
              }}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${
                r.is_active
                  ? 'text-danger-700 hover:bg-danger-500/10'
                  : 'text-success-700 hover:bg-success-500/10'
              }`}
            >
              {r.is_active ? <MinusCircle size={16} aria-hidden="true" /> : <CheckCircle size={16} aria-hidden="true" />}
            </button>
          </div>
        ) : null,
      className: 'w-px',
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">Bodegas</h1>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={18} aria-hidden="true" />
            Nueva bodega
          </Button>
        )}
      </header>

      <DataTable
        columns={columns}
        data={bodegas}
        loading={isLoading}
        emptyMessage="No hay bodegas registradas"
        onRowClick={canEdit ? (row) => { setEditing(row); setFormOpen(true); } : undefined}
      />

      {formOpen && (
        <BodegaFormModal
          warehouse={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}