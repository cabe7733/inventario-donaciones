import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Buildings, UserPlus, PencilSimple } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { PageContainer } from '../../components/layout/PageContainer';

interface Center {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  entity_type: string | null;
  entity_name: string | null;
  entity_rfc: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  representative_email: string | null;
}

export function CentroPage() {
  const { centerId, role } = useAuth();
  const [center, setCenter] = useState<Center | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!centerId) return;
    supabase
      .from('centers')
      .select('*')
      .eq('id', centerId)
      .single()
      .then(({ data }) => {
        setCenter(data);
        setLoading(false);
      });
  }, [centerId]);

  if (loading) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </PageContainer>
    );
  }

  if (!center) {
    return (
      <PageContainer>
        <p className="text-body text-muted">Centro no encontrado</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <Buildings size={24} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-h2">{center.name}</h1>
            <p className="text-caption text-muted">Tu centro de acopio</p>
          </div>
        </div>
        {role === 'super_admin' && (
          <Link to="/centro/editar">
            <Button variant="secondary" size="sm">
              <PencilSimple size={16} aria-hidden="true" />
              Editar
            </Button>
          </Link>
        )}
      </header>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-h3 mb-3">Información general</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Info label="Dirección" value={center.address} />
          <Info label="Municipio" value={center.city} />
          <Info label="Departamento" value={center.state} />
          <Info label="Teléfono" value={center.phone} />
          <Info label="Email" value={center.email} />
          <Info
            label="Tipo"
            value={center.entity_type === 'entity' ? 'Persona jurídica' : 'Persona natural'}
          />
          <Info
            label={center.entity_type === 'entity' ? 'Razón social' : 'Nombre completo'}
            value={center.entity_name}
          />
          <Info
            label={center.entity_type === 'entity' ? 'NIT' : 'Cédula'}
            value={center.entity_rfc}
          />
          {center.entity_type === 'entity' && (
            <Info label="Representante legal" value={center.representative_name} />
          )}
          <Info label="Teléfono del representante" value={center.representative_phone} />
          <Info label="Email del representante" value={center.representative_email} />
        </dl>
      </section>

      {(role === 'super_admin' || role === 'admin') && (
        <Link
          to="/centro/miembros"
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary-300 hover:bg-primary-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
            <UserPlus size={24} aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="font-medium text-fg">Gestionar miembros</h2>
            <p className="text-caption text-muted">Invita nuevos miembros y gestiona los existentes</p>
          </div>
        </Link>
      )}
    </PageContainer>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="text-body text-fg">{value || '—'}</dd>
    </div>
  );
}
