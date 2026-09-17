import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Clock,
  Phone,
  WhatsappLogo,
  ArrowRight,
  UserPlus,
  HandHeart,
  CheckCircle,
  WarningCircle,
  ClockAfternoon,
  Funnel,
  Buildings,
  MapTrifold,
} from '@phosphor-icons/react';
import { fetchPublicInventoryResumen, fetchLatestInventoryUpdateDate, type PublicInventoryItem } from '../../lib/publicInventoryOps';
import { fetchPublicCenters, fetchPublicNeeds, type PublicCenter } from '../../lib/centerOps';
import { PageContainer } from '../../components/layout/PageContainer';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../components/auth/AuthProvider';

export function LandingPage() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyUrgent, setOnlyUrgent] = useState<boolean>(false);

  const { data: inventory = [], isLoading: loadingInventory } = useQuery({
    queryKey: ['public-inventory-resumen'],
    queryFn: () => fetchPublicInventoryResumen(),
    staleTime: 60 * 1000,
  });

  const { data: needs = [], isLoading: loadingNeeds } = useQuery({
    queryKey: ['public-needs-all'],
    queryFn: () => fetchPublicNeeds(),
    staleTime: 60 * 1000,
  });

  const { data: updateDate } = useQuery({
    queryKey: ['public-inventory-update-date'],
    queryFn: fetchLatestInventoryUpdateDate,
    staleTime: 60 * 1000,
  });

  const { data: centers = [], isLoading: loadingCenters } = useQuery({
    queryKey: ['public-centers'],
    queryFn: fetchPublicCenters,
    staleTime: 5 * 60 * 1000,
  });

  // Combine inventory items and public needs into unified urgency display items
  const combinedItems: PublicInventoryItem[] = [...inventory];

  // Also include manual or derived needs from fetchPublicNeeds if not already present
  for (const need of needs) {
    const exists = combinedItems.some(
      (item) => item.nombre_producto.toLowerCase() === need.title.toLowerCase(),
    );
    if (!exists) {
      combinedItems.push({
        product_id: need.id,
        center_id: need.center_id,
        center_name: need.center_name || 'Centro de Acopio',
        categoria: need.item_type === 'medication' ? 'Medicamentos' : need.item_type === 'medical_supply' ? 'Insumos Médicos' : 'Productos Generales',
        nombre_producto: need.title,
        cantidad_actual: need.quantity_received || 0,
        umbral_minimo: need.quantity_needed || 10,
        nivel_urgencia: need.priority === 'urgent' ? 'sin_existencias' : need.priority === 'high' ? 'escaso' : 'regular',
        fecha_ultima_actualizacion: need.updated_at || new Date().toISOString(),
      });
    }
  }

  // Extract unique categories & counts
  const categoryCounts = combinedItems.reduce((acc, item) => {
    acc[item.categoria] = (acc[item.categoria] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categories = Object.keys(categoryCounts).sort();

  // Filter items
  const filteredItems = combinedItems.filter((item) => {
    if (selectedCategory !== 'all' && item.categoria !== selectedCategory) {
      return false;
    }
    if (onlyUrgent) {
      return item.nivel_urgencia === 'sin_existencias' || item.nivel_urgencia === 'escaso';
    }
    return true;
  });

  // Calculate max last updated date
  const latestDate = updateDate
    ? new Date(updateDate).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : combinedItems.length > 0
    ? new Date(
        Math.max(...combinedItems.map((i) => new Date(i.fecha_ultima_actualizacion).getTime())),
      ).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex flex-col gap-0 pb-12">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary-50/80 via-surface to-accent-50/40 dark:from-primary-950/40 dark:via-surface dark:to-accent-950/20 py-12 lg:py-20">
        <PageContainer>
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 dark:border-primary-800/60 bg-primary-100/60 dark:bg-primary-900/30 px-3.5 py-1 text-caption font-semibold text-primary-800 dark:text-primary-300 mb-4">
              <Buildings size={16} />
              <span>{centers.length > 0 ? `${centers.length} Centros de Acopio Activos` : 'Plataforma de Donaciones'}</span>
            </div>
            <h1 className="text-display-xl font-extrabold tracking-tight text-text-primary">
              Ayuda de forma eficiente y{' '}
              <span className="text-primary-600 dark:text-primary-400">transparente</span>
            </h1>
            <p className="mt-4 text-body-lg text-text-secondary max-w-2xl leading-relaxed">
              Consulta en tiempo real las necesidades de todos nuestros centros de acopio. Conoce qué insumos son urgentes y haz que tu ayuda llegue donde realmente hace falta.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth/registro?tipo=voluntario"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 text-body font-medium text-white hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 shadow-elev-2"
              >
                <UserPlus size={20} />
                Registrarme como voluntario
              </Link>
              <Link
                to="/auth/registro?tipo=solicitante"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-card px-6 py-3.5 text-body font-medium text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <HandHeart size={20} />
                Solicitar ayuda
              </Link>
              {user ? (
                <Link
                  to="/inicio"
                  className="inline-flex items-center gap-2 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/50 px-6 py-3.5 text-body font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-100 transition-colors"
                >
                  Ir a mi panel <ArrowRight size={18} />
                </Link>
              ) : (
                <Link
                  to="/auth/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-card px-6 py-3.5 text-body font-medium text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Iniciar sesión
                </Link>
              )}
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 2. "Qué necesitamos hoy" Section */}
      <section className="py-10 lg:py-14 border-b border-border/60">
        <PageContainer>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-1">
                <Funnel size={20} />
                <span className="text-caption font-bold uppercase tracking-wider">Monitoreo en tiempo real</span>
              </div>
              <h2 className="text-display-sm font-bold text-text-primary">¿Qué necesitamos hoy?</h2>
              {latestDate && (
                <p className="mt-1 text-caption text-text-tertiary">
                  Actualizado al {latestDate}
                </p>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none rounded-xl border border-border bg-surface-card px-3.5 py-2 text-body-sm text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <input
                  type="checkbox"
                  checked={onlyUrgent}
                  onChange={(e) => setOnlyUrgent(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-400"
                />
                <span className="font-medium">Ver solo lo urgente</span>
              </label>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl border border-border bg-surface-card px-3.5 py-2 text-body-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="all">Todas las categorías ({combinedItems.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} ({categoryCounts[cat]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Tabs (Desktop) */}
          {categories.length > 0 && (
            <div className="hidden lg:flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`rounded-lg px-4 py-2 text-body-sm font-medium transition-colors shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-surface-card text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-border/60'
                }`}
              >
                Todas las categorías ({combinedItems.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-4 py-2 text-body-sm font-medium transition-colors shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-surface-card text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-border/60'
                  }`}
                >
                  {cat} ({categoryCounts[cat]})
                </button>
              ))}
            </div>
          )}

          {/* Inventory Items Grid */}
          {(loadingInventory || loadingNeeds) ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-surface-card p-10 text-center shadow-elev-1">
              <CheckCircle size={36} className="mx-auto text-success-500 mb-2" />
              <h3 className="text-h3 font-semibold text-text-primary">No hay ítems en esta categoría</h3>
              <p className="mt-1 text-body-sm text-text-secondary">
                {onlyUrgent
                  ? 'No hay insumos en estado urgente o sin existencias en este momento.'
                  : 'Todos los productos cuentan con abastecimiento adecuado.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <InventoryItemCard key={`${item.center_id}-${item.product_id}`} item={item} />
              ))}
            </div>
          )}
        </PageContainer>
      </section>

      {/* 3. Punto de Acopio Section (Lists ALL active centers) */}
      <section className="py-10 lg:py-14 border-b border-border/60 bg-surface-card">
        <PageContainer>
          <div className="mb-8 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/60 px-3 py-1 text-caption font-semibold text-primary-700 dark:text-primary-300 mb-2">
              <MapPin size={16} />
              <span>Centros de Acopio Autorizados</span>
            </div>
            <h2 className="text-display-sm font-bold text-text-primary">
              ¿Dónde llevar tus donaciones?
            </h2>
            <p className="mt-2 text-body text-text-secondary leading-relaxed">
              Puntos de recepción autorizados. Puedes consultar las necesidades de cada centro o contactarte directamente por WhatsApp.
            </p>
          </div>

          {loadingCenters ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {Array.from({ length: 2 }, (_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          ) : centers.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-surface p-8 text-center shadow-elev-1">
              <Buildings size={36} className="mx-auto text-text-tertiary mb-2" />
              <p className="text-body-sm text-text-secondary">
                No hay centros de acopio activos disponibles en este momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {centers.map((center) => (
                <CenterContactCard key={center.id} center={center} />
              ))}
            </div>
          )}
        </PageContainer>
      </section>
    </div>
  );
}

function CenterContactCard({ center }: { center: PublicCenter }) {
  const phoneDigits = (center.public_phone || '').replace(/\D/g, '');
  const whatsappUrl = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hola, quisiera consultar cómo donar en ${center.name}.`)}`
    : null;

  const mapsQuery = encodeURIComponent(
    `${center.address || ''} ${center.city || ''} ${center.state || ''}`.trim() || center.name,
  );
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-surface p-6 shadow-sm hover:shadow-md transition-shadow">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-caption font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
              Centro de Acopio
            </span>
            <h3 className="text-h3 font-bold text-text-primary mt-0.5">{center.name}</h3>
          </div>
          <Link
            to={`/centro/${center.id}`}
            className="inline-flex items-center gap-1 rounded-lg bg-primary-50 dark:bg-primary-950/60 px-3 py-1.5 text-caption font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-100 transition-colors shrink-0"
          >
            Ver necesidades <ArrowRight size={14} />
          </Link>
        </div>

        {center.public_description && (
          <p className="mt-2 text-body-sm text-text-secondary line-clamp-2">
            {center.public_description}
          </p>
        )}

        <div className="mt-5 space-y-3 border-t border-border/50 pt-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300">
              <MapPin size={16} />
            </div>
            <div>
              <p className="text-caption font-medium text-text-tertiary">Dirección</p>
              <p className="text-body-sm text-text-primary">
                {center.address || 'Consultar ubicación'}
                {(center.city || center.state) && `, ${[center.city, center.state].filter(Boolean).join(', ')}`}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300">
              <Clock size={16} />
            </div>
            <div>
              <p className="text-caption font-medium text-text-tertiary">Horario de atención</p>
              <p className="text-body-sm text-text-primary">
                {center.operating_hours || 'Lunes a Sábado: 8:00 AM - 5:00 PM'}
              </p>
            </div>
          </div>

          {center.public_phone && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300">
                <Phone size={16} />
              </div>
              <div>
                <p className="text-caption font-medium text-text-tertiary">Teléfono de contacto</p>
                <p className="text-body-sm text-text-primary">{center.public_phone}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap gap-2.5 pt-4 border-t border-border/50">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-body-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <WhatsappLogo size={18} weight="fill" />
            WhatsApp
          </a>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface-card px-4 py-2.5 text-body-sm font-medium text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <MapTrifold size={18} />
          Google Maps
        </a>
      </div>
    </div>
  );
}

function InventoryItemCard({ item }: { item: PublicInventoryItem }) {
  let badgeStyle = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  let badgeLabel = 'Abastecido';
  let Icon = CheckCircle;

  if (item.nivel_urgencia === 'sin_existencias') {
    badgeStyle = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    badgeLabel = 'Sin existencias';
    Icon = WarningCircle;
  } else if (item.nivel_urgencia === 'escaso') {
    badgeStyle = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    badgeLabel = 'Escaso (Urgente)';
    Icon = ClockAfternoon;
  } else if (item.nivel_urgencia === 'regular') {
    badgeStyle = 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800';
    badgeLabel = 'Regular';
    Icon = CheckCircle;
  } else if (item.nivel_urgencia === 'muy_abastecido') {
    badgeStyle = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    badgeLabel = 'Muy abastecido';
    Icon = CheckCircle;
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-surface-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-caption font-medium text-text-tertiary uppercase tracking-wider">
            {item.categoria}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-semibold ${badgeStyle}`}>
            <Icon size={14} />
            {badgeLabel}
          </span>
        </div>
        <h3 className="text-body font-bold text-text-primary leading-tight">
          {item.nombre_producto}
        </h3>
        {item.center_name && (
          <p className="mt-1 text-caption text-text-tertiary">
            📍 {item.center_name}
          </p>
        )}
      </div>
      <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-caption text-text-tertiary">
        <span>Estado de urgencia</span>
        <span className="font-mono">{item.nivel_urgencia.replace('_', ' ')}</span>
      </div>
    </div>
  );
}
