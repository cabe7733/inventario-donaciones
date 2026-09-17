import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, UserCheck, Package, Pill, FirstAid } from '@phosphor-icons/react';
import { createCenterNeed, updateCenterNeed } from '../../lib/needOps';
import type { CenterNeed, CenterNeedInput } from '../../lib/needOps';
import { Button } from '../../components/ui/Button';
import type { NeedPriority, NeedItemType } from '../../lib/centerOps';

interface NeedFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerId: string;
  editingNeed: CenterNeed | null;
}

const ITEM_TYPE_OPTIONS: { value: NeedItemType; label: string; icon: any }[] = [
  { value: 'product', label: 'Producto / Mercado', icon: Package },
  { value: 'medication', label: 'Medicamento', icon: Pill },
  { value: 'medical_supply', label: 'Insumo médico', icon: FirstAid },
  { value: 'volunteer', label: 'Personal / Voluntario', icon: UserCheck },
];

const VOLUNTEER_SUGGESTIONS = [
  'Clasificación de donaciones',
  'Cocinero/a para comedor',
  'Logística y carga pesada',
  'Conductor/a con vehículo',
  'Atención médica / Primeros auxilios',
  'Atención al público / Recepción',
];

const PRIORITY_OPTIONS: { value: NeedPriority; label: string }[] = [
  { value: 'low', label: 'Normal' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export function NeedFormModal({ isOpen, onClose, centerId, editingNeed }: NeedFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingNeed;

  const [itemType, setItemType] = useState<NeedItemType>('product');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantityNeeded, setQuantityNeeded] = useState<number>(0);
  const [priority, setPriority] = useState<NeedPriority>('medium');

  useEffect(() => {
    if (editingNeed) {
      setItemType(editingNeed.item_type);
      setTitle(editingNeed.title);
      setDescription(editingNeed.description ?? '');
      setQuantityNeeded(editingNeed.quantity_needed);
      setPriority(editingNeed.priority);
    } else {
      setItemType('product');
      setTitle('');
      setDescription('');
      setQuantityNeeded(0);
      setPriority('medium');
    }
  }, [editingNeed, isOpen]);

  const createMutation = useMutation({
    mutationFn: (input: CenterNeedInput) => createCenterNeed(centerId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['center-needs', centerId] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CenterNeedInput>) => updateCenterNeed(editingNeed!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['center-needs', centerId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const input: CenterNeedInput = {
      item_type: itemType,
      title: title.trim(),
      description: description.trim(),
      quantity_needed: quantityNeeded,
      priority,
    };

    if (isEditing) {
      updateMutation.mutate(input);
    } else {
      createMutation.mutate(input);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!isOpen) return null;

  const isVolunteer = itemType === 'volunteer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative mx-auto w-full max-w-lg rounded-2xl border border-border/60 bg-surface-card p-6 shadow-elev-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 text-text-primary">
            {isEditing ? 'Editar necesidad' : 'Crear necesidad de centro'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Item type selection */}
          <div>
            <label className="block text-caption font-medium text-text-secondary mb-1.5">
              ¿Qué se necesita en el centro?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ITEM_TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = itemType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setItemType(opt.value)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-body-sm font-medium transition-all ${
                      active
                        ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-400'
                        : 'border border-border bg-surface text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon size={18} className={active ? 'text-white' : 'text-primary-600 dark:text-primary-400'} />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title / Role */}
          <div>
            <label className="block text-caption font-medium text-text-secondary mb-1.5">
              {isVolunteer ? 'Oficio / Perfil de personal requerido' : 'Nombre del insumo / producto'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder={
                isVolunteer
                  ? 'Ej. Cocinero para el comedor, Clasificador de ropa, Conductor...'
                  : 'Ej. Arroz 1kg, Paracetamol 500mg, Agua embotellada...'
              }
              className="h-10 w-full rounded-xl border border-border-default bg-surface px-3 text-body text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            />

            {/* Quick Volunteer Role Suggestions */}
            {isVolunteer && !isEditing && (
              <div className="mt-2.5">
                <p className="text-caption text-text-tertiary mb-1.5">Sugerencias rápidas de oficios:</p>
                <div className="flex flex-wrap gap-1.5">
                  {VOLUNTEER_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setTitle(sug)}
                      className="rounded-lg border border-border/80 bg-surface-card px-2.5 py-1 text-caption text-text-secondary hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-950/40 transition-colors"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-caption font-medium text-text-secondary mb-1.5">
              {isVolunteer ? 'Tareas a realizar, horarios y requisitos' : 'Descripción o detalles (opcional)'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={
                isVolunteer
                  ? 'Ej. Sábados de 8am a 2pm. Ayuda con la preparación de almuerzos para el comedor comunitario.'
                  : 'Detalles adicionales, marca recomendada o especificaciones...'
              }
              className="w-full rounded-xl border border-border-default bg-surface px-3 py-2 text-body text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors resize-none"
            />
          </div>

          {/* Quantity + Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-medium text-text-secondary mb-1.5">
                {isVolunteer ? 'Cantidad de personas' : 'Cantidad necesaria'}
              </label>
              <input
                type="number"
                min={0}
                value={quantityNeeded}
                onChange={(e) => setQuantityNeeded(Number(e.target.value))}
                placeholder="0"
                className="h-10 w-full rounded-xl border border-border-default bg-surface px-3 text-body text-text-primary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-caption font-medium text-text-secondary mb-1.5">Prioridad</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as NeedPriority)}
                className="h-10 w-full rounded-xl border border-border-default bg-surface px-3 text-body text-text-primary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border/60">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isPending || !title.trim()}>
              {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear necesidad'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
