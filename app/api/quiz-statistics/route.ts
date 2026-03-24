// app/api/quiz-statistics/route.ts
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { getUserRole, canAccessUserData } from '@/lib/auth/permissions';
import { supabaseServer } from '@/lib/supabase/supabaseServer';

const supabaseAdmin = supabaseServer();

export async function GET(request: Request) {
  try {
    const currentUser = await getServerUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const username = searchParams.get('username');
    const quizId = searchParams.get('quiz_id');
    const moduleId = searchParams.get('module');

    const currentUserRole = await getUserRole(currentUser.id);

    // Resolve username to user_id if needed
    let resolvedUserId = userId;
    if (username) {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          return NextResponse.json({
            average_score: 0, average_time_spent: 0,
            highest_error_question: null, total_attempts: 0, data_available: false
          });
        }
        throw profileError;
      }
      resolvedUserId = profileData.id;
    }

    // Verify access to target user's data
    if (resolvedUserId) {
      const userAccess = await canAccessUserData(currentUser.id, resolvedUserId);
      if (!userAccess.allowed) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view this user\'s statistics', reason: userAccess.reason },
          { status: 403 }
        );
      }
    }

    // Students always scoped to themselves
    if (['student', 'guest'].includes(currentUserRole ?? '') && !resolvedUserId) {
      resolvedUserId = currentUser.id;
    }

    // Fetch analytics data
    let analyticsData: any[] = [];
    const analyticsSelect = `
      *,
      question_assignments (
        id, quiz_id, question_id, display_order,
        questions (id, question_text, question_type, question_topic, question_feedback)
      )
    `;

    if (quizId) {
      const { data: assignments, error: assignmentsError } = await supabaseAdmin
        .from('question_assignments')
        .select('id')
        .eq('quiz_id', quizId);

      if (assignmentsError) throw assignmentsError;

      if (assignments && assignments.length > 0) {
        let query = supabaseAdmin
          .from('analytics')
          .select(analyticsSelect)
          .in('question_assignment_id', assignments.map(a => a.id));

        if (resolvedUserId) query = query.eq('user_id', resolvedUserId);

        const { data, error } = await query;
        if (error) throw error;
        analyticsData = data || [];
      }
    } else if (moduleId) {
      const { data: moduleQuizzes, error: moduleError } = await supabaseAdmin
        .from('quiz')
        .select('id')
        .eq('module', moduleId);
    
      if (moduleError) throw moduleError;
    
      if (!moduleQuizzes || moduleQuizzes.length === 0) {
        return NextResponse.json({
          average_score: 0, average_time_spent: 0,
          highest_error_question: null, total_attempts: 0, data_available: false
        });
      }
    
      const { data: assignments, error: assignmentsError } = await supabaseAdmin
        .from('question_assignments')
        .select('id')
        .in('quiz_id', moduleQuizzes.map(q => q.id));
    
      if (assignmentsError) throw assignmentsError;
    
      if (!assignments || assignments.length === 0) {
        return NextResponse.json({
          average_score: 0, average_time_spent: 0,
          highest_error_question: null, total_attempts: 0, data_available: false
        });
      }
    
      let query = supabaseAdmin
        .from('analytics')
        .select(analyticsSelect)
        .in('question_assignment_id', assignments.map(a => a.id));
    
      if (resolvedUserId) query = query.eq('user_id', resolvedUserId);
    
      const { data, error } = await query;
      if (error) throw error;
      analyticsData = data || [];
    } else {
      let query = supabaseAdmin.from('analytics').select(analyticsSelect);
      if (resolvedUserId) query = query.eq('user_id', resolvedUserId);

      const { data, error } = await query;
      if (error) throw error;
      analyticsData = data || [];
    }

    const filteredData = analyticsData.filter(r => r.question_assignments?.questions?.question_text);

    if (filteredData.length === 0) {
      return NextResponse.json({
        average_score: 0, average_time_spent: 0,
        highest_error_question: null, total_attempts: 0, data_available: false
      });
    }

    // Compute stats
    const questionTextMap: Record<string, string> = {};
    filteredData.forEach(record => {
      const qId = record.question_assignments?.question_id;
      const qText = record.question_assignments?.questions?.question_text;
      if (qId && qText && !questionTextMap[qId]) questionTextMap[qId] = qText;
    });

    const correctCount = filteredData.filter(r => r.correct).length;
    const averageScore = (correctCount / filteredData.length) * 100;
    const averageTime = filteredData.reduce((sum, r) => sum + (r.time_spent || 0), 0) / filteredData.length;

    const questionStats: Record<string, { total: number; incorrect: number }> = {};
    const topicStats: Record<string, { total: number; incorrect: number }> = {};

    filteredData.forEach(record => {
      const qId = record.question_assignments?.question_id;
      const topic = record.question_assignments?.questions?.topic || 'Uncategorised';
      if (!qId) return;

      if (!questionStats[qId]) questionStats[qId] = { total: 0, incorrect: 0 };
      questionStats[qId].total++;
      if (!record.correct) questionStats[qId].incorrect++;

      if (!topicStats[topic]) topicStats[topic] = { total: 0, incorrect: 0 };
      topicStats[topic].total++;
      if (!record.correct) topicStats[topic].incorrect++;
    });

    let highestErrorQuestion = null;
    let highestErrorRate = -1;

    for (const [questionId, stats] of Object.entries(questionStats)) {
      const errorRate = (stats.incorrect / stats.total) * 100;
      if (errorRate > highestErrorRate) {
        highestErrorRate = errorRate;
        highestErrorQuestion = {
          question_id: questionId,
          question_text: questionTextMap[questionId] || 'Unknown question',
          error_rate: parseFloat(errorRate.toFixed(1)),
          total_attempts: stats.total,
          incorrect_attempts: stats.incorrect,
        };
      }
    }

    return NextResponse.json({
      average_score: parseFloat(averageScore.toFixed(1)),
      average_time_spent: Math.round(averageTime),
      highest_error_question: highestErrorQuestion,
      total_attempts: filteredData.length,
      data_available: true,
      topic_breakdown: Object.entries(topicStats).map(([topic, stats]) => ({
        topic,
        total: stats.total,
        correct: stats.total - stats.incorrect,
        incorrect: stats.incorrect,
        error_rate: parseFloat(((stats.incorrect / stats.total) * 100).toFixed(1)),
      })),
    });

  } catch (error: any) {
    console.error('🐞 Quiz stats API error:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics', details: error.message }, { status: 500 });
  }
}