import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Envelope,
  Clock,
  Package,
  Pill,
  Users,
  ChatCircle,
  MapTrifold,
  Warning,
  ClipboardText,
  Database,
  Note,
  UserPlus,
  HandHeart,
} from '@phosphor-icons/react';
import { fetchPublicCenterById, fetchPublicNeeds } from '../../../lib/centerOps';
import { NeedItem } from '../needs/NeedItem';
import { PageContainer } from '../../../components/layout/PageContainer';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Badge } from '../../../components/ui/Badge';

export function CenterDetailPage() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const centerIdentifier = id || slug;

  const { data: center, isLoading: loadingCenter } = useQuery({
    queryKey: ['public-center', centerIdentifier],
    queryFn: () => fetchPublicCenterById(centerIdentifier!),
    enabled: !!centerIdentifier,
    staleTime: 5 * 60 * 1000,
  });

  const { data: needs = [], isLoading: loadingNeeds } = useQuery({
    queryKey: ['public-needs', center?.id],
    queryFn: () => fetchPublicNeeds(center!.id),
    enabled: !!center?.id,
    staleTime: 2 * 60 * 1000,
  });

  if (loadingCenter) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-lg" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!center) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-surface-card py-16 text-center shadow-elev-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 dark:bg-danger-950/60 text-danger-400 ring-1 ring-danger-200/50">
            <Warning size={28} />
          </div>
          <h3 className="mt-4 text-h2 text-text-primary">Centro no encontrado</h3>
          <p className="mt-1 text-body-sm text-text-secondary">
            El centro que buscas no existe o no está activo.
          </p>
          <Link
            to="/centros"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-body-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft size={16} />
            Ver centros
          </Link>
        </div>
      </PageContainer>
    );
  }

  const whatsappPhone = (center.public_phone || '').replace(/[^0-9]/g, '');
  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Hola, quiero información para hacer una donación a ${center.name}.`)}`
    : null;

  const mapsUrl = center.address
    ? `https://maps.google.com/?q=${encodeURIComponent(center.address + (center.city ? `, ${center.city}` : '') + (center.state ? `, ${center.state}` : ''))}`
    : null;

  // Priority ordering
  const priorityOrder: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4 };
  const sortedNeeds = [...needs].sort((a, b) => (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5));

  return (
    <PageContainer className="py-8">
      {/* Back link */}
      <Link
        to="/centros"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        <ArrowLeft size={16} />
        Todos los centros de acopio
      </Link>

      {/* Header */}
      <div className="mb-6 rounded-2xl border border-border/60 bg-surface-card p-6 shadow-elev-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-display-sm font-bold text-text-primary">{center.name}</h1>
              <Badge variant={center.accepts_donations ? 'success' : 'default'} dot>
                {center.accepts_donations ? 'Recibiendo donaciones' : 'No recibe actualmente'}
              </Badge>
            </div>
            {center.public_description && (
              <p className="mt-2 max-w-2xl text-body text-text-secondary">{center.public_description}</p>
            )}
          </div>
        </div>

        {/* Contact grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-border/60 pt-4">
          {center.address && (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-caption font-medium text-text-tertiary">Dirección</p>
                <p className="text-body-sm text-text-primary">{center.address}</p>
                {(center.city || center.state) && (
                  <p className="text-caption text-text-tertiary">
                    {[center.city, center.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}
          {center.public_phone && (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-50 dark:bg-emerald-950/60 text-success-600 dark:text-emerald-300">
                <Phone size={18} />
              </div>
              <div>
                <p className="text-caption font-medium text-text-tertiary">Teléfono</p>
                <a href={`tel:${center.public_phone}`} className="text-body-sm text-primary-600 dark:text-primary-400 hover:underline">
                  {center.public_phone}
                </a>
              </div>
            </div>
          )}
          {center.public_email && (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info-50 dark:bg-sky-950/60 text-info-600 dark:text-sky-300">
                <Envelope size={18} />
              </div>
              <div>
                <p className="text-caption font-medium text-text-tertiary">Email</p>
                <a href={`mailto:${center.public_email}`} className="text-body-sm text-primary-600 dark:text-primary-400 hover:underline">
                  {center.public_email}
                </a>
              </div>
            </div>
          )}
          {center.operating_hours && (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-50 dark:bg-amber-950/60 text-warning-600 dark:text-amber-300">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-caption font-medium text-text-tertiary">Horario</p>
                <p className="text-body-sm text-text-primary">{center.operating_hours}</p>
              </div>
            </div>
          )}
        </div>

        {/* Specific CTAs */}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-border/60 pt-4">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-body-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <ChatCircle size={18} weight="fill" />
              Quiero donar aquí (WhatsApp)
            </a>
          ) : (
            mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-body-sm font-medium text-white hover:bg-primary-700 transition-colors shadow-sm"
              >
                <HandHeart size={18} />
                Quiero donar aquí (Ubicación)
              </a>
            )
          )}

          <Link
            to={`/auth/registro?tipo=voluntario&centro=${center.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/40 px-5 py-2.5 text-body-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-100 transition-colors"
          >
            <UserPlus size={18} />
            Quiero ser voluntario aquí
          </Link>

          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-body-sm font-medium text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <MapTrifold size={18} />
              Ver en Google Maps
            </a>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-card p-4 shadow-elev-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300 ring-1 ring-primary-200/40 dark:ring-primary-800/40">
            <Package size={20} />
          </div>
          <div>
            <p className="text-numeric font-bold text-text-primary">{center.total_products}</p>
            <p className="text-caption text-text-tertiary">Productos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-card p-4 shadow-elev-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 dark:bg-emerald-950/60 text-success-600 dark:text-emerald-300 ring-1 ring-success-200/40 dark:ring-emerald-800/40">
            <Pill size={20} />
          </div>
          <div>
            <p className="text-numeric font-bold text-text-primary">{center.total_medications}</p>
            <p className="text-caption text-text-tertiary">Medicamentos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-card p-4 shadow-elev-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info-50 dark:bg-sky-950/60 text-info-600 dark:text-sky-300 ring-1 ring-info-200/40 dark:ring-sky-800/40">
            <Users size={20} />
          </div>
          <div>
            <p className="text-numeric font-bold text-text-primary">{center.total_volunteers}</p>
            <p className="text-caption text-text-tertiary">Voluntarios</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-card p-4 shadow-elev-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 dark:bg-amber-950/60 text-warning-600 dark:text-amber-300 ring-1 ring-warning-200/40 dark:ring-amber-800/40">
            <ClipboardText size={20} />
          </div>
          <div>
            <p className="text-numeric font-bold text-text-primary">{center.total_needs}</p>
            <p className="text-caption text-text-tertiary">Necesidades</p>
          </div>
        </div>
      </div>

      {/* Needs section */}
      <section>
        <h2 className="mb-4 text-h2 text-text-primary">Necesidades actuales (ordenadas por prioridad)</h2>
        {loadingNeeds ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : sortedNeeds.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-surface-card p-8 text-center shadow-elev-1">
            <p className="text-body-sm text-text-secondary">
              Este centro no tiene necesidades registradas actualmente.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Derived from inventory */}
            {sortedNeeds.filter((n) => n.source === 'inventory').length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300">
                    <Database size={14} />
                  </div>
                  <h3 className="text-body font-semibold text-text-primary">Detectadas del inventario</h3>
                  <span className="rounded-full bg-primary-100 dark:bg-primary-950/40 px-2 py-0.5 text-caption font-medium text-primary-700 dark:text-primary-300">
                    {sortedNeeds.filter((n) => n.source === 'inventory').length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sortedNeeds.filter((n) => n.source === 'inventory').map((need) => (
                    <NeedItem key={need.id} need={need} />
                  ))}
                </div>
              </div>
            )}

            {/* Manual requests */}
            {sortedNeeds.filter((n) => n.source === 'manual').length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 dark:bg-accent-950/60 text-accent-600 dark:text-accent-300">
                    <Note size={14} />
                  </div>
                  <h3 className="text-body font-semibold text-text-primary">Solicitudes manuales del centro</h3>
                  <span className="rounded-full bg-accent-100 dark:bg-accent-950/40 px-2 py-0.5 text-caption font-medium text-accent-700 dark:text-accent-300">
                    {sortedNeeds.filter((n) => n.source === 'manual').length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sortedNeeds.filter((n) => n.source === 'manual').map((need) => (
                    <NeedItem key={need.id} need={need} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
