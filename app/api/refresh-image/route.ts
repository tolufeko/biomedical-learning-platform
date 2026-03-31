// app/api/refresh-image/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getServerUser } from '@/lib/auth/getServerUser';
import { supabaseServer } from '@/lib/supabase/supabaseServer';

const supabaseAdmin = supabaseServer();

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const { filePath } = await request.json();

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'Valid filePath is required' }, { status: 400 });
    }

    // Normalise to resolve any ../ sequences, then strip any leading slash
    const normalised = path.posix.normalize(filePath).replace(/^\/+/, '');

    if (!normalised.startsWith('uploads/quiz-')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from('quiz-images')
      .createSignedUrl(normalised, 3600);

    if (error || !data?.signedUrl) {
      console.error('Failed to refresh signed URL:', error);
      return NextResponse.json({ error: 'Failed to refresh image URL' }, { status: 500 });
    }

    return NextResponse.json({ success: true, imageUrl: data.signedUrl });
  } catch (err) {
    console.error('Refresh image API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}