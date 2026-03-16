//app/api/quiz-analytics/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

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
    
    const userData = await supabase.auth.getUser();
    const user = userData.data?.user;

    if (userData.error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }

    // ✅ PARSE REQUEST BODY (NOW INCLUDES question_assignment_id)
    const { question_assignment_id, correct, time_spent } = await request.json();

    // ✅ VALIDATE REQUIRED FIELDS
    if (
      !question_assignment_id ||
      typeof correct !== 'boolean' ||
      typeof time_spent !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: question_assignment_id, correct, time_spent' },
        { status: 400 }
      );
    }

    // ✅ INSERT ANALYTICS WITH QUESTION_ASSIGNMENT_ID
    const { data, error } = await supabaseAdmin
      .from('analytics')
      .insert({
        question_assignment_id, // ✅ NEW: Links to specific quiz+question context
        user_id: user.id,
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
    const questionAssignmentId = searchParams.get('question_assignment_id');

    let query = supabaseAdmin.from('analytics').select(`
      *,
      question_assignments (
        quiz_id,
        questions (question_text, question_type, topic)
      ),
      profiles (username)
    `);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (questionAssignmentId) {
      query = query.eq('question_assignment_id', questionAssignmentId);
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