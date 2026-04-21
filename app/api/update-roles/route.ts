// app/api/update-roles/route.ts
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { getUserRole } from '@/lib/auth/permissions';
import { supabaseServer } from '@/lib/supabase/supabaseServer';
import type { UserRole } from '@/lib/constants/roles';

const supabaseAdmin = supabaseServer();

const VALID_ROLES: UserRole[] = ['admin', 'teacher', 'student'];
const isValidRole = (role: string): role is UserRole => VALID_ROLES.includes(role as UserRole);

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const role = await getUserRole(user.id);
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, email, role')
      .neq('role', 'guest')
      .limit(1000);

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // validate users permisissions
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const role = await getUserRole(user.id);
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { role: newRole, userId: targetId } = await request.json();

    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (targetId === user.id) {
      return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 400 });
    }

    if (!newRole) return NextResponse.json({ error: 'role is required' }, { status: 400 });
    if (!isValidRole(newRole)) {
      return NextResponse.json(
        { error: `Invalid role: ${newRole}. Valid roles are: admin, teacher, student` },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}