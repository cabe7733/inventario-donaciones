import { useEffect, useState } from 'react';
import { PencilSimple, Trash, Calendar, User, Note, Hash, Pill, Warning } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../components/auth/AuthProvider';
import { useToast } from '../../components/ui/Toast';
import { deleteMedicationMovement } from '../../lib/medicationOps';
import { formatDateShort, formatNumber, formatTime } from '../../lib/format';
import type { Medication, MedicationLot, Movement, Unit } from '../../lib/db';
import { supabase } from '../../lib/supabase';

interface MovementDetailModalProps {
  movement: Movement | null;
  medication: Medication | null;
  unit: Unit | null;
  open: boolean;
  onClose: () => void;
  onEdit: (movement: Movement) => void;
  onReload: () => void;
}

export function MovementDetailModal({
  movement,
  medication,
  unit,
  open,
  onClose,
  onEdit,
  onReload,
}: MovementDetailModalProps) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [lot, setLot] = useState<MedicationLot | null>(null);
  const [partyName, setPartyName] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit = hasPermission('medicamentos', 'edit');
  const canDelete = hasPermission('medicamentos', 'delete');

  useEffect(() => {
    if (!movement) return;
    setLot(null);
    setPartyName('');
    setConfirmDelete(false);

    // Cargar lote
    if (movement.lote_id) {
      supabase
        .from('medication_lots')
        .select('*')
        .eq('id', movement.lote_id)
        .single()
        .then(({ data }) => { if (data) setLot(data as MedicationLot); });
    }

    // Cargar donante o beneficiario
    if (movement.donor_id) {
      supabase
        .from('donors')
        .select('full_name')
        .eq('id', movement.donor_id)
        .single()
        .then(({ data }) => { if (data) setPartyName(data.full_name); });
    } else if (movement.recipient_id) {
      supabase
        .from('recipients')
        .select('full_name')
        .eq('id', movement.recipient_id)
        .single()
        .then(({ data }) => { if (data) setPartyName(data.full_name); });
    }
  }, [movement]);

  if (!movement) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMedicationMovement(movement.id);
      toast.push({ message: 'Movimiento eliminado y stock ajustado', tone: 'success' });
      onClose();
      onReload();
    } catch (err: unknown) {
      toast.push({
        message: err instanceof Error ? err.message : 'Error al eliminar movimiento',
        tone: 'error',
      });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const isEntrada = movement.kind === 'entrada';

  return (
    <Modal open={open} onClose={onClose} title={`Detalle de ${isEntrada ? 'Entrada' : 'Salida'} de Medicamento`}>
      <div className="flex flex-col gap-4">
        {/* Header Badge */}
        <div className="flex items-center justify-between rounded-lg bg-surface border border-border p-3">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-caption font-bold ${
                isEntrada ? 'bg-success-500/15 text-success-700' : 'bg-secondary-500/15 text-secondary-700'
              }`}
            >
              {isEntrada ? '+' : '−'}
            </span>
            <div>
              <p className="text-body font-semibold capitalize">{movement.kind}</p>
              <p className="text-caption text-muted">
                {formatDateShort(movement.fecha)} · {formatTime(movement.fecha)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-numeric-lg font-bold ${isEntrada ? 'text-success-700' : 'text-secondary-700'}`}>
              {isEntrada ? '+' : '−'}{formatNumber(movement.qty)} {unit?.abbreviation ?? ''}
            </p>
          </div>
        </div>

        {/* Medicamento Info */}
        <div className="rounded-lg border border-border p-3 flex flex-col gap-1.5 bg-card">
          <div className="flex items-center gap-2 text-fg font-medium">
            <Pill size={18} className="text-primary-600" />
            <span>{medication?.name ?? 'Medicamento no especificado'}</span>
          </div>
          {medication?.presentacion && (
            <p className="text-caption text-muted pl-6">Presentación: {medication.presentacion}</p>
          )}
          {(medication?.active_ingredient || medication?.manufacturer) && (
            <p className="text-caption text-muted pl-6">
              {[medication.active_ingredient, medication.manufacturer].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Detalles Adicionales */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-caption">
          {lot && (
            <div className="flex items-center gap-2 rounded-lg border border-border p-2 bg-surface">
              <Hash size={16} className="text-muted shrink-0" />
              <div>
                <p className="text-muted">Lote</p>
                <p className="font-semibold text-fg">{lot.lote || 's/n'}</p>
              </div>
            </div>
          )}

          {lot?.fecha_vencimiento && (
            <div className="flex items-center gap-2 rounded-lg border border-border p-2 bg-surface">
              <Calendar size={16} className="text-muted shrink-0" />
              <div>
                <p className="text-muted">Vencimiento Lote</p>
                <p className="font-semibold text-fg">{formatDateShort(lot.fecha_vencimiento)}</p>
              </div>
            </div>
          )}

          {partyName && (
            <div className="flex items-center gap-2 rounded-lg border border-border p-2 bg-surface">
              <User size={16} className="text-muted shrink-0" />
              <div>
                <p className="text-muted">{isEntrada ? 'Donante' : 'Beneficiario'}</p>
                <p className="font-semibold text-fg">{partyName}</p>
              </div>
            </div>
          )}
        </div>

        {/* Notas */}
        {movement.nota && (
          <div className="rounded-lg border border-border p-3 bg-surface">
            <div className="flex items-center gap-1.5 text-caption font-medium text-muted mb-1">
              <Note size={16} />
              <span>Observaciones / Nota</span>
            </div>
            <p className="text-body text-fg whitespace-pre-wrap">{movement.nota}</p>
          </div>
        )}

        {/* Confirmación de eliminación */}
        {confirmDelete && (
          <div className="rounded-lg border border-danger-500/40 bg-danger-500/10 p-3 text-caption text-danger-700 flex flex-col gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <Warning size={18} />
              <span>¿Confirmas la eliminación de este movimiento?</span>
            </div>
            <p>Se revertirá la cantidad de {movement.qty} en el stock del lote correspondiente.</p>
            <div className="flex justify-end gap-2 mt-1">
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button size="sm" variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        {!confirmDelete && (
          <div className="flex justify-between items-center gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="hover:bg-danger-500/10 hover:text-danger-700 text-danger-600"
                >
                  <Trash size={16} />
                  Eliminar
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onEdit(movement);
                  }}
                >
                  <PencilSimple size={16} />
                  Editar
                </Button>
              )}
            </div>
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
