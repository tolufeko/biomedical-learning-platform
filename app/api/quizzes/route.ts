// app/api/quizzes/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // 1. Fetch all quizzes first
    const { data: quizzes, error: quizError } = await supabase
      .from("quiz")
      .select("*")
      .order("created_at", { ascending: false });

    if (quizError) throw quizError;
    if (!quizzes) return NextResponse.json([]);

    // 2. Fetch assignments and questions for these quizzes
    const quizIds = quizzes.map(q => q.id);
    
    const { data: assignments, error: assignError } = await supabase
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

    // 3. Map the questions back to their respective quizzes
    const quizzesWithQuestions = quizzes.map(quiz => {
      const relatedAssignments = assignments?.filter(a => a.quiz_id === quiz.id) || [];
      
      // Extract the actual question objects and sort by display_order just in case
      const questions = relatedAssignments
        .map(a => a.questions)
        .filter(Boolean); // Remove any nulls if a question was deleted but assignment remains

      return {
        ...quiz,
        questions: questions
      };
    });

    return NextResponse.json(quizzesWithQuestions);

  } catch (err: any) {
    console.error("API GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.json();
    const { title, questions, description, userId } = formData;

    if (!title || !questions) {
      return NextResponse.json({ error: "Title and questions are required" }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // 1. Create the quiz
    const { data: quiz, error: quizError } = await supabase
      .from("quiz")
      .insert([{
        title,
        description: description || null,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (quizError) throw quizError;

    // 2. Insert questions AND create assignments
    const insertedQuestions = [];
    const assignments = [];

    for (let index = 0; index < questions.length; index++) {
      const q = questions[index];
      
      // Prepare correct answer based on type
      let correctAnswer = q.correctAnswer;
      if (q.type === 'text') {
        correctAnswer = typeof correctAnswer === 'string' ? correctAnswer : String(correctAnswer);
      } else if (!Array.isArray(correctAnswer) && q.type !== 'text') {
        correctAnswer = [correctAnswer];
      }

      // A. Insert into 'questions' table (No quiz_id here!)
      const { data: newQ, error: qError } = await supabase
        .from("questions")
        .insert([{
          question_type: q.type,
          question_text: q.question,
          options: q.options,
          correct_answer: correctAnswer,
          image_path: q.image_path || null,
          topic: q.topic || null,
          creator_id: userId,
        }])
        .select('id')
        .single();

      if (qError) {
        // Cleanup: Delete quiz if question fails
        await supabase.from("quiz").delete().eq("id", quiz.id);
        throw qError;
      }

      insertedQuestions.push(newQ);

      // B. Link them in 'question_assignments' table
      assignments.push({
        quiz_id: quiz.id,
        question_id: newQ.id,
        display_order: index,
      });
    }

    // 3. Bulk insert the assignments
    if (assignments.length > 0) {
      const { error: assignError } = await supabase
        .from("question_assignments")
        .insert(assignments);

      if (assignError) throw assignError;
    }

    // 4. Return the complete quiz 
    const finalQuestions = insertedQuestions.map((q, idx) => {
       return {
         id: q.id,
         question_type: questions[idx].type,
         question_text: questions[idx].question,
         options: questions[idx].options,
         correct_answer: questions[idx].correctAnswer, 
         image_path: questions[idx].image_path,
         topic: questions[idx].topic,
         creator_id: userId
       };
    });

    return NextResponse.json({
      ...quiz,
      questions: finalQuestions
    });

  } catch (err: any) {
    console.error("API POST error:", err);
    return NextResponse.json({ error: err.message, details: err }, { status: 500 });
  }
}