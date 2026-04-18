// app/api/create-profile/route.ts
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { supabaseServer } from '@/lib/supabase/supabaseServer';

const supabaseAdmin = supabaseServer();
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

async function resolveUser(request: Request) {
  let user = await getServerUser();
  if (user) return user;
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '').trim();
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token);
    user = data.user ?? null;
  }

  return user;
}

export async function POST(request: Request) {
  const user = await resolveUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { username, role = 'student' } = await request.json();

  if (typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
    return NextResponse.json({ error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores.' }, { status: 422 });
  }

  // Check username availability
  const { data: existingUsername } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existingUsername) {
    return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert(
      { id: user.id, username, role },
      { onConflict: 'id' }
    );

  if (error) {
    if (error.code === '23505' && error.message.includes('username')) {
      return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 });
    }
    console.error('Profile upsert error:', error);
    return NextResponse.json({ error: 'Failed to create profile.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}