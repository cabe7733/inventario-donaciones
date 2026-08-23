import { Link } from 'react-router-dom';
import { Buildings, UserPlus } from '@phosphor-icons/react';

export function OnboardingPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <img src="/donario_logo.png" alt="Donario" className="mb-4 h-12" />
          <h1 className="text-h2 text-fg">Bienvenido a Donario</h1>
          <p className="mt-1 text-center text-body text-muted">
            Gestiona el inventario de donaciones de tu centro de acopio
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Link
            to="/onboarding/crear-centro"
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <Buildings size={24} />
            </div>
            <div>
              <h2 className="font-medium text-fg">Crear un centro de acopio</h2>
              <p className="text-caption text-muted">Crear y administrar un nuevo centro</p>
            </div>
          </Link>

          <Link
            to="/onboarding/unirse-centro"
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
              <UserPlus size={24} />
            </div>
            <div>
              <h2 className="font-medium text-fg">Unirme a un centro existente</h2>
              <p className="text-caption text-muted">Tengo un código de invitación</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
