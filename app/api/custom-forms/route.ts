import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("custom_forms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to ensure correctAnswer field exists
    const transformedData = (data || []).map(form => ({
      ...form,
      questions: Array.isArray(form.questions) ? form.questions.map((q: any) => ({
        ...q,
        correctAnswer: q.correctAnswer || '' // Ensure correctAnswer exists
      })) : []
    }));

    return NextResponse.json(transformedData);

  } catch (err: any) {
    console.error("API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.json();
    const { title, questions, description } = formData;

    if (!title || !questions) {
      return NextResponse.json(
        { error: "Title and questions are required" },
        { status: 400 }
      );
    }

    // Validate that all questions have correct answers
    const invalidQuestions = questions.filter((q: any) => {
      if (!q.correctAnswer && q.correctAnswer !== '') return true;
      
      switch (q.type) {
        case 'text':
        case 'textarea':
          return !q.correctAnswer || q.correctAnswer.trim() === '';
        
        case 'multiple-choice':
        case 'dropdown':
          return !q.correctAnswer || !q.options.includes(q.correctAnswer);
        
        case 'checkbox':
          return !Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0;
        
        case 'rating':
          return !q.correctAnswer || isNaN(Number(q.correctAnswer));
        
        default:
          return true;
      }
    });

    if (invalidQuestions.length > 0) {
      return NextResponse.json(
        { error: "All questions must have valid correct answers" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("custom_forms")
      .insert([
        {
          title,
          description: description || null,
          questions: questions.map((q: any) => ({
            ...q,
            required: true // Force all questions to be required
          })),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (err: any) {
    console.error("API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}