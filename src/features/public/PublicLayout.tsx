import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { List, X, Sun, Moon, Buildings, User } from '@phosphor-icons/react';
import { useTheme } from '../../lib/theme/ThemeProvider';
import { useAuth } from '../../components/auth/AuthProvider';

const PUBLIC_LINKS = [
  { to: '/centros', label: 'Centros de acopio' },
  { to: '/necesidades', label: 'Qué se necesita' },
];

export function PublicLayout() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const el = mobileMenuRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>('button, [href]');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    el.addEventListener('keydown', trap);
    el.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('keydown', trap); el.removeEventListener('keydown', onKey); };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface-card/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-xl">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950/60 ring-1 ring-primary-200/50 dark:ring-primary-800/40">
              <img src="/donario_logo.png" alt="Donario" className="h-7 w-7" />
            </div>
            <span className="text-h3 font-semibold text-primary-700 dark:text-primary-300">Donario</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación pública">
            {PUBLIC_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300'
                      : 'text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-fg'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label="Cambiar tema de color"
            >
              {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </button>
            {user ? (
              <Link
                to="/inicio"
                className="hidden rounded-lg bg-primary-600 px-4 py-2 text-body-sm font-medium text-white hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 sm:inline-flex items-center gap-2"
              >
                <User size={16} />
                Ir a mi panel
              </Link>
            ) : (
              <Link
                to="/auth/login"
                className="hidden rounded-lg bg-primary-600 px-4 py-2 text-body-sm font-medium text-white hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 sm:inline-flex"
              >
                Iniciar sesión
              </Link>
            )}
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label="Abrir menú"
              aria-expanded={mobileMenuOpen}
            >
              <List size={20} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
            <button type="button" className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú" />
            <aside ref={mobileMenuRef} className="relative flex h-full w-[min(85vw,320px)] flex-col bg-surface-card shadow-elev-4 animate-slide-in-right">
              <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950/60 ring-1 ring-primary-200/50">
                    <img src="/donario_logo.png" alt="Donario" className="h-7 w-7" />
                  </div>
                  <span className="text-h3 font-semibold text-primary-700 dark:text-primary-300">Donario</span>
                </div>
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Cerrar menú">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-4" aria-label="Navegación pública móvil">
                <ul className="space-y-0.5 px-2">
                  {PUBLIC_LINKS.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-3 text-body transition-colors ${
                            isActive
                              ? 'bg-primary-50 dark:bg-primary-950 font-semibold text-primary-700 dark:text-primary-300'
                              : 'text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-fg'
                          }`
                        }
                      >
                        <Buildings size={20} aria-hidden />
                        <span>{link.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="border-t border-border/60 p-3 space-y-2">
                <Link
                  to="/auth/registro"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-body-sm font-medium text-white hover:bg-primary-700 transition-colors"
                >
                  Crear cuenta
                </Link>
                <Link
                  to="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-body-sm font-medium text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Iniciar sesión
                </Link>
              </div>
            </aside>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-surface-card">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/60 ring-1 ring-primary-200/50">
                  <img src="/donario_logo.png" alt="Donario" className="h-6 w-6" />
                </div>
                <span className="text-h3 font-semibold text-primary-700 dark:text-primary-300">Donario</span>
              </div>
              <p className="mt-3 text-body-sm text-text-secondary max-w-xs">
                Conectando centros de acopio, necesidades y donantes para que la ayuda llegue donde realmente hace falta.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-label font-semibold text-text-primary mb-3">Navegación</h4>
              <ul className="space-y-2">
                {[
                  { to: '/', label: 'Inicio' },
                  { to: '/centros', label: 'Centros de acopio' },
                  { to: '/necesidades', label: 'Qué se necesita' },
                ].map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-body-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="text-label font-semibold text-text-primary mb-3">Cuenta</h4>
              <ul className="space-y-2">
                {[
                  { to: '/auth/login', label: 'Iniciar sesión' },
                  { to: '/auth/registro', label: 'Crear cuenta' },
                ].map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-body-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-label font-semibold text-text-primary mb-3">Contacto</h4>
              <ul className="space-y-2 text-body-sm text-text-secondary">
                <li>Donario</li>
                <li>Plataforma de gestión de donaciones</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-border/60 pt-6 text-center text-caption text-text-tertiary">
            Donario &copy; {new Date().getFullYear()} &middot; Gestión solidaria de inventarios
          </div>
        </div>
      </footer>
    </div>
  );
}
