// app/api/quizzes/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { getUserRole } from '@/lib/auth/permissions';
import { supabaseServer } from '@/lib/supabase/supabaseServer';
import { shapeQuestion } from '@/lib/utility/transformQuiz';
import type { QuizQuestionRaw } from '@/lib/types/quiz';
import { putQuizBodySchema } from '@/lib/utility/validateQuizSchemas';

const supabaseAdmin = supabaseServer();

async function verifyQuizOwnership(quizId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('quiz').select('user_id').eq('id', quizId).single();
  if (error || !data) return false;
  if (data.user_id === userId) return true;
  const role = await getUserRole(userId);
  return role === 'teacher' || role === 'admin';
}

function extractImagePaths(questions: any[]): string[] {
  if (!Array.isArray(questions)) return [];
  return Array.from(new Set(questions.map(q => q.image_path || null).filter(Boolean) as string[]));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const quizResult = await supabaseAdmin
      .from('quiz')
      .select('*, profiles (username, email, role)')
      .eq('id', id)
      .single();

    if (quizResult.error) throw quizResult.error;
    if (!quizResult.data) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    const assignmentsResult = await supabaseAdmin
      .from('question_assignments')
      .select(`
        id, display_order,
        questions (
          id, question_type, question_text, options, correct_answer,
          image_path, question_topic, question_feedback, creator_id
        )
      `)
      .eq('quiz_id', id)
      .order('display_order', { ascending: true });

    if (assignmentsResult.error) throw assignmentsResult.error;

    const questions = assignmentsResult.data?.map(a => ({
      ...a.questions,
      display_order: a.display_order,
      question_assignment_id: a.id,
    })) || [];

    const questionsWithImages = await Promise.all(
      questions.map(async (q: any) => {
        if (!q.image_path) return q;
        const { data } = await supabaseAdmin.storage.from('quiz-images').createSignedUrl(q.image_path, 3600);
        return { ...q, image_url: data?.signedUrl || null };
      })
    );

    return NextResponse.json({ ...quizResult.data, questions: questionsWithImages });
  } catch (err: any) {
    console.error('GET /quizzes/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    if (!await verifyQuizOwnership(id, user.id)) {
      return NextResponse.json({ error: 'Forbidden: You do not own this quiz' }, { status: 403 });
    }

    const { data: assignments } = await supabaseAdmin
      .from('question_assignments')
      .select('id, questions (id, image_path)')
      .eq('quiz_id', id)
      .order('display_order', { ascending: true });

    const imagePaths = extractImagePaths(assignments?.map(a => a.questions) || []);
    const deletedPaths: string[] = [];
    const failedPaths: { path: string; error: string }[] = [];

    if (imagePaths.length > 0) {
      await Promise.allSettled(
        imagePaths.map(async (path) => {
          const { error } = await supabaseAdmin.storage.from('quiz-images').remove([path]);
          if (error) failedPaths.push({ path, error: error.message });
          else deletedPaths.push(path);
        })
      );
    }

    const { error: deleteError } = await supabaseAdmin.from('quiz').delete().eq('id', id);
    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete quiz after image cleanup', deletedImages: deletedPaths, failedImages: failedPaths },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz deleted successfully',
      cleanup: { totalImages: imagePaths.length, deleted: deletedPaths.length, failed: failedPaths.length, failedDetails: failedPaths },
    });
  } catch (err: any) {
    console.error('DELETE /quizzes/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    if (!await verifyQuizOwnership(id, user.id)) {
      return NextResponse.json({ error: 'Forbidden: You do not own this quiz' }, { status: 403 });
    }

    // Parse raw body first, then validate
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = putQuizBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          // Flattened errors are easier to consume on the client
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const { title, module, description, questions } = parsed.data;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!module) return NextResponse.json({ error: 'Module is required' }, { status: 400 });

    const updateResult = await supabaseAdmin
      .from('quiz')
      .update({ title, module, description: description || null })
      .eq('id', id)
      .select()
      .single();

    if (updateResult.error) throw updateResult.error;

    if (Array.isArray(questions) && questions.length > 0) {
      const { error: deleteError } = await supabaseAdmin.from('question_assignments').delete().eq('quiz_id', id);
      if (deleteError) throw deleteError;

      const assignmentData: any[] = [];

      for (const [index, q] of questions.entries()) {
        const existing = await supabaseAdmin
          .from('questions')
          .select('id')
          .eq('question_text', q.question)
          .eq('question_type', q.type)
          .single();

        let questionId: string;

        if (existing.data) {
          questionId = existing.data.id;
        } else {
          let correctAnswer = q.correctAnswer;
          if (q.type === 'text') {
            correctAnswer = typeof correctAnswer === 'string' ? correctAnswer : String(correctAnswer);
          } else if (!Array.isArray(correctAnswer)) {
            correctAnswer = [correctAnswer];
          }

          const { data: newQ, error: newQError } = await supabaseAdmin
            .from('questions')
            .insert([{
              question_type: q.type,
              question_text: q.question,
              options: q.options || null,
              correct_answer: correctAnswer,
              image_path: q.image_path || null,
              question_topic: q.question_topic || null,
              question_feedback: q.question_feedback || null,
              creator_id: user.id,
            }])
            .select('id')
            .single();

          if (newQError) throw newQError;
          questionId = newQ!.id;
        }

        assignmentData.push({ quiz_id: id, question_id: questionId, display_order: index });
      }

      const { error: insertError } = await supabaseAdmin.from('question_assignments').insert(assignmentData);
      if (insertError) throw insertError;
    }

    const { data: updatedAssignments, error: assignError } = await supabaseAdmin
      .from('question_assignments')
      .select(`
        id, display_order,
        questions (
          id, question_type, question_text, options, correct_answer,
          image_path, question_topic, question_feedback
        )
      `)
      .eq('quiz_id', id)
      .order('display_order', { ascending: true });

    if (assignError) throw assignError;

    return NextResponse.json({
      ...updateResult.data,
      questions: updatedAssignments?.map(a => shapeQuestion({
        ...(a.questions as unknown as QuizQuestionRaw),
        display_order: a.display_order,
        question_assignment_id: a.id,
      })) || [],
    });
  } catch (err: any) {
    console.error('PUT /quizzes/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}