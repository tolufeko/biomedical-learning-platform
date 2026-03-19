import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const userData = await supabase.auth.getUser();
    const user = userData.data?.user;

    if (userData.error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }
    
    // Fetch questions from database
    let query = supabase
      .from('questions')
      .select('*');

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      );
    }

    // Transform Supabase schema to match frontend expectations
    const transformedQuestions = await Promise.all(
      (data || []).map(async (q: any) => {
        let imageUrl: string | undefined = undefined;

        // Generate signed URL if image_path exists
        if (q.image_path) {
          try {
            // ✅ USE ADMIN CLIENT FOR STORAGE (has service role permissions)
            const { data: imageData, error: urlError } = await supabaseAdmin.storage
              .from('quiz-images') // Your bucket name
              .createSignedUrl(q.image_path, 3600); // 1 hour expiry

            if (urlError || !imageData?.signedUrl) {
              console.error(`Failed to generate signed URL for ${q.id}:`, urlError?.message || 'Unknown error');
              console.error(`Path: "${q.image_path}"`);
            } else {
              imageUrl = imageData.signedUrl;
            }
          } catch (storageError) {
            console.error('Storage error:', storageError);
          }
        }

        return {
          id: q.id,
          type: q.question_type,
          topic: q.topic,
          question: q.question_text,
          options: q.options || [],
          correctAnswer: q.correct_answer || [],
          image_path: q.image_path || undefined,
          image_url: imageUrl,
        };
      })
    );

    // Count failed images for debugging
    const failedImages = transformedQuestions.filter(q => q.image_path && !q.image_url).length;
    if (failedImages > 0) {
      console.log(`⚠️ ${failedImages} image(s) could not be loaded`);
    }

    return NextResponse.json({
      questions: transformedQuestions,
      count: transformedQuestions.length,
    });
  } catch (error) {
    console.error('Error in question-bank API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}