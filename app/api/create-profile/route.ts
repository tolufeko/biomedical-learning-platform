// app/api/create-profile/route.ts
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { supabaseServer } from '@/lib/supabase/supabaseServer';

const supabaseAdmin = supabaseServer();
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const VALID_ROLES = ['student', 'teacher'] as const;

export async function POST(request: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { username, role = 'student' } = await request.json();

  if (typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
    return NextResponse.json({ error: 'Invalid username.' }, { status: 422 });
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 422 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .insert({ id: user.id, username, role });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create profile.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username || !USERNAME_REGEX.test(username)) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  return NextResponse.json({ available: !data });
}