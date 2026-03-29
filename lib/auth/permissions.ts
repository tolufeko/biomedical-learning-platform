// lib/auth/permissions.ts
import { supabaseServer } from '@/lib/supabase/supabaseServer';
import { PRIVILEGED_ROLES } from '@/lib/constants/roles';

export async function getUserRole(userId: string) {
  const { data, error } = await supabaseServer()
    .from('profiles').select('role').eq('id', userId).single();
  return error ? null : data.role;
}

export async function canAccessUserData(viewerUserId: string, targetUserId?: string | null) {
  if (!targetUserId || viewerUserId === targetUserId) return { allowed: true };
  const role = await getUserRole(viewerUserId);
  if (PRIVILEGED_ROLES.includes(role)) return { allowed: true };
  return { allowed: false, reason: 'Students can only view their own statistics' };
}