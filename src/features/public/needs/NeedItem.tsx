import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import {
  Package,
  Pill,
  FirstAid,
  Users,
  Warning,
  WarningCircle,
  Info,
  CheckCircle,
  Database,
  Note,
  UserPlus,
} from '@phosphor-icons/react';
import type { PublicNeed, NeedPriority, StockLevel, NeedItemType, NeedSource } from '../../../lib/centerOps';

const priorityConfig: Record<NeedPriority, { label: string; variant: 'danger' | 'warning' | 'info' | 'success'; icon: typeof Warning }> = {
  urgent: { label: 'Urgente', variant: 'danger', icon: Warning },
  high: { label: 'Alta', variant: 'warning', icon: WarningCircle },
  medium: { label: 'Media', variant: 'info', icon: Info },
  low: { label: 'Normal', variant: 'success', icon: CheckCircle },
};

const stockLevelConfig: Record<StockLevel, { label: string; color: string }> = {
  critical: { label: 'Sin existencias', color: 'bg-danger-500' },
  low: { label: 'Escaso', color: 'bg-warning-500' },
  moderate: { label: 'Regular', color: 'bg-info-500' },
  sufficient: { label: 'Abastecido', color: 'bg-success-500' },
  available: { label: 'Disponible', color: 'bg-success-500' },
};

const itemTypeIcons: Record<NeedItemType, typeof Package> = {
  product: Package,
  medication: Pill,
  medical_supply: FirstAid,
  volunteer: Users,
};

const itemTypeLabels: Record<NeedItemType, string> = {
  product: 'Producto / Mercado',
  medication: 'Medicamento',
  medical_supply: 'Insumo médico',
  volunteer: 'Personal / Voluntario',
};

const variantStyles: Record<string, string> = {
  danger: 'bg-danger-50 dark:bg-danger-950/40 text-danger-700 dark:text-danger-300 ring-1 ring-danger-200/50 dark:ring-danger-800/40',
  warning: 'bg-warning-50 dark:bg-warning-950/40 text-warning-700 dark:text-warning-300 ring-1 ring-warning-200/50 dark:ring-warning-800/40',
  info: 'bg-info-50 dark:bg-info-950/40 text-info-700 dark:text-info-300 ring-1 ring-info-200/50 dark:ring-info-800/40',
  success: 'bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-300 ring-1 ring-success-200/50 dark:ring-success-800/40',
};

const sourceConfig: Record<NeedSource, { label: string; icon: typeof Database; style: string }> = {
  inventory: { label: 'Inventario', icon: Database, style: 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300' },
  manual: { label: 'Solicitud', icon: Note, style: 'bg-accent-50 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300' },
};

interface NeedItemProps {
  need: PublicNeed;
}

export function NeedItem({ need }: NeedItemProps) {
  const priority = priorityConfig[need.priority];
  const stock = stockLevelConfig[need.stock_level];
  const TypeIcon = itemTypeIcons[need.item_type] || Package;
  const PriorityIcon = priority.icon;
  const source = sourceConfig[need.source];
  const SourceIcon = source.icon;
  const isVolunteer = need.item_type === 'volunteer';

  const progress = need.quantity_needed > 0
    ? Math.min(100, (need.quantity_received / need.quantity_needed) * 100)
    : 100;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-surface-card p-4 transition-all hover:shadow-elev-2 hover:border-border-default shadow-elev-1">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', isVolunteer ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' : variantStyles[priority.variant])}>
              <TypeIcon size={18} aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-body font-semibold text-text-primary truncate">{need.title}</h4>
                <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium', variantStyles[priority.variant])}>
                  <PriorityIcon size={12} aria-hidden />
                  {priority.label}
                </span>
                <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', source.style)}>
                  <SourceIcon size={10} aria-hidden />
                  {source.label}
                </span>
              </div>
              <p className="mt-0.5 text-caption text-text-tertiary">
                {itemTypeLabels[need.item_type] || 'Necesidad'}
                {need.center_name && (
                  <>
                    {' · '}
                    <Link
                      to={`/centros/${need.center_slug ?? need.center_id}`}
                      className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                    >
                      {need.center_name}
                    </Link>
                  </>
                )}
                {need.center_city && `, ${need.center_city}`}
              </p>
            </div>
          </div>
          {/* Stock level dot */}
          {!isVolunteer && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={clsx('h-2.5 w-2.5 rounded-full', stock.color)} aria-hidden />
              <span className="text-caption text-text-tertiary hidden sm:inline">{stock.label}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {need.description && (
          <p className="mt-2 text-body-sm text-text-secondary line-clamp-2">{need.description}</p>
        )}

        {/* Progress bar or People needed count */}
        {need.quantity_needed > 0 && !isVolunteer && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-caption text-text-tertiary mb-1">
              <span>{need.quantity_received} recibidos</span>
              <span>Meta: {need.quantity_needed}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className={clsx('h-full rounded-full transition-all duration-500', stock.color)}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {isVolunteer && need.quantity_needed > 0 && (
          <div className="mt-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 p-2.5 text-caption font-medium text-purple-900 dark:text-purple-200">
            👥 Se necesitan <span className="font-bold text-purple-700 dark:text-purple-300">{need.quantity_needed} personas</span> para este oficio.
          </div>
        )}
      </div>

      {/* Action CTA for Volunteer Needs */}
      {isVolunteer && (
        <div className="mt-4 pt-3 border-t border-border/40">
          <Link
            to={`/auth/registro?tipo=voluntario&centro=${need.center_id}&oficio=${encodeURIComponent(need.title)}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3.5 py-2 text-caption font-semibold text-white hover:bg-purple-700 transition-colors shadow-xs"
          >
            <UserPlus size={15} />
            Postularme como voluntario para este oficio
          </Link>
        </div>
      )}
    </div>
  );
}
