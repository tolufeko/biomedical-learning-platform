// app/api/upload/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { supabaseServer } from '@/lib/supabase/supabaseServer';

const supabaseAdmin = supabaseServer();

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file || file.size === 0) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `uploads/quiz-${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('quiz-images')
      .upload(filePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data, error: urlError } = await supabaseAdmin.storage
      .from('quiz-images')
      .createSignedUrl(filePath, 3600);

    if (urlError || !data?.signedUrl) {
      await supabaseAdmin.storage.from('quiz-images').remove([filePath]);
      return NextResponse.json({ error: 'URL generation failed' }, { status: 500 });
    }

    return NextResponse.json({ imageUrl: data.signedUrl, filePath });
  } catch (err) {
    console.error('Upload API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}