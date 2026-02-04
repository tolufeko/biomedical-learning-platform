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

    if (
      !question_id ||
      !user_id ||
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
      .from('analytics')
      .insert({
        question_id,
        user_id,
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const questionId = searchParams.get('question_id');

    let query = supabase.from('analytics').select(`
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