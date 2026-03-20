// app/api/quizzes/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Helper: get authenticated user from session
async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const userData = await supabase.auth.getUser();
  return { user: userData.data?.user ?? null, error: userData.error };
}

export async function GET() {
  try {
    // ✅ VERIFY AUTHENTICATION
    const { user, error } = await getSessionUser();
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Login required" },
        { status: 401 }
      );
    }

    const { data: quizzes, error: quizError } = await supabaseAdmin
      .from("quiz")
      .select("*")
      .order("created_at", { ascending: false });

    if (quizError) throw quizError;
    if (!quizzes) return NextResponse.json([]);

    const quizIds = quizzes.map(q => q.id);

    const { data: assignments, error: assignError } = await supabaseAdmin
      .from("question_assignments")
      .select(`
        quiz_id,
        display_order,
        questions (
          id,
          question_type,
          question_text,
          options,
          correct_answer,
          image_path,
          topic,
          creator_id
        )
      `)
      .in("quiz_id", quizIds)
      .order("display_order", { ascending: true });

    if (assignError) throw assignError;

    const quizzesWithQuestions = quizzes.map(quiz => {
      const relatedAssignments = assignments?.filter(a => a.quiz_id === quiz.id) || [];
      const questions = relatedAssignments.map(a => a.questions).filter(Boolean);
      return { ...quiz, questions };
    });

    return NextResponse.json(quizzesWithQuestions);
  } catch (err: any) {
    console.error("API GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // ✅ VERIFY AUTHENTICATION
    const { user, error } = await getSessionUser();
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Login required" },
        { status: 401 }
      );
    }

    const formData = await request.json();
    const { title, module, questions, description } = formData; // ✅ userId removed from body

    if (!title || !module || !questions) {
      return NextResponse.json(
        { error: "Title, module and questions are required" },
        { status: 400 }
      );
    }

    const { data: quiz, error: quizError } = await supabaseAdmin
      .from("quiz")
      .insert([{
        title,
        module,
        description: description || null,
        user_id: user.id, // ✅ taken from session
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
        .from("questions")
        .insert([{
          question_type: q.type,
          question_text: q.question,
          options: q.options,
          correct_answer: correctAnswer,
          image_path: q.image_path || null,
          topic: q.topic || null,
          creator_id: user.id, // ✅ taken from session
        }])
        .select('id')
        .single();

      if (qError) {
        await supabaseAdmin.from("quiz").delete().eq("id", quiz.id);
        throw qError;
      }

      insertedQuestions.push(newQ);
      assignments.push({ quiz_id: quiz.id, question_id: newQ.id, display_order: index });
    }

    if (assignments.length > 0) {
      const { error: assignError } = await supabaseAdmin
        .from("question_assignments")
        .insert(assignments);
      if (assignError) throw assignError;
    }

    const finalQuestions = insertedQuestions.map((q, idx) => ({
      id: q.id,
      question_type: questions[idx].type,
      question_text: questions[idx].question,
      options: questions[idx].options,
      correct_answer: questions[idx].correctAnswer,
      image_path: questions[idx].image_path,
      topic: questions[idx].topic,
      creator_id: user.id, // ✅ taken from session
    }));

    return NextResponse.json({ ...quiz, questions: finalQuestions });
  } catch (err: any) {
    console.error("API POST error:", err);
    return NextResponse.json({ error: err.message, details: err }, { status: 500 });
  }
}