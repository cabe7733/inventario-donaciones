import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { fetchVolunteers, type Volunteer } from '../../lib/volunteerOps';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { VoluntarioFormModal } from './VoluntarioFormModal';
import { useAuth } from '../../components/auth/AuthProvider';

export function VoluntariosListPage() {
  const { role } = useAuth();
  const canEdit = role === 'super_admin' || role === 'admin';

  const { data: voluntarios = [], isLoading } = useQuery({
    queryKey: ['volunteers'],
    queryFn: fetchVolunteers,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Volunteer | null>(null);

  const columns: Column<Volunteer>[] = [
    { key: 'full_name', header: 'Nombre', sortable: true },
    { key: 'email', header: 'Email', sortable: true, render: (r) => r.email ?? '-' },
    { key: 'phone', header: 'Teléfono', render: (r) => r.phone ?? '-' },
    {
      key: 'availability',
      header: 'Disponibilidad',
      render: (r) => r.availability ?? '-',
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (r) => <Badge variant={r.is_active ? 'success' : 'danger'}>{r.is_active ? 'Activo' : 'Inactivo'}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-h2">Voluntarios</h1>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={18} className="mr-1" />
            Nuevo voluntario
          </Button>
        )}
      </header>

      <DataTable
        columns={columns}
        data={voluntarios}
        loading={isLoading}
        emptyMessage="No hay voluntarios registrados"
        onRowClick={canEdit ? (row) => { setEditing(row); setFormOpen(true); } : undefined}
      />

      {formOpen && (
        <VoluntarioFormModal
          volunteer={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
