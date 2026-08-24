import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DotsThree, FileArrowDown, Plus, UploadSimple } from '@phosphor-icons/react';
import { fetchVolunteers, importVolunteersFromRows, type Volunteer } from '../../lib/volunteerOps';
import { parseVolunteerFile } from '../../lib/parseCsv';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dropdown } from '../../components/ui/Dropdown';
import { ImportDialog, type ImportDialogConfig, type ParsedImportRow } from '../../components/ui/ImportDialog';
import { PageContainer } from '../../components/layout/PageContainer';
import { VoluntarioFormModal } from './VoluntarioFormModal';
import { useAuth } from '../../components/auth/AuthProvider';
import { useToast } from '../../components/ui/Toast';

const VOLUNTEERS_TEMPLATE = 'nombre;telefono;email;documento;habilidades;disponibilidad\nJuan Pérez;3001234567;juan@email.com;12345678;cocina,logística;tiempo completo\nMaría García;3007654321;maria@email.com;87654321;medicina;fines de semana\n';

export function VoluntariosListPage() {
  const { role, centerId } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEdit = role === 'super_admin' || role === 'admin';

  const { data: voluntarios = [], isLoading } = useQuery({
    queryKey: ['volunteers'],
    queryFn: fetchVolunteers,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Volunteer | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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

  const downloadTemplate = () => {
    const blob = new Blob([VOLUNTEERS_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-voluntarios.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig: ImportDialogConfig = {
    scope: 'volunteers',
    onImport: async (rows) => {
      if (!centerId) throw new Error('No hay centro activo');
      const data = rows.map((r) => ({
        full_name: String(r.full_name ?? ''),
        phone: r.phone ? String(r.phone) : undefined,
        email: r.email ? String(r.email) : undefined,
        id_number: r.id_number ? String(r.id_number) : undefined,
        skills: r.skills ? String(r.skills) : undefined,
        availability: r.availability ? String(r.availability) : undefined,
      }));
      const stats = await importVolunteersFromRows(data, centerId);
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      toast.push({ message: `Importación completada: ${stats.ok} voluntarios`, tone: 'success' });
      return stats as { ok: number; [k: string]: unknown };
    },
    templateFilename: 'plantilla-voluntarios.csv',
    templateContent: VOLUNTEERS_TEMPLATE,
    parseFile: (text) => parseVolunteerFile(text) as unknown as ParsedImportRow[],
    validateRow: (r) => {
      if (!r.full_name) return { ok: false, reason: 'Falta nombre del voluntario' };
      return { ok: true };
    },
  };

  return (
    <PageContainer>
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-h2">Voluntarios</h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Dropdown
              ariaLabel="Más acciones"
              align="right"
              trigger={
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-fg hover:bg-neutral-100 dark:hover:bg-neutral-100">
                  <DotsThree size={20} weight="bold" aria-hidden="true" />
                </span>
              }
              items={[
                {
                  key: 'import',
                  label: 'Importar archivo',
                  icon: <UploadSimple size={16} aria-hidden="true" />,
                  onClick: () => setImportOpen(true),
                },
                {
                  key: 'template',
                  label: 'Descargar plantilla',
                  icon: <FileArrowDown size={16} aria-hidden="true" />,
                  onClick: () => downloadTemplate(),
                },
              ]}
            />
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus size={18} aria-hidden="true" />
              Nuevo voluntario
            </Button>
          </div>
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

      {importOpen && (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          config={importConfig}
        />
      )}
    </PageContainer>
  );
}
