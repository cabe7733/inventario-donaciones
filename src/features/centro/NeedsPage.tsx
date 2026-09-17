import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardText, Plus, Database, Note, PencilSimple, Trash } from '@phosphor-icons/react';
import { useAuth } from '../../components/auth/AuthProvider';
import { fetchCenterNeeds, deleteCenterNeed } from '../../lib/needOps';
import { syncCenterNeedsFromInventory } from '../../lib/centerOps';
import type { CenterNeed } from '../../lib/needOps';
import { NeedFormModal } from './NeedFormModal';
import { Button } from '../../components/ui/Button';
import { PageContainer, PageHeader } from '../../components/layout/PageContainer';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';

export function NeedsPage() {
  const { centerId } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNeed, setEditingNeed] = useState<CenterNeed | null>(null);

  const { data: needs = [], isLoading } = useQuery({
    queryKey: ['center-needs', centerId],
    queryFn: () => fetchCenterNeeds(centerId!),
    enabled: !!centerId,
    staleTime: 2 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: () => syncCenterNeedsFromInventory(centerId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['center-needs', centerId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (needId: string) => deleteCenterNeed(needId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['center-needs', centerId] });
    },
  });

  const handleCreate = () => {
    setEditingNeed(null);
    setModalOpen(true);
  };

  const handleEdit = (need: CenterNeed) => {
    setEditingNeed(need);
    setModalOpen(true);
  };

  const handleDelete = (needId: string) => {
    if (confirm('¿Estás seguro de eliminar esta necesidad?')) {
      deleteMutation.mutate(needId);
    }
  };

  const derivedNeeds = needs.filter((n) => n.source === 'inventory');
  const manualNeeds = needs.filter((n) => n.source === 'manual');

  const priorityConfig: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgente', color: 'danger' },
    high: { label: 'Alta', color: 'warning' },
    medium: { label: 'Media', color: 'info' },
    low: { label: 'Normal', color: 'success' },
  };

  return (
    <PageContainer>
      <PageHeader
        title="Necesidades"
        description="Gestiona las necesidades de tu centro. Las detectadas del inventario se actualizan automáticamente."
        actions={
          <Button variant="primary" onClick={handleCreate}>
            <Plus size={16} aria-hidden />
            Crear necesidad
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : needs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-surface-card py-16 text-center shadow-elev-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-950/60 text-primary-400 ring-1 ring-primary-200/50 dark:ring-primary-800/40">
            <ClipboardText size={28} />
          </div>
          <h3 className="mt-4 text-h2 text-text-primary">Sin necesidades</h3>
          <p className="mt-1 max-w-sm text-body-sm text-text-secondary">
            Aún no hay necesidades registradas. Crea una manualmente o sincroniza desde el inventario.
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <Database size={16} aria-hidden />
              {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar inventario'}
            </Button>
            <Button variant="primary" onClick={handleCreate}>
              <Plus size={16} aria-hidden />
              Crear necesidad
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sync action bar */}
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-card p-4 shadow-elev-1">
            <div className="flex items-center gap-3">
              <Database size={16} className="text-text-tertiary" />
              <div>
                <p className="text-body-sm font-medium text-text-primary">Inventario automático</p>
                <p className="text-caption text-text-tertiary">
                  {derivedNeeds.length} necesidad{derivedNeeds.length !== 1 ? 'es' : ''} detectada{derivedNeeds.length !== 1 ? 's' : ''} del inventario
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          </div>

          {/* Derived needs */}
          {derivedNeeds.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Database size={14} className="text-primary-600 dark:text-primary-400" />
                <h3 className="text-body font-semibold text-text-primary">Del inventario</h3>
                <Badge variant="info">{derivedNeeds.length}</Badge>
              </div>
              <div className="space-y-2">
                {derivedNeeds.map((need) => (
                  <NeedRow key={need.id} need={need} priorityConfig={priorityConfig} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}

          {/* Manual needs */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Note size={14} className="text-accent-600 dark:text-accent-400" />
                <h3 className="text-body font-semibold text-text-primary">Solicitudes manuales</h3>
                <Badge variant="info">{manualNeeds.length}</Badge>
              </div>
            </div>
            {manualNeeds.length === 0 ? (
              <p className="text-body-sm text-text-secondary">No hay solicitudes manuales creadas.</p>
            ) : (
              <div className="space-y-2">
                {manualNeeds.map((need) => (
                  <NeedRow key={need.id} need={need} priorityConfig={priorityConfig} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <NeedFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingNeed(null); }}
        centerId={centerId!}
        editingNeed={editingNeed}
      />
    </PageContainer>
  );
}

function NeedRow({
  need,
  priorityConfig,
  onEdit,
  onDelete,
}: {
  need: CenterNeed;
  priorityConfig: Record<string, { label: string; color: string }>;
  onEdit: (need: CenterNeed) => void;
  onDelete: (id: string) => void;
}) {
  const p = priorityConfig[need.priority] ?? priorityConfig.medium;
  const isVolunteer = need.item_type === 'volunteer';

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-card p-4 shadow-elev-1">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-body-sm font-medium text-text-primary truncate">{need.title}</h4>
          <Badge variant={p.color as 'danger' | 'warning' | 'info' | 'success'}>{p.label}</Badge>
          {isVolunteer ? (
            <Badge variant="warning">👥 Voluntarios ({need.quantity_needed || 1} pers.)</Badge>
          ) : (
            need.item_id && <Badge variant="default">Vinculado</Badge>
          )}
        </div>
        {need.description && (
          <p className="mt-0.5 text-caption text-text-tertiary line-clamp-1">{need.description}</p>
        )}
        {!isVolunteer && need.quantity_needed > 0 && (
          <p className="mt-0.5 text-caption text-text-tertiary">
            Recibidos: {need.quantity_received} / Meta: {need.quantity_needed}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(need)}
          className="rounded-lg p-1.5 text-text-tertiary hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
          title="Editar"
        >
          <PencilSimple size={14} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(need.id)}
          className="rounded-lg p-1.5 text-text-tertiary hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/40 transition-colors"
          title="Eliminar"
        >
          <Trash size={14} />
        </button>
      </div>
    </div>
  );
}
