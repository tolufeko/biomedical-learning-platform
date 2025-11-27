import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: forms, error } = await supabase
      .from("custom_forms")
      .select(`
        *,
        form_questions (
          id,
          question_type,
          question_text,
          options,
          correct_answer,
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
    const { title, questions, description } = formData;

    console.log("Received form data:", { title, questionsCount: questions?.length, description });

    if (!title || !questions) {
      return NextResponse.json(
        { error: "Title and questions are required" },
        { status: 400 }
      );
    }

    // Create the form first
    const { data: form, error: formError } = await supabase
      .from("custom_forms")
      .insert([
        {
          title,
          description: description || null,
          questions: [], // Empty array for legacy column
          question_ids: [], // Will be updated after creating questions
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

    // Insert questions into form_questions table
    const formQuestions = questions.map((q: any, index: number) => ({
      form_id: form.id,
      question_type: q.type,
      question_text: q.question,
      options: q.options,
      correct_answer: q.correctAnswer,
      display_order: index,
      created_at: new Date().toISOString()
    }));

    console.log("Inserting questions:", formQuestions);

    const { data: insertedQuestions, error: questionsError } = await supabase
      .from("form_questions")
      .insert(formQuestions)
      .select('id');

    if (questionsError) {
      console.error("Supabase questions insertion error:", questionsError);
      // Clean up: delete the form if questions fail
      await supabase.from("custom_forms").delete().eq("id", form.id);
      return NextResponse.json({ 
        error: `Failed to create questions: ${questionsError.message}`,
        details: questionsError 
      }, { status: 500 });
    }

    console.log("Questions inserted:", insertedQuestions);

    // Update the form with question IDs
    const questionIds = insertedQuestions.map(q => q.id);
    const { error: updateError } = await supabase
      .from("custom_forms")
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
      .from("custom_forms")
      .select(`
        *,
        form_questions (
          id,
          question_type,
          question_text,
          options,
          correct_answer,
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