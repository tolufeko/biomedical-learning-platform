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

    // ── By Quiz ───────────────────────────────────────────────────────────
    const quizMap: Record<string, { title: string; total: number; correct: number; incorrect: number; time: number }> = {};
    records.forEach(r => {
      const qa = r.question_assignments as any;
      const quizId = qa?.quiz_id;
      const title = qa?.quiz?.title || 'Unknown';
      if (!quizId) return;
      if (!quizMap[quizId]) quizMap[quizId] = { title, total: 0, correct: 0, incorrect: 0, time: 0 };
      quizMap[quizId].total++;
      if (r.correct) quizMap[quizId].correct++;
      else quizMap[quizId].incorrect++;
      quizMap[quizId].time += r.time_spent || 0;
    });

    const by_quiz = Object.entries(quizMap).map(([quiz_id, s]) => ({
      quiz_id,
      title: s.title,
      average_score: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
      error_rate: s.total > 0 ? parseFloat(((s.incorrect / s.total) * 100).toFixed(1)) : 0,
      correct: s.correct,
      incorrect: s.incorrect,
      total_attempts: s.total,
      avg_time: s.total > 0 ? Math.round(s.time / s.total) : 0,
    }));

    // ── By Module ─────────────────────────────────────────────────────────
    const moduleMap: Record<string, { total: number; correct: number; incorrect: number; time: number }> = {};
    records.forEach(r => {
      const qa = r.question_assignments as any;
      const module = qa?.quiz?.module || 'Unknown';
      if (!moduleMap[module]) moduleMap[module] = { total: 0, correct: 0, incorrect: 0, time: 0 };
      moduleMap[module].total++;
      if (r.correct) moduleMap[module].correct++;
      else moduleMap[module].incorrect++;
      moduleMap[module].time += r.time_spent ?? 0;
    });

    const by_module = Object.entries(moduleMap).map(([module, s]) => ({
      module,
      average_score: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
      error_rate: s.total > 0 ? parseFloat(((s.incorrect / s.total) * 100).toFixed(1)) : 0,
      correct: s.correct,
      incorrect: s.incorrect,
      total_attempts: s.total,
      avg_time: s.total > 0 ? Math.round(s.time / s.total) : 0,
    }));

    // ── By Topic ──────────────────────────────────────────────────────────
    const topicMap: Record<string, { total: number; correct: number; incorrect: number; time: number }> = {};
    records.forEach(r => {
      const qa = r.question_assignments as any;
      const topic = qa?.questions?.question_topic || 'Uncategorised';
      if (!topicMap[topic]) topicMap[topic] = { total: 0, correct: 0, incorrect: 0, time: 0 };
      topicMap[topic].total++;
      if (r.correct) topicMap[topic].correct++;
      else topicMap[topic].incorrect++;
      topicMap[topic].time += r.time_spent ?? 0;
    });

    const by_topic = Object.entries(topicMap).map(([topic, s]) => ({
      topic,
      average_score: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
      error_rate: s.total > 0 ? parseFloat(((s.incorrect / s.total) * 100).toFixed(1)) : 0,
      correct: s.correct,
      incorrect: s.incorrect,
      total_attempts: s.total,
      avg_time: s.total > 0 ? Math.round(s.time / s.total) : 0,
    }));

    // ── By Question ───────────────────────────────────────────────────────
    const questionMap: Record<string, { text: string; total: number; correct: number; incorrect: number; time: number }> = {};
    records.forEach(r => {
      const qa = r.question_assignments as any;
      const qId = qa?.questions?.id;
      const text = qa?.questions?.question_text || 'Unknown';
      if (!qId) return;
      if (!questionMap[qId]) questionMap[qId] = { text, total: 0, correct: 0, incorrect: 0, time: 0 };
      questionMap[qId].total++;
      if (r.correct) questionMap[qId].correct++;
      else questionMap[qId].incorrect++;
      questionMap[qId].time += r.time_spent ?? 0;
    });

    const by_question = Object.entries(questionMap).map(([question_id, s]) => ({
      question_id,
      text: s.text,
      average_score: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
      error_rate: s.total > 0 ? parseFloat(((s.incorrect / s.total) * 100).toFixed(1)) : 0,
      correct: s.correct,
      incorrect: s.incorrect,
      total_attempts: s.total,
      avg_time: s.total > 0 ? Math.round(s.time / s.total) : 0,
    }));

    // ── By Student (privileged only) ──────────────────────────────────────
    let by_student: any[] = [];
    if (isPrivileged) {
      const studentMap: Record<string, { total: number; correct: number; incorrect: number; time: number }> = {};
      records.forEach(r => {
        if (!studentMap[r.user_id]) studentMap[r.user_id] = { total: 0, correct: 0, incorrect: 0, time: 0 };
        studentMap[r.user_id].total++;
        if (r.correct) studentMap[r.user_id].correct++;
        else studentMap[r.user_id].incorrect++;
        studentMap[r.user_id].time += r.time_spent ?? 0;
      });

      const userIds = Object.keys(studentMap);
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const usernameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.username]));

      by_student = Object.entries(studentMap).map(([user_id, s]) => ({
        user_id,
        username: usernameMap[user_id] || user_id,
        average_score: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
        error_rate: s.total > 0 ? parseFloat(((s.incorrect / s.total) * 100).toFixed(1)) : 0,
        correct: s.correct,
        incorrect: s.incorrect,
        total_attempts: s.total,
        avg_time: s.total > 0 ? Math.round(s.time / s.total) : 0,
      }));
    }

    return NextResponse.json({ by_quiz, by_module, by_topic, by_question, by_student });

  } catch (error: any) {
    console.error('Quiz statistics API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}