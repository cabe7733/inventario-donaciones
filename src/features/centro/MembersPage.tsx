import { useEffect, useState } from 'react';
import { Copy, UserPlus, X } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';

type Role = 'super_admin' | 'admin' | 'visualizer';

interface Member {
  user_id: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  profile: {
    full_name: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  visualizer: 'Visualizador',
};

export function MembersPage() {
  const { role } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'visualizer'>('visualizer');
  const [inviteError, setInviteError] = useState<string>();
  const [inviting, setInviting] = useState(false);
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);

  const canManage = role === 'super_admin';

  const load = async () => {
    setLoading(true);
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('center_members')
        .select('user_id, role, is_active, created_at, profile:profiles(full_name, first_name, last_name)')
        .order('created_at', { ascending: true }),
      supabase
        .from('center_invitations')
        .select('id, email, role, expires_at, accepted_at, created_at')
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    ]);

    if (!membersRes.error) {
      const rows = (membersRes.data ?? []) as Array<Omit<Member, 'profile'> & { profile: Member['profile'][] | null }>;
      setMembers(
        rows.map((r) => ({
          user_id: r.user_id,
          role: r.role,
          is_active: r.is_active,
          created_at: r.created_at,
          profile: Array.isArray(r.profile) ? r.profile[0] ?? null : r.profile,
        })),
      );
    }
    if (!invitesRes.error) setInvitations((invitesRes.data ?? []) as Invitation[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openInvite = () => {
    setInviteEmail('');
    setInviteRole('visualizer');
    setInviteError(undefined);
    setLastInviteCode(null);
    setInviteOpen(true);
  };

  const sendInvite = async () => {
    setInviteError(undefined);
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setInviteError('Email inválido');
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.rpc('invite_to_center', {
        p_email: trimmed,
        p_role: inviteRole,
      });
      if (error) {
        setInviteError(error.message);
        return;
      }
      setLastInviteCode(data ?? null);
      toast.push({ message: 'Invitación enviada', tone: 'success' });
      load();
    } finally {
      setInviting(false);
    }
  };

  const cancelInvitation = async (id: string) => {
    await supabase.from('center_invitations').delete().eq('id', id);
    toast.push({ message: 'Invitación cancelada', tone: 'neutral' });
    load();
  };

  const removeMember = async (userId: string) => {
    await supabase
      .from('center_members')
      .update({ is_active: false })
      .eq('user_id', userId);
    toast.push({ message: 'Miembro removido', tone: 'neutral' });
    load();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.push({ message: 'Código copiado', tone: 'neutral' });
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-h2">Miembros del centro</h1>
          <p className="mt-1 text-caption text-muted">
            Gestiona quién tiene acceso y qué rol tiene
          </p>
        </div>
        {canManage && (
          <Button onClick={openInvite}>
            <UserPlus size={18} aria-hidden="true" />
            Invitar miembro
          </Button>
        )}
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3">Miembros activos</h2>
        {loading ? (
          <p className="text-body text-muted">Cargando...</p>
        ) : members.filter((m) => m.is_active).length === 0 ? (
          <p className="text-body text-muted">Sin miembros todavía</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.filter((m) => m.is_active).map((m) => (
              <li
                key={m.user_id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold">
                  {(m.profile?.first_name?.[0] ?? m.profile?.full_name?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-body font-medium text-fg">
                    {m.profile?.full_name || 'Sin nombre'}
                  </p>
                  <p className="text-caption text-muted">{ROLE_LABELS[m.role]}</p>
                </div>
                {canManage && m.role !== 'super_admin' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void removeMember(m.user_id)}
                  >
                    Remover
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3">Invitaciones pendientes</h2>
          {invitations.length === 0 ? (
            <p className="text-body text-muted">Sin invitaciones pendientes</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-body font-medium text-fg">{inv.email}</p>
                    <p className="text-caption text-muted">
                      {ROLE_LABELS[inv.role]} · Expira {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Copiar código"
                    onClick={() => copyCode(inv.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-neutral-100"
                  >
                    <Copy size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancelar invitación"
                    onClick={() => void cancelInvitation(inv.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-danger-500/10 hover:text-danger-700"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invitar miembro">
        <div className="flex flex-col gap-4">
          {lastInviteCode ? (
            <>
              <p className="text-body text-fg">
                Invitación creada. Comparte este código con la persona para que pueda unirse:
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
                <code className="flex-1 break-all text-caption font-mono text-fg">
                  {lastInviteCode}
                </code>
                <button
                  type="button"
                  onClick={() => copyCode(lastInviteCode)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-neutral-100"
                  aria-label="Copiar"
                >
                  <Copy size={18} aria-hidden="true" />
                </button>
              </div>
              <p className="text-caption text-muted">
                La persona debe registrarse con este email y luego ingresar el código en "Unirme a un centro existente".
              </p>
              <div className="flex justify-end">
                <Button onClick={() => setInviteOpen(false)}>Listo</Button>
              </div>
            </>
          ) : (
            <>
              <Field
                id="invite-email"
                label="Email del invitado"
                required
                error={inviteError}
              >
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className={inputWithError(inviteError)}
                  placeholder="correo@ejemplo.com"
                  autoFocus
                />
              </Field>

              <div>
                <label className="mb-1.5 block text-label text-fg">Rol</label>
                <Segmented
                  ariaLabel="Rol del invitado"
                  value={inviteRole}
                  onChange={setInviteRole}
                  options={[
                    { value: 'visualizer', label: 'Visualizador' },
                    { value: 'admin', label: 'Administrador' },
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => void sendInvite()} disabled={inviting}>
                  {inviting ? 'Enviando...' : 'Enviar invitación'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
