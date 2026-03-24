// app/api/quiz-analytics/route.ts
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { getUserRole, canAccessUserData } from '@/lib/auth/permissions';
import { supabaseServer } from '@/lib/supabase/supabaseServer';

const supabaseAdmin = supabaseServer();

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const { question_assignment_id, correct, time_spent } = await request.json();

    if (!question_assignment_id || typeof correct !== 'boolean' || typeof time_spent !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: question_assignment_id, correct, time_spent' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('analytics')
      .insert({ question_assignment_id, user_id: user.id, correct, time_spent })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data, logged_for: user.id });

  } catch (error: any) {
    console.error('🐞 Error saving analytics:', error);
    return NextResponse.json({ error: 'Failed to save analytics' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const questionAssignmentId = searchParams.get('question_assignment_id');
    const requestedUserId = searchParams.get('user_id');

    const role = await getUserRole(user.id);
    const isPrivileged = role === 'teacher' || role === 'admin';
    const targetUserId = isPrivileged && requestedUserId ? requestedUserId : user.id;

    if (requestedUserId) {
      const access = await canAccessUserData(user.id, requestedUserId);
      if (!access.allowed) {
        return NextResponse.json({ error: 'Forbidden', reason: access.reason }, { status: 403 });
      }
    }

    let query = supabaseAdmin.from('analytics').select(`
      *,
      question_assignments (
        quiz_id,
        questions (question_text, question_type, question_topic, question_feedback)
      ),
      profiles (username)
    `).eq('user_id', targetUserId);

    if (questionAssignmentId) query = query.eq('question_assignment_id', questionAssignmentId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}