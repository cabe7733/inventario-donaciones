import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Buildings,
  HandHeart,
  MagnifyingGlass,
  CheckCircle,
  Truck,
  Receipt,
} from '@phosphor-icons/react';
import { fetchPublicCenters, fetchPublicNeeds } from '../../lib/centerOps';
import { CenterCard } from './centers/CenterCard';
import { NeedItem } from './needs/NeedItem';
import { PageContainer } from '../../components/layout/PageContainer';
import { Skeleton } from '../../components/ui/Skeleton';

export function LandingPage() {
  const { data: centers = [], isLoading: loadingCenters } = useQuery({
    queryKey: ['public-centers'],
    queryFn: fetchPublicCenters,
    staleTime: 5 * 60 * 1000,
  });

  const { data: needs = [], isLoading: loadingNeeds } = useQuery({
    queryKey: ['public-needs'],
    queryFn: () => fetchPublicNeeds(),
    staleTime: 2 * 60 * 1000,
  });

  const urgentNeeds = needs
    .filter((n) => n.priority === 'urgent' || n.priority === 'high')
    .slice(0, 6);

  const totalProducts = centers.reduce((acc, c) => acc + (c.total_products ?? 0), 0);
  const totalMedications = centers.reduce((acc, c) => acc + (c.total_medications ?? 0), 0);
  const totalVolunteers = centers.reduce((acc, c) => acc + (c.total_volunteers ?? 0), 0);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary-50/80 via-surface to-accent-50/40 dark:from-primary-950/30 dark:via-surface dark:to-accent-950/20">
        <PageContainer className="py-12 lg:py-20">
          <div className="max-w-2xl">
            <h1 className="text-display-xl font-bold tracking-tight text-text-primary">
              Dona donde{' '}
              <span className="text-primary-600 dark:text-primary-400">realmente hace falta</span>
            </h1>
            <p className="mt-4 text-body-lg text-text-secondary max-w-xl">
              Encuentra centros de acopio, descubre qué necesitan actualmente y ayuda de manera
              organizada. Cada donación se registra, se almacena y se entrega con trazabilidad.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/centros"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-body font-medium text-white hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 shadow-elev-2"
              >
                <Buildings size={20} />
                Ver centros de acopio
              </Link>
              <Link
                to="/necesidades"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-card px-6 py-3 text-body font-medium text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <MagnifyingGlass size={20} />
                Qué se necesita
              </Link>
            </div>
          </div>

          {/* Stats */}
          {(totalProducts > 0 || totalMedications > 0 || totalVolunteers > 0) && (
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-lg">
              <div className="text-center">
                <p className="text-numeric-xl font-bold text-primary-700 dark:text-primary-300">
                  {centers.length}
                </p>
                <p className="text-caption text-text-tertiary">Centros activos</p>
              </div>
              <div className="text-center">
                <p className="text-numeric-xl font-bold text-primary-700 dark:text-primary-300">
                  {totalProducts + totalMedications}
                </p>
                <p className="text-caption text-text-tertiary">Items registrados</p>
              </div>
              <div className="text-center">
                <p className="text-numeric-xl font-bold text-primary-700 dark:text-primary-300">
                  {totalVolunteers}
                </p>
                <p className="text-caption text-text-tertiary">Voluntarios</p>
              </div>
            </div>
          )}
        </PageContainer>
      </section>

      {/* Urgent needs */}
      <section className="border-b border-border/60">
        <PageContainer className="py-10 lg:py-14">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-display-sm font-bold text-text-primary">¿Qué se necesita hoy?</h2>
              <p className="mt-1 text-body-sm text-text-secondary">
                Estas son las necesidades más urgentes de todos los centros.
              </p>
            </div>
            <Link
              to="/necesidades"
              className="hidden sm:inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              Ver todas
              <ArrowRight size={14} />
            </Link>
          </div>

          {loadingNeeds ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : urgentNeeds.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-surface-card p-8 text-center shadow-elev-1">
              <CheckCircle size={32} className="mx-auto text-success-500" />
              <p className="mt-3 text-body-sm text-text-secondary">
                No hay necesidades urgentes en este momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {urgentNeeds.map((need) => (
                <NeedItem key={need.id} need={need} />
              ))}
            </div>
          )}

          <div className="mt-4 text-center sm:hidden">
            <Link
              to="/necesidades"
              className="inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              Ver todas las necesidades
              <ArrowRight size={14} />
            </Link>
          </div>
        </PageContainer>
      </section>

      {/* Centers preview */}
      <section className="border-b border-border/60">
        <PageContainer className="py-10 lg:py-14">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-display-sm font-bold text-text-primary">Centros de acopio</h2>
              <p className="mt-1 text-body-sm text-text-secondary">
                Encuentra el centro más cercano y descubre qué acepta.
              </p>
            </div>
            <Link
              to="/centros"
              className="hidden sm:inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              Ver todos
              <ArrowRight size={14} />
            </Link>
          </div>

          {loadingCenters ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : centers.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-surface-card p-8 text-center shadow-elev-1">
              <Buildings size={32} className="mx-auto text-text-tertiary" />
              <p className="mt-3 text-body-sm text-text-secondary">
                Aún no hay centros registrados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {centers.slice(0, 3).map((center) => (
                <CenterCard key={center.id} center={center} />
              ))}
            </div>
          )}

          {centers.length > 3 && (
            <div className="mt-4 text-center sm:hidden">
              <Link
                to="/centros"
                className="inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                Ver todos los centros
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </PageContainer>
      </section>

      {/* How it works */}
      <section className="border-b border-border/60">
        <PageContainer className="py-10 lg:py-14">
          <h2 className="mb-8 text-display-sm font-bold text-text-primary text-center">¿Cómo funciona?</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                icon: MagnifyingGlass,
                step: 'Paso 1',
                title: 'Revisa qué se necesita',
                description: 'Mira la lista de necesidades. Lo que está en rojo o naranja es lo que de verdad hace falta hoy.',
              },
              {
                icon: Truck,
                step: 'Paso 2',
                title: 'Llévalo al centro de acopio',
                description: 'Acércate en el horario de atención. Si es una cantidad grande, avisa antes por WhatsApp.',
              },
              {
                icon: Receipt,
                step: 'Paso 3',
                title: 'Recibe tu comprobante',
                description: 'Registramos la donación con tu nombre y te entregamos el comprobante de lo que dejaste.',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-border/60 bg-surface-card p-6 text-center shadow-elev-1">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300 ring-1 ring-primary-200/50 dark:ring-primary-800/40">
                  <item.icon size={24} />
                </div>
                <p className="mt-3 text-caption font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                  {item.step}
                </p>
                <h3 className="mt-1 text-h3 font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-body-sm text-text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* CTA */}
      <section>
        <PageContainer className="py-10 lg:py-14">
          <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 p-8 text-center shadow-elev-3 lg:p-12">
            <HandHeart size={40} className="mx-auto text-white/80" />
            <h2 className="mt-4 text-display-sm font-bold text-white">Únete a Donario</h2>
            <p className="mt-2 max-w-md mx-auto text-body text-white/80">
              Crea una cuenta para administrar tu centro de acopio, registrar inventario y conectar
              con donantes.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/auth/registro"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-body font-medium text-primary-700 hover:bg-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
              >
                Crear cuenta
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-body font-medium text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
