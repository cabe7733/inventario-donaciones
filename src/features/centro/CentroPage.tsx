import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Buildings, UserPlus } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';

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
    return <div className="p-4 lg:p-6">Cargando...</div>;
  }

  if (!center) {
    return <div className="p-4 lg:p-6">Centro no encontrado</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <Buildings size={24} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-h2">{center.name}</h1>
          <p className="text-caption text-muted">Tu centro de acopio</p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-h3 mb-3">Información general</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Info label="Dirección" value={center.address} />
          <Info label="Ciudad" value={center.city} />
          <Info label="Estado / Provincia" value={center.state} />
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
            label={center.entity_type === 'entity' ? 'NIT / RFC' : 'Cédula'}
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
    </div>
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
