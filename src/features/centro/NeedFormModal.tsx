import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from '@phosphor-icons/react';
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

const ITEM_TYPE_OPTIONS: { value: NeedItemType; label: string }[] = [
  { value: 'product', label: 'Producto' },
  { value: 'medication', label: 'Medicamento' },
  { value: 'medical_supply', label: 'Insumo médico' },
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-border/60 bg-surface-card p-6 shadow-elev-3">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 text-text-primary">
            {isEditing ? 'Editar necesidad' : 'Crear necesidad'}
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
          {/* Item type */}
          <div>
            <label className="block text-caption font-medium text-text-secondary mb-1.5">Tipo de artículo</label>
            <div className="flex gap-2">
              {ITEM_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setItemType(opt.value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-body-sm font-medium transition-colors ${
                    itemType === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'border border-border bg-surface-card text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-caption font-medium text-text-secondary mb-1.5">Nombre del artículo</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Ej. Paracetamol 500mg, Jeringas 10ml..."
              className="h-10 w-full rounded-xl border border-border-default bg-surface-card px-3 text-body text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-caption font-medium text-text-secondary mb-1.5">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Detalles adicionales..."
              className="w-full rounded-xl border border-border-default bg-surface-card px-3 py-2 text-body text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors resize-none"
            />
          </div>

          {/* Quantity + Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-medium text-text-secondary mb-1.5">Cantidad necesaria</label>
              <input
                type="number"
                min={0}
                value={quantityNeeded}
                onChange={(e) => setQuantityNeeded(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border-default bg-surface-card px-3 text-body text-text-primary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-caption font-medium text-text-secondary mb-1.5">Prioridad</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as NeedPriority)}
                className="h-10 w-full rounded-xl border border-border-default bg-surface-card px-3 text-body text-text-primary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
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
