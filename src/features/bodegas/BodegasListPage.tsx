import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { fetchWarehouses, type Warehouse } from '../../lib/warehouseOps';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../components/auth/AuthProvider';
import { BodegaFormModal } from './BodegaFormModal';

export function BodegasListPage() {
  const { role } = useAuth();
  const canEdit = role === 'super_admin' || role === 'admin';

  const { data: bodegas = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => fetchWarehouses(true),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);

  const columns: Column<Warehouse>[] = [
    { key: 'name', header: 'Nombre', sortable: true },
    { key: 'code', header: 'Código', sortable: true },
    { key: 'address', header: 'Dirección', render: (r) => r.address || '-', className: 'hidden sm:table-cell' },
    {
      key: 'is_active',
      header: 'Estado',
      render: (r) => <Badge variant={r.is_active ? 'success' : 'danger'}>{r.is_active ? 'Activa' : 'Inactiva'}</Badge>,
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
