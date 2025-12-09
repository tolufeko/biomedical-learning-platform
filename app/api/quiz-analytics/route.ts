// app/api/quiz-analytics/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question_id, user_id, correct, time_spent } = body;

    // Validate all required fields, including user_id
    if (
      !question_id ||
      !user_id || // ✅ now required
      typeof correct !== 'boolean' ||
      typeof time_spent !== 'number'
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: question_id, user_id, correct, time_spent',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('quiz_analytics')
      .insert({
        question_id,
        user_id, // ✅ use the one sent from client
        correct,
        time_spent,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error saving analytics:', error);
    return NextResponse.json(
      { error: 'Failed to save analytics' },
      { status: 500 }
    );
  }
}

// GET stays mostly the same
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    let query = supabase.from('quiz_analytics').select('*');

    if (userId) {
      query = query.eq('user_id', userId);
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