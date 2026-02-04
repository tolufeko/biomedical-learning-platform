import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Admin client for database operations (Service Role Key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // ✅ PARSE REQUEST BODY (NO user_id!)
    const { question_id, correct, time_spent } = await request.json();

    // ✅ VALIDATE REQUIRED FIELDS
    if (
      !question_id ||
      typeof correct !== 'boolean' ||
      typeof time_spent !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: question_id, correct, time_spent' },
        { status: 400 }
      );
    }

    // ✅ INSERT ANALYTICS WITH VERIFIED USER_ID FROM SESSION
    const { data, error } = await supabaseAdmin
      .from('analytics')
      .insert({
        question_id,
        user_id: user.id, // ✅ TRUSTED FROM VERIFIED SESSION
        correct,
        time_spent,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      data,
      logged_for: user.id 
    });

  } catch (error: any) {
    console.error('🐞 Error saving analytics:', error);
    return NextResponse.json(
      { error: 'Failed to save analytics' },
      { status: 500 }
    );
  }
}

// ✅ GET HANDLER (for admin/debug use - remains unchanged)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const questionId = searchParams.get('question_id');

    let query = supabaseAdmin.from('analytics').select(`
      *,
      questions (question_text, question_type),
      profiles (username)
    `);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (questionId) {
      query = query.eq('question_id', questionId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}