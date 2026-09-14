import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

import { fetchCurrentPermissions, type ModuleId, type PermissionAction, type PermissionMap } from '../../lib/permissions';

export type UserRole = 'super_admin' | 'admin' | 'visualizer';

export interface Profile {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  doc_type: string | null;
  doc_number: string | null;
  birth_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  centerId: string | null;
  role: UserRole | null;
  permissions: PermissionMap;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (module: ModuleId, action: PermissionAction) => boolean;
}

const signOutFn = async () => {
  await supabase.auth.signOut();
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  profile: null,
  centerId: null,
  role: null,
  permissions: {},
  loading: true,
  signOut: signOutFn,
  refresh: async () => {},
  hasPermission: () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (data) return data;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return null;

  const meta = user.user_metadata ?? {};
  const firstName = (meta.first_name as string | undefined) ?? '';
  const lastName = (meta.last_name as string | undefined) ?? '';
  const fullName = (meta.full_name as string | undefined) ?? `${firstName} ${lastName}`.trim();
  const { error: insertErr } = await supabase.from('profiles').insert({
    id: user.id,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    doc_type: meta.doc_type ?? null,
    doc_number: meta.doc_number ?? null,
    birth_date: meta.birth_date ?? null,
  });
  if (insertErr) {
    console.error('fetchProfile insert failed', insertErr);
    return null;
  }

  const { data: retry } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return retry;
}

async function fetchCenterMembership(userId: string): Promise<{ centerId: string; role: UserRole } | null> {
  const { data } = await supabase
    .from('center_members')
    .select('center_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { centerId: data.center_id, role: data.role as UserRole };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'signOut' | 'refresh' | 'hasPermission'>>({
    session: null,
    user: null,
    profile: null,
    centerId: null,
    role: null,
    permissions: {},
    loading: true,
  });

  const loadAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setState({
        session: null,
        user: null,
        profile: null,
        centerId: null,
        role: null,
        permissions: {},
        loading: false,
      });
      return;
    }

    const [profile, membership] = await Promise.all([
      fetchProfile(session.user.id),
      fetchCenterMembership(session.user.id),
    ]);

    const isSuper = membership?.role === 'super_admin';
    const permissions = await fetchCurrentPermissions(session.user.id, isSuper);

    setState({
      session,
      user: session.user,
      profile,
      centerId: membership?.centerId ?? null,
      role: membership?.role ?? null,
      permissions,
      loading: false,
    });
  }, []);

  const refresh = useCallback(async () => {
    await loadAuth();
  }, [loadAuth]);

  const hasPermission = useCallback(
    (module: ModuleId, action: PermissionAction): boolean => {
      if (state.role === 'super_admin') return true;
      const modPerm = state.permissions[module];
      if (!modPerm) return false;
      switch (action) {
        case 'view':
          return modPerm.can_view;
        case 'create':
          return modPerm.can_create;
        case 'edit':
          return modPerm.can_edit;
        case 'delete':
          return modPerm.can_delete;
        default:
          return false;
      }
    },
    [state.role, state.permissions],
  );

  useEffect(() => {
    loadAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadAuth();
    });

    return () => subscription.unsubscribe();
  }, [loadAuth]);

  return (
    <AuthContext.Provider value={{ ...state, signOut: signOutFn, refresh, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}
