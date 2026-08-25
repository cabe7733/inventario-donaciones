import { useEffect, useState } from 'react';
import { Copy, EnvelopeSimple, UserPlus, X } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Field, inputWithError } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';

type Role = 'super_admin' | 'admin' | 'visualizer';

interface Center {
  id: string;
  name: string;
}

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
  const { role, centerId } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [center, setCenter] = useState<Center | null>(null);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'visualizer'>('visualizer');
  const [inviteError, setInviteError] = useState<string>();
  const [inviting, setInviting] = useState(false);
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);
  const [lastInviteEmailSent, setLastInviteEmailSent] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canManage = role === 'super_admin';

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    // ponytail: profiles tiene RLS que solo deja leer el propio. La RPC
    // get_center_member_profiles() es SECURITY DEFINER y devuelve los
    // profiles de todos los miembros activos del centro del usuario.
    const [membersRes, invitesRes, centerRes] = await Promise.all([
      supabase
        .from('center_members')
        .select('user_id, role, is_active, created_at')
        .order('created_at', { ascending: true }),
      supabase
        .from('center_invitations')
        .select('id, email, role, expires_at, accepted_at, created_at')
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
      centerId
        ? supabase.from('centers').select('id, name').eq('id', centerId).single()
        : Promise.resolve({ data: null } as { data: Center | null }),
    ]);

    if (membersRes.error) {
      setLoadError(membersRes.error.message);
      setMembers([]);
      setLoading(false);
      return;
    }

    // ponytail: RPC SECURITY DEFINER que bypasea RLS de profiles.
    // Antes: query directo a profiles fallaba porque la policy solo permitía
    // leer el propio profile. Ahora la RPC devuelve los profiles de todos
    // los miembros activos del centro del usuario actual.
    const { data: profiles, error: profilesErr } = await supabase.rpc(
      'get_center_member_profiles',
    );
    if (profilesErr) {
      setLoadError(profilesErr.message);
      setMembers([]);
      setLoading(false);
      return;
    }
    type MemberProfile = { full_name: string; first_name: string; last_name: string; email: string | null };
    const profileById = new Map<string, MemberProfile>(
      (profiles ?? []).map((p: { user_id: string; full_name: string | null; first_name: string | null; last_name: string | null; email: string | null }) => [
        p.user_id,
        {
          full_name: p.full_name ?? '',
          first_name: p.first_name ?? '',
          last_name: p.last_name ?? '',
          email: p.email,
        },
      ]),
    );

    setMembers(
      (membersRes.data ?? []).map((r) => ({
        user_id: r.user_id,
        role: r.role,
        is_active: r.is_active,
        created_at: r.created_at,
        profile: profileById.get(r.user_id) ?? null,
      })),
    );
    if (!invitesRes.error) setInvitations((invitesRes.data ?? []) as Invitation[]);
    if (centerRes?.data) setCenter(centerRes.data as Center);
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
      setLastInviteEmailSent(null);

      const { data: sent } = await supabase.functions.invoke<{ sent: boolean; reason?: string }>(
        'send-invitation',
        {
          body: {
            invitation_id: data,
            email: trimmed,
            role: inviteRole,
            center_name: center?.name ?? 'tu centro',
            accept_url: `${window.location.origin}/onboarding/unirse-centro`,
          },
        },
      );
      const ok = sent?.sent === true;
      setLastInviteEmailSent(ok);

      toast.push({
        message: ok ? 'Invitación enviada por correo' : 'Invitación creada. Comparte el código.',
        tone: ok ? 'success' : 'neutral',
      });
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
    toast.push({ message: 'Acceso revocado', tone: 'neutral' });
    load();
  };

  const restoreMember = async (userId: string) => {
    await supabase
      .from('center_members')
      .update({ is_active: true })
      .eq('user_id', userId);
    toast.push({ message: 'Acceso restablecido', tone: 'success' });
    load();
  };

  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const activeMembers = members.filter((m) => m.is_active);
  const revokedMembers = members.filter((m) => !m.is_active);

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

      {loadError && (
        <div className="rounded-lg border border-danger-500/40 bg-danger-500/10 p-3 text-caption text-danger-700" role="alert">
          Error cargando miembros: {loadError}
        </div>
      )}

      {!loadError && !centerId && (
        <div className="rounded-lg border border-warning-500/40 bg-warning-500/10 p-3 text-caption text-warning-700" role="alert">
          No estás asociado a ningún centro todavía.
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-h3">
          Miembros activos{' '}
          <span className="text-caption font-normal text-muted">({activeMembers.length})</span>
        </h2>
        {loading ? (
          <p className="text-body text-muted">Cargando...</p>
        ) : activeMembers.length === 0 ? (
          <p className="text-body text-muted">Sin miembros todavía</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeMembers.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold">
                  {(m.profile?.first_name?.[0] || m.profile?.full_name?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-body font-medium text-fg">
                    {m.profile?.full_name?.trim() || m.profile?.email || `Usuario ${m.user_id.slice(0, 8)}`}
                  </p>
                  <p className="truncate text-caption text-muted">
                    {ROLE_LABELS[m.role]}
                    {m.profile?.email && ` · ${m.profile.email}`}
                  </p>
                </div>
                {canManage && m.role !== 'super_admin' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmRemove(m)}
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
          <h2 className="text-h3">
            Acceso revocado{' '}
            <span className="text-caption font-normal text-muted">({revokedMembers.length})</span>
          </h2>
          {loading ? (
            <p className="text-body text-muted">Cargando...</p>
          ) : revokedMembers.length === 0 ? (
            <p className="text-body text-muted">Sin accesos revocados</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {revokedMembers.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-muted font-semibold">
                    {(m.profile?.first_name?.[0] || m.profile?.full_name?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-body font-medium text-fg">
                      {m.profile?.full_name?.trim() || m.profile?.email || `Usuario ${m.user_id.slice(0, 8)}`}
                    </p>
                    <p className="truncate text-caption text-muted">
                      {ROLE_LABELS[m.role]}
                      {m.profile?.email && ` · ${m.profile.email}`}
                    </p>
                  </div>
                  {m.role !== 'super_admin' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void restoreMember(m.user_id)}
                    >
                      Restablecer acceso
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
                      {ROLE_LABELS[inv.role]} · {inv.expires_at ? `Expira ${new Date(inv.expires_at).toLocaleDateString('es-CO')}` : 'Sin expiración'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Copiar código"
                    onClick={() => copyCode(inv.id)}
                    className="h-11 w-11 px-0"
                  >
                    <Copy size={18} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Cancelar invitación"
                    onClick={() => void cancelInvitation(inv.id)}
                    className="h-11 w-11 px-0 hover:bg-danger-500/10 hover:text-danger-700"
                  >
                    <X size={18} aria-hidden="true" />
                  </Button>
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
              <div className="flex items-center gap-2 rounded-lg border border-success-500/40 bg-success-500/10 p-3 text-caption text-success-700">
                <EnvelopeSimple size={16} aria-hidden="true" />
                {lastInviteEmailSent === true
                  ? 'Invitación enviada por correo.'
                  : lastInviteEmailSent === false
                    ? 'No se pudo enviar el correo. Comparte el código con la persona.'
                    : 'Invitación creada.'}
              </div>
              <p className="text-body text-fg">
                Comparte este código con la persona para que pueda unirse:
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

      <Modal
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title="Revocar acceso"
      >
        <div className="flex flex-col gap-4">
          <p className="text-body text-fg">
            ¿Revocar el acceso de <strong>{confirmRemove?.profile?.full_name || 'esta persona'}</strong>?
          </p>
          <p className="text-caption text-muted">
            No podrá ver ni modificar datos del centro. Podrás restablecer su acceso después.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmRemove) {
                  void removeMember(confirmRemove.user_id);
                  setConfirmRemove(null);
                }
              }}
            >
              Revocar acceso
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
