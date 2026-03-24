// app/api/question-bank/route.ts
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { supabaseServer } from '@/lib/supabase/supabaseServer';

const supabaseAdmin = supabaseServer();

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const { data, error } = await supabaseAdmin.from('questions').select('*');

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    const transformedQuestions = await Promise.all(
      (data || []).map(async (q: any) => {
        let imageUrl: string | undefined;

        if (q.image_path) {
          try {
            const { data: imageData, error: urlError } = await supabaseAdmin.storage
              .from('quiz-images')
              .createSignedUrl(q.image_path, 3600);

            if (urlError || !imageData?.signedUrl) {
              console.error(`Failed to generate signed URL for ${q.id}:`, urlError?.message);
            } else {
              imageUrl = imageData.signedUrl;
            }
          } catch (err) {
            console.error('Storage error:', err);
          }
        }

        return {
          id: q.id,
          type: q.question_type,
          topic: q.question_topic,
          feedback: q.question_feedback,
          question: q.question_text,
          options: q.options || [],
          correctAnswer: q.correct_answer || [],
          image_path: q.image_path || undefined,
          image_url: imageUrl,
        };
      })
    );

    const failedImages = transformedQuestions.filter(q => q.image_path && !q.image_url).length;
    if (failedImages > 0) console.log(`⚠️ ${failedImages} image(s) could not be loaded`);

    return NextResponse.json({ questions: transformedQuestions, count: transformedQuestions.length });
  } catch (error) {
    console.error('Error in question-bank API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}