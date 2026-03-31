// app/api/upload/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { supabaseServer } from '@/lib/supabase/supabaseServer';
import { checkRateLimit } from '@/lib/utility/rateLimit';

const supabaseAdmin = supabaseServer();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const MAGIC_BYTES: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png':  (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/gif':  (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  'image/webp': (b) => b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

function detectMimeType(bytes: Uint8Array): string | null {
  for (const [mime, check] of Object.entries(MAGIC_BYTES)) {
    if (check(bytes)) return mime;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const rateLimit = checkRateLimit(user.id, 'upload', {
      maxRequests: 20,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many uploads. Try again in ${rateLimit.secondsLeft}s.` },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const detectedType = detectMimeType(bytes);

    if (!detectedType) {
      return NextResponse.json({ error: 'File must be a JPEG, PNG, GIF, or WEBP image' }, { status: 400 });
    }

    if (file.type !== detectedType) {
      console.warn(`MIME mismatch for user ${user.id}: reported=${file.type}, detected=${detectedType}`);
    }

    const fileExt = EXT_MAP[detectedType];
    const filePath = `uploads/quiz-${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('quiz-images')
      .upload(filePath, buffer, { contentType: detectedType, upsert: false });

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