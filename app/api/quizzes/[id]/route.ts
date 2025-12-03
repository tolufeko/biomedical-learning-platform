// app/api/quizzes/[id]/route.ts
import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const { data, error } = await supabase
      .from("quiz")
      .select(`
        *,
        quiz_questions (
          id,
          question_type,
          question_text,
          options,
          correct_answer,
          image_path,
          display_order
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

    // Generate fresh signed URLs for hotspot images
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    for (const q of data.quiz_questions) {
      if (q.question_type === 'hotspot' && q.image_path) {
        const {  data: signedUrlData } = await supabaseAdmin.storage
          .from('quiz-images')
          .createSignedUrl(q.image_path, 3600);
        q.image_url = signedUrlData?.signedUrl || null;
      }
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("GET /quizzes/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const { error } = await supabase.from("quiz").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true, message: "Quiz deleted successfully" });
  } catch (err: any) {
    console.error("DELETE /quizzes/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}