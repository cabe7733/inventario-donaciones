import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock, ArrowRight, Package, Pill, Users, ClipboardText } from '@phosphor-icons/react';
import { Badge } from '../../../components/ui/Badge';
import type { PublicCenter } from '../../../lib/centerOps';

interface CenterCardProps {
  center: PublicCenter;
}

export function CenterCard({ center }: CenterCardProps) {
  const totalItems = center.total_products + center.total_medications;

  return (
    <div className="group rounded-2xl border border-border/60 bg-surface-card p-5 transition-all duration-normal hover:shadow-elev-2 hover:border-border-default shadow-elev-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-h3 font-semibold text-text-primary group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
            {center.name}
          </h3>
          {center.address && (
            <p className="mt-1 flex items-center gap-1.5 text-body-sm text-text-secondary">
              <MapPin size={14} className="shrink-0 text-text-tertiary" aria-hidden />
              <span className="truncate">{center.address}</span>
            </p>
          )}
          {(center.city || center.state) && (
            <p className="mt-0.5 text-caption text-text-tertiary">
              {[center.city, center.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <Badge variant={center.accepts_donations ? 'success' : 'default'} dot>
          {center.accepts_donations ? 'Recibiendo' : 'No recibe'}
        </Badge>
      </div>

      {/* Description */}
      {center.public_description && (
        <p className="mt-3 text-body-sm text-text-secondary line-clamp-2">{center.public_description}</p>
      )}

      {/* Stats */}
      <div className="mt-4 flex flex-wrap gap-2">
        {center.total_products > 0 && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary-50 dark:bg-primary-950/40 px-2.5 py-1 text-caption font-medium text-primary-700 dark:text-primary-300 ring-1 ring-primary-200/40 dark:ring-primary-800/40">
            <Package size={13} aria-hidden />
            {center.total_products} productos
          </span>
        )}
        {center.total_medications > 0 && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-success-50 dark:bg-emerald-950/40 px-2.5 py-1 text-caption font-medium text-success-700 dark:text-emerald-300 ring-1 ring-success-200/40 dark:ring-emerald-800/40">
            <Pill size={13} aria-hidden />
            {center.total_medications} medicamentos
          </span>
        )}
        {center.total_volunteers > 0 && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-info-50 dark:bg-sky-950/40 px-2.5 py-1 text-caption font-medium text-info-700 dark:text-sky-300 ring-1 ring-info-200/40 dark:ring-sky-800/40">
            <Users size={13} aria-hidden />
            {center.total_volunteers} voluntarios
          </span>
        )}
        {center.total_needs > 0 && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-warning-50 dark:bg-amber-950/40 px-2.5 py-1 text-caption font-medium text-warning-700 dark:text-amber-300 ring-1 ring-warning-200/40 dark:ring-amber-800/40">
            <ClipboardText size={13} aria-hidden />
            {center.total_needs} necesidades
          </span>
        )}
      </div>

      {/* Contact info */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-caption text-text-tertiary">
        {center.public_phone && (
          <span className="flex items-center gap-1">
            <Phone size={12} aria-hidden />
            {center.public_phone}
          </span>
        )}
        {center.operating_hours && (
          <span className="flex items-center gap-1">
            <Clock size={12} aria-hidden />
            {center.operating_hours}
          </span>
        )}
      </div>

      {/* CTA */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-caption text-text-tertiary">
          {totalItems > 0 ? `${totalItems} items registrados` : 'Sin inventario registrado'}
        </span>
        <Link
          to={`/centros/${center.slug ?? center.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-1.5 text-body-sm font-medium text-white hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          Ver necesidades y cómo donar
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
