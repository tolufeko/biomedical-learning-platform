import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Admin client for database operations (Service Role Key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // ✅ Fixed: Correct destructuring
    const { data: quizzes, error: quizzesError } = await supabaseAdmin
      .from("quiz")
      .select(`
        *,
        profiles (username, email)
      `)
      .order("created_at", { ascending: false });

    if (quizzesError) {
      console.error("Supabase GET error:", quizzesError);
      return NextResponse.json({ error: quizzesError.message }, { status: 500 });
    }

    // For each quiz, fetch its questions via junction table
    const quizzesWithQuestions = await Promise.all(
      quizzes.map(async (quiz: any) => {
        // ✅ Fixed: Correct destructuring
        const { data: assignments, error: assignError } = await supabaseAdmin
          .from('question_assignments')
          .select(`
            display_order,
            questions (
              id,
              question_type,
              question_text,
              options,
              correct_answer,
              image_path
            )
          `)
          .eq('quiz_id', quiz.id)
          .order('display_order', { ascending: true });

        if (assignError) {
          console.error(`Error fetching questions for quiz ${quiz.id}:`, assignError);
          return { ...quiz, questions: [] };
        }

        return {
          ...quiz,
          questions: assignments?.map(a => ({
            ...a.questions,
            display_order: a.display_order
          })) || []
        };
      })
    );

    return NextResponse.json(quizzesWithQuestions);

  } catch (err: any) {
    console.error("API GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // ✅ GET AUTHENTICATED USER FROM COOKIES
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // ✅ VERIFY USER IS LOGGED IN
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }

    // ✅ PARSE REQUEST BODY (NO userId!)
    const formData = await request.json();
    const { title, questions, description } = formData;

    // ✅ VALIDATE REQUIRED FIELDS
    if (!title || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: "Title and questions array are required" },
        { status: 400 }
      );
    }

    // Create the quiz first (using verified user.id)
    // ✅ Fixed: Correct destructuring
    const { data: quizData, error: quizError } = await supabaseAdmin
      .from("quiz")
      .insert([
        {
          title,
          description: description || null,
          user_id: user.id, // ✅ TRUSTED FROM VERIFIED SESSION
        }
      ])
      .select()
      .single();

    if (quizError) {
      console.error("Supabase quiz creation error:", quizError);
      return NextResponse.json({ 
        error: `Failed to create quiz: ${quizError.message}`
      }, { status: 500 });
    }

    const quiz = quizData;
    console.log(`Quiz created by ${user.id}:`, quiz.id);

    // Process each question: reuse existing or create new
    const assignmentData = [];
    
    for (let [index, q] of questions.entries()) {
      let questionId: string;
      
      // Check if question already exists (exact match on text + type)
      const { data: existingQuestion, error: checkError } = await supabaseAdmin
        .from('questions')
        .select('id')
        .eq('question_text', q.question)
        .eq('question_type', q.type)
        .single();

      if (existingQuestion) {
        // Reuse existing question
        questionId = existingQuestion.id;
        console.log(`Reusing existing question: ${questionId}`);
      } else {
        // Create new question in master bank
        let correctAnswer = q.correctAnswer;

        if (q.type === 'text') {
          correctAnswer = typeof correctAnswer === 'string' 
            ? correctAnswer 
            : String(correctAnswer);
        } else if (
          q.type === 'multiple-choice' || 
          q.type === 'checkbox' || 
          q.type === 'hotspot'
        ) {
          if (!Array.isArray(correctAnswer)) {
            correctAnswer = [correctAnswer];
          }
        }

        const { data: newQuestionData, error: qError } = await supabaseAdmin
          .from('questions')
          .insert([{
            question_type: q.type,
            question_text: q.question,
            options: q.options || null,
            correct_answer: correctAnswer,
            image_path: q.image_path || null,
          }])
          .select('id')
          .single();

        if (qError) throw qError;
        const newQuestion = newQuestionData;
        questionId = newQuestion.id;
        console.log(`Created new question: ${questionId}`);
      }

      // Create assignment (link quiz ↔ question)
      assignmentData.push({
        quiz_id: quiz.id,
        question_id: questionId,
        display_order: index,
      });
    }

    // Bulk insert all assignments
    const { error: assignError } = await supabaseAdmin
      .from('question_assignments')
      .insert(assignmentData);

    if (assignError) {
      console.error("Assignment insertion error:", assignError);
      // Clean up: delete quiz if assignments fail
      await supabaseAdmin.from('quiz').delete().eq('id', quiz.id);
      throw assignError;
    }

    console.log("Assignments created:", assignmentData.length);

    // Fetch complete quiz with questions
    const { data: assignments } = await supabaseAdmin
      .from('question_assignments')
      .select(`
        display_order,
        questions (
          id,
          question_type,
          question_text,
          options,
          correct_answer,
          image_path
        )
      `)
      .eq('quiz_id', quiz.id)
      .order('display_order', { ascending: true });

    const quizWithQuestions = {
      ...quiz,
      questions: assignments?.map(a => ({
        ...a.questions,
        display_order: a.display_order
      })) || []
    };

    return NextResponse.json(quizWithQuestions);

  } catch (err: any) {
    console.error("API POST error:", err);
    return NextResponse.json({ 
      error: `Internal server error: ${err.message}`
    }, { status: 500 });
  }
}