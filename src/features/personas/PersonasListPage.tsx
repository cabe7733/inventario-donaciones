import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download } from '@phosphor-icons/react';
import { fetchParties, type Party, type PartyKind } from '../../lib/donorOps';
import { exportToCsv } from '../../lib/exporters';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../components/auth/AuthProvider';
import { PersonaFormModal } from './PersonaFormModal';

interface Props {
  kind: PartyKind;
}

export function PersonasListPage({ kind }: Props) {
  const { role } = useAuth();
  const canEdit = role === 'super_admin' || role === 'admin';

  const { data: parties = [], isLoading } = useQuery({
    queryKey: ['parties', kind],
    queryFn: () => fetchParties(kind),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);

  const label = kind === 'donor' ? 'Donantes' : 'Beneficiarios';
  const fileName = kind === 'donor' ? 'donantes' : 'beneficiarios';

  const handleExport = () => {
    if (!parties.length) return;
    exportToCsv(
      `${fileName}.csv`,
      parties.map((p) => ({
        Nombre: p.full_name,
        Tipo: p.kind === 'entity' ? 'Entidad' : 'Persona',
        Documento: p.id_number ?? '',
        Teléfono: p.phone ?? '',
        Email: p.email ?? '',
        Dirección: p.address ?? '',
      })),
    );
  };

  const columns: Column<Party>[] = [
    { key: 'full_name', header: 'Nombre', sortable: true },
    { key: 'id_number', header: 'Documento', render: (r) => r.id_number || '-', className: 'hidden sm:table-cell' },
    { key: 'phone', header: 'Teléfono', render: (r) => r.phone || '-', className: 'hidden sm:table-cell' },
    { key: 'email', header: 'Email', render: (r) => r.email || '-', className: 'hidden md:table-cell' },
    {
      key: 'kind',
      header: 'Tipo',
      render: (r) => <Badge variant={r.kind === 'entity' ? 'info' : 'default'}>{r.kind === 'entity' ? 'Entidad' : 'Persona'}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">{label}</h1>
        <div className="flex gap-2">
          {parties.length > 0 && (
            <Button variant="ghost" onClick={handleExport}>
              <Download size={18} aria-hidden="true" />
              CSV
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus size={18} aria-hidden="true" />
              Nuevo
            </Button>
          )}
        </div>
      </header>

      <DataTable
        columns={columns}
        data={parties}
        loading={isLoading}
        emptyMessage={`No hay ${label.toLowerCase()} registrados`}
        onRowClick={canEdit ? (row) => { setEditing(row); setFormOpen(true); } : undefined}
      />

      {formOpen && (
        <PersonaFormModal
          party={editing}
          kind={kind}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
