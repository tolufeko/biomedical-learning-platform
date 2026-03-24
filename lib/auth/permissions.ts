import { createClient } from '@supabase/supabase-js';
import { PRIVILEGED_ROLES } from '@/lib/constants/roles';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getUserRole(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles').select('role').eq('id', userId).single();
  return error ? null : data.role;
}

export async function canAccessUserData(viewerUserId: string, targetUserId?: string | null) {
  if (!targetUserId || viewerUserId === targetUserId) return { allowed: true };
  const role = await getUserRole(viewerUserId);
  if (PRIVILEGED_ROLES.includes(role)) return { allowed: true };
  return { allowed: false, reason: 'Students can only view their own statistics' };
}