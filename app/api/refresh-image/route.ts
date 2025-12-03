// app/api/refresh-image/route.ts
import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'Valid filePath is required' }, { status: 400 });
    }

    // Optional: basic security check
    if (!filePath.startsWith('uploads/quiz-')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const { data, error } = await supabase.storage
      .from('quiz-images')
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      console.error('Failed to refresh signed URL:', error);
      return NextResponse.json({ error: 'Failed to refresh image URL' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imageUrl: data.signedUrl,
    });

  } catch (err) {
    console.error('Refresh image API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}