import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { supabaseServer } from '@/lib/supabase/supabaseServer';
import { checkRateLimit } from '@/lib/utility/rateLimit';

const supabaseAdmin = supabaseServer();

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const { data: quizzes, error: quizError } = await supabaseAdmin
      .from('quiz')
      .select('*')
      .order('created_at', { ascending: false });

    if (quizError) throw quizError;
    if (!quizzes) return NextResponse.json([]);

    const { data: assignments, error: assignError } = await supabaseAdmin
      .from('question_assignments')
      .select(`
        quiz_id,
        display_order,
        questions (
          id, question_type, question_text, options, correct_answer,
          image_path, question_topic, question_feedback, creator_id
        )
      `)
      .in('quiz_id', quizzes.map(q => q.id))
      .order('display_order', { ascending: true });

    if (assignError) throw assignError;

    return NextResponse.json(
      quizzes.map(quiz => ({
        ...quiz,
        questions: assignments?.filter(a => a.quiz_id === quiz.id).map(a => a.questions).filter(Boolean) || [],
      }))
    );
  } catch (err: any) {
    console.error('API GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const rateLimit = checkRateLimit(user.id, 'create-quiz', {
      maxRequests: 10,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many quizzes created. Try again in ${rateLimit.secondsLeft}s.` },
        { status: 429 }
      );
    }

    const { title, module, questions, description } = await request.json();

    if (!title || !module || !questions) {
      return NextResponse.json({ error: 'Title, module and questions are required' }, { status: 400 });
    }

    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quiz')
      .insert([{
        title, module,
        description: description || null,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (quizError) throw quizError;

    const insertedQuestions = [];
    const assignments = [];

    for (let index = 0; index < questions.length; index++) {
      const q = questions[index];

      let correctAnswer = q.correctAnswer;
      if (q.type === 'text') {
        correctAnswer = typeof correctAnswer === 'string' ? correctAnswer : String(correctAnswer);
      } else if (!Array.isArray(correctAnswer)) {
        correctAnswer = [correctAnswer];
      }

      const { data: newQ, error: qError } = await supabaseAdmin
        .from('questions')
        .insert([{
          question_type: q.type,
          question_text: q.question,
          options: q.options,
          correct_answer: correctAnswer,
          image_path: q.image_path || null,
          question_topic: q.question_topic || null,
          question_feedback: q.question_feedback || null,
          creator_id: user.id,
        }])
        .select('id')
        .single();

      if (qError) {
        await supabaseAdmin.from('quiz').delete().eq('id', quiz.id);
        throw qError;
      }

      insertedQuestions.push(newQ);
      assignments.push({ quiz_id: quiz.id, question_id: newQ.id, display_order: index });
    }

    if (assignments.length > 0) {
      const { error: assignError } = await supabaseAdmin.from('question_assignments').insert(assignments);
      if (assignError) throw assignError;
    }

    return NextResponse.json({
      ...quiz,
      questions: insertedQuestions.map((q, idx) => ({
        id: q.id,
        question_type: questions[idx].type,
        question_text: questions[idx].question,
        options: questions[idx].options,
        correct_answer: questions[idx].correctAnswer,
        image_path: questions[idx].image_path,
        question_topic: questions[idx].question_topic,
        question_feedback: questions[idx].question_feedback,
        creator_id: user.id,
      })),
    });
  } catch (err: any) {
    console.error('API POST error:', err);
    return NextResponse.json({ error: err.message, details: err }, { status: 500 });
  }
}