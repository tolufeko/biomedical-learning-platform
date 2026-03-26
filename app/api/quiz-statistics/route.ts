// app/api/quiz-statistics/route.ts
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { getUserRole } from '@/lib/auth/permissions';
import { supabaseServer } from '@/lib/supabase/supabaseServer';

const supabaseAdmin = supabaseServer();

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await getUserRole(user.id);
    const isPrivileged = role === 'teacher' || role === 'admin';

    let query = supabaseAdmin
      .from('analytics')
      .select(`
        user_id, correct, time_spent,
        question_assignments (
          quiz_id, question_id,
          questions ( id, question_text, question_topic ),
          quiz: quiz_id ( title, module )
        )
      `);

    if (!isPrivileged) query = query.eq('user_id', user.id);

    const { data, error } = await query;
    if (error) throw error;

    const records = (data || []).filter(r => r.question_assignments);

    // Fetch usernames for privileged users
    let usernameMap: Record<string, string> = {};
    if (isPrivileged) {
      const userIds = [...new Set(records.map(r => r.user_id))];
      const { data: profiles } = await supabaseAdmin
        .from('profiles').select('id, username').in('id', userIds);
      usernameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.username]));
    }

    // Build enriched flat records
    const enriched = records.map(r => {
      const qa = r.question_assignments as any;
      return {
        user_id: r.user_id,
        username: usernameMap[r.user_id] || r.user_id,
        correct: r.correct,
        time_spent: r.time_spent ?? 0,
        quiz_id: qa?.quiz_id || null,
        quiz_title: qa?.quiz?.title || 'Unknown',
        module: qa?.quiz?.module || 'Unknown',
        question_id: qa?.questions?.id || null,
        question_text: qa?.questions?.question_text || 'Unknown',
        question_topic: qa?.questions?.question_topic || 'Uncategorised',
      };
    });

    return NextResponse.json({ records: enriched, is_privileged: isPrivileged });

  } catch (error: any) {
    console.error('Quiz statistics API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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