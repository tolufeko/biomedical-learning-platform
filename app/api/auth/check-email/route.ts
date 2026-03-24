// app/api/auth/check-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/supabaseServer';

const supabaseAdmin = supabaseServer();

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ exists: !!data });
}