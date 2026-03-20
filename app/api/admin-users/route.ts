import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Helper: Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const profileResult = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileResult.error || !profileResult.data) return false;
  return profileResult.data.role === 'admin';
}

// ✅ Helper: Validate role value
function isValidRole(role: string): boolean {
  const validRoles = ['admin', 'teacher', 'student'];
  return validRoles.includes(role);
}

export async function GET(request: Request) {
  try {
    // ✅ VERIFY AUTHENTICATION
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    
    const userData = await supabase.auth.getUser();
    const currentUser = userData.data?.user;

    if (userData.error || !currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }

    // ✅ VERIFY ADMIN AUTHORIZATION
    const userIsAdmin = await isAdmin(currentUser.id);
    if (!userIsAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // ✅ FETCH USERS (EXCLUDE GUESTS)
    const profilesResult = await supabaseAdmin
      .from('profiles')
      .select('id, username, email, role')
      .neq('role', 'guest')
      .limit(1000);

    if (profilesResult.error) throw profilesResult.error;
    
    return NextResponse.json(profilesResult.data);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // ✅ VERIFY AUTHENTICATION
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    
    const userData = await supabase.auth.getUser();
    const currentUser = userData.data?.user;

    if (userData.error || !currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }

    // ✅ VERIFY ADMIN AUTHORIZATION
    const userIsAdmin = await isAdmin(currentUser.id);
    if (!userIsAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { role } = await request.json();

    if (!role) {
      return NextResponse.json(
        { error: 'role is required' },
        { status: 400 }
      );
    }

    // ✅ VALIDATE ROLE VALUE
    if (!isValidRole(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}. Valid roles are: admin, teacher, student` },
        { status: 400 }
      );
    }

    // ✅ UPDATE USER ROLE
    const updateResult = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', currentUser.id);

    if (updateResult.error) throw updateResult.error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}