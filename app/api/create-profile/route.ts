// app/api/create-profile/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/supabaseServer';

const supabaseAdmin = supabaseServer();
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

async function resolveUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user ?? null;
}

export async function POST(request: Request) {
  const user = await resolveUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { username, role = 'student' } = await request.json();

  if (typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores.' },
      { status: 422 }
    );
  }

  const { data: taken } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (taken) {
    return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: user.id, username, role }, { onConflict: 'id' });

  if (error) {
    if (error.code === '23505' && error.message.includes('username')) {
      return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 });
    }
    console.error('Profile upsert error:', error);
    return NextResponse.json({ error: 'Failed to create profile.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// app/api/create-profile/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const password = searchParams.get('password');
  const confirmPassword = searchParams.get('confirmPassword');

  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match.' }, { status: 422 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 422 });
  }

  if (!username || !USERNAME_REGEX.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores.' },
      { status: 422 }
    );
  }

  const { data: taken } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (taken) {
    return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 });
  }

  return NextResponse.json({ valid: true });
}