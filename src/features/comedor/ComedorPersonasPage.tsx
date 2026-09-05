import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileArrowDown, Plus, UploadSimple } from '@phosphor-icons/react';
import { fetchComedorPeople, fetchVisits, importComedorRows, type ComedorPerson } from '../../lib/comedorOps';
import { parseComedorFile } from '../../lib/parseCsv';
import { PageContainer } from '../../components/layout/PageContainer';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Dropdown } from '../../components/ui/Dropdown';
import { ImportDialog, type ImportDialogConfig, type ParsedImportRow } from '../../components/ui/ImportDialog';
import { ComedorPersonaFormModal } from './ComedorPersonaFormModal';
import { useAuth } from '../../components/auth/AuthProvider';
import { useToast } from '../../components/ui/Toast';

const TEMPLATE = 'nombre;apellido;celular;numero_documento;fecha\nJuan;Pérez;3001234567;12345678;2026-09-02\n';

export function ComedorPersonasPage() {
  const { centerId, role } = useAuth();
  const canEdit = role === 'super_admin' || role === 'admin';
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: people = [], isLoading } = useQuery({ queryKey: ['comedor-people'], queryFn: fetchComedorPeople });
  const [editing, setEditing] = useState<ComedorPerson | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const columns: Column<ComedorPerson>[] = [
    { key: 'nombre', header: 'Nombre', sortable: true, render: (r) => `${r.nombre} ${r.apellido ?? ''}`.trim() },
    { key: 'celular', header: 'Celular', render: (r) => r.celular || '-' },
    { key: 'numero_documento', header: 'Documento', render: (r) => r.numero_documento || '-' },
    { key: 'id', header: 'Días de visita', render: (r) => <VisitDates personId={r.id} /> },
  ];
  const config: ImportDialogConfig = {
    scope: 'comedor', templateFilename: 'plantilla-comedor.csv', templateContent: TEMPLATE,
    parseFile: (text) => parseComedorFile(text) as unknown as ParsedImportRow[],
    validateRow: (row) => !row.nombre ? { ok: false, reason: 'Falta el nombre' } : !row.fecha ? { ok: false, reason: 'Falta la fecha (AAAA-MM-DD)' } : { ok: true },
    onImport: async (rows) => {
      if (!centerId) throw new Error('No hay centro activo');
      const stats = await importComedorRows(rows.map((row) => ({ nombre: String(row.nombre), apellido: String(row.apellido ?? ''), celular: String(row.celular ?? ''), numero_documento: String(row.numero_documento ?? ''), fecha: String(row.fecha) })), centerId);
      await queryClient.invalidateQueries({ queryKey: ['comedor-people'] });
      toast.push({ message: `Importación completada: ${stats.ok} visitas`, tone: 'success' });
      return stats;
    },
  };
  const downloadTemplate = () => { const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'plantilla-comedor.csv'; a.click(); URL.revokeObjectURL(url); };
  return <PageContainer className="flex flex-col gap-5">
    <header className="flex items-center justify-between gap-2"><div><h1 className="text-h2">Comedor comunitario</h1><p className="text-body-sm text-muted">Personas y días de asistencia</p></div>{canEdit && <div className="flex gap-2"><Dropdown ariaLabel="Más acciones" align="right" trigger={<span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card"><UploadSimple size={20} /></span>} items={[{ key: 'import', label: 'Importar archivo', icon: <UploadSimple size={16} />, onClick: () => setImportOpen(true) }, { key: 'template', label: 'Descargar plantilla', icon: <FileArrowDown size={16} />, onClick: downloadTemplate }]} /><Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={18} /> Nuevo</Button></div>}</header>
    <DataTable columns={columns} data={people} loading={isLoading} emptyMessage="No hay asistentes registrados" onRowClick={canEdit ? (row) => { setEditing(row); setFormOpen(true); } : undefined} />
    {formOpen && <ComedorPersonaFormModal person={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />}
    {importOpen && <ImportDialog open onClose={() => setImportOpen(false)} config={config} />}
  </PageContainer>;
}

function VisitDates({ personId }: { personId: string }) {
  const { data = [] } = useQuery({ queryKey: ['comedor-visits', personId], queryFn: () => fetchVisits(personId) });
  const dates = data.map((visit) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${visit.visit_date}T00:00:00Z`)));
  return <span title={dates.join(', ') || 'Sin visitas'}>{dates.join(', ') || '-'}</span>;
}
