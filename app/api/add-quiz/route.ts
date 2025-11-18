import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, h5p_json } = body;
    
    if (!title || !h5p_json) {
      return NextResponse.json({ error: "Missing title or H5P JSON" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("quizzes")
      .insert({ 
        title, 
        description: description || null,
        h5p_json 
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}