// app/api/quizzes/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: forms, error } = await supabase
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
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(forms || []);

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
      return NextResponse.json(
        { error: "Title and questions are required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Create the form first
    const { data: form, error: formError } = await supabase
      .from("quiz")
      .insert([
        {
          title,
          description: description || null,
          question_ids: [],
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ])
      .select()
      .single();

    if (formError) {
      console.error("Supabase form creation error:", formError);
      return NextResponse.json({ 
        error: `Failed to create form: ${formError.message}`,
        details: formError 
      }, { status: 500 });
    }

    console.log("Form created:", form.id);

    // Insert questions into quiz_questions table
    const formQuestions = questions.map((q: any, index: number) => {
      let correctAnswer = q.correctAnswer;

      // Handle correctAnswer based on question type
      if (q.type === 'text') {
        // Keep as string (or convert to string if needed)
        correctAnswer = typeof correctAnswer === 'string' 
          ? correctAnswer 
          : String(correctAnswer);
      } else if (
        q.type === 'multiple-choice' || 
        q.type === 'checkbox' || 
        q.type === 'hotspot'
      ) {
        // Ensure it's an array
        if (!Array.isArray(correctAnswer)) {
          correctAnswer = [correctAnswer];
        }
      } else {
        // Fallback: preserve as-is (or log warning)
        console.warn(`Unknown question type: ${q.type}, correctAnswer:`, correctAnswer);
      }

      return {
        form_id: form.id,
        question_type: q.type,
        question_text: q.question,
        options: q.options,
        correct_answer: correctAnswer, // ✅ string for text, array for others
        image_path: q.image_path || null,
        display_order: index,
      };
    });

    console.log("Inserting questions:", formQuestions);

    const { data: insertedQuestions, error: questionsError } = await supabase
      .from("quiz_questions")
      .insert(formQuestions)
      .select('id');

    if (questionsError) {
      console.error("Supabase questions insertion error:", questionsError);
      // Clean up: delete the form if questions fail
      await supabase.from("quiz").delete().eq("id", form.id);
      return NextResponse.json({ 
        error: `Failed to create questions: ${questionsError.message}`,
        details: questionsError 
      }, { status: 500 });
    }

    console.log("Questions inserted:", insertedQuestions);

    // Update the form with question IDs
    const questionIds = insertedQuestions.map(q => q.id);
    const { error: updateError } = await supabase
      .from("quiz")
      .update({ 
        question_ids: questionIds,
        updated_at: new Date().toISOString()
      })
      .eq("id", form.id);

    if (updateError) {
      console.error("Supabase form update error:", updateError);
      return NextResponse.json({ 
        error: `Failed to update form with question IDs: ${updateError.message}`,
        details: updateError 
      }, { status: 500 });
    }

    // Fetch the complete form with questions
    const { data: completeForm, error: completeError } = await supabase
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
      .eq("id", form.id)
      .single();

    if (completeError) {
      console.error("Supabase complete form fetch error:", completeError);
      return NextResponse.json({ 
        error: `Failed to fetch complete form: ${completeError.message}`,
        details: completeError 
      }, { status: 500 });
    }

    console.log("Complete form fetched:", completeForm);
    return NextResponse.json(completeForm);

  } catch (err: any) {
    console.error("API POST error:", err);
    return NextResponse.json({ 
      error: `Internal server error: ${err.message}`,
      details: err 
    }, { status: 500 });
  }
}