// app/api/quiz-statistics/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const username = searchParams.get('username');
    const quizId = searchParams.get('quiz_id');

    // Resolve username → user_id if needed
    let resolvedUserId = userId;
    if (username) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({
            average_score: 0,
            average_time_spent: 0,
            highest_error_question: null,
            total_attempts: 0,
            data_available: false
          });
        }
        throw error;
      }
      resolvedUserId = profile.id;
    }

    let analyticsData: any[] = [];

    if (quizId) {
      // Get all question_ids for this quiz via junction table
      const { data: assignments, error: assignError } = await supabase
        .from('question_assignments')
        .select('question_id')
        .eq('quiz_id', quizId);

      if (assignError) throw assignError;

      if (assignments.length === 0) {
        analyticsData = [];
      } else {
        const questionIds = assignments.map(a => a.question_id);
        let query = supabase
          .from('analytics')
          .select('*')
          .in('question_id', questionIds);

        if (resolvedUserId) {
          query = query.eq('user_id', resolvedUserId);
        }

        const { data, error } = await query;
        if (error) throw error;
        analyticsData = data;
      }
    } else {
      // General or per-user stats (no quiz filter)
      let query = supabase.from('analytics').select('*');
      if (resolvedUserId) {
        query = query.eq('user_id', resolvedUserId);
      }
      const { data, error } = await query;
      if (error) throw error;
      analyticsData = data;
    }

    if (analyticsData.length === 0) {
      return NextResponse.json({
        average_score: 0,
        average_time_spent: 0,
        highest_error_question: null,
        total_attempts: 0,
        data_available: false
      });
    }

    // Build question text map
    const questionTextMap: Record<string, string> = {};
    const questionIds = [...new Set(analyticsData.map(a => a.question_id))];
    
    if (questionIds.length > 0) {
      const { data: questions } = await supabase
        .from('questions')
        .select('id, question_text')
        .in('id', questionIds);
      
      for (const q of questions) {
        questionTextMap[q.id] = q.question_text;
      }
    }

    // === Compute stats ===
    const correctCount = analyticsData.filter(r => r.correct).length;
    const averageScore = (correctCount / analyticsData.length) * 100;
    const totalTime = analyticsData.reduce((sum, r) => sum + (r.time_spent || 0), 0);
    const averageTime = totalTime / analyticsData.length;

    const questionStats: Record<string, { total: number; incorrect: number }> = {};
    analyticsData.forEach(record => {
      const qId = String(record.question_id);
      if (!questionStats[qId]) {
        questionStats[qId] = { total: 0, incorrect: 0 };
      }
      questionStats[qId].total++;
      if (!record.correct) {
        questionStats[qId].incorrect++;
      }
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
          incorrect_attempts: stats.incorrect
        };
      }
    }

    return NextResponse.json({
      average_score: parseFloat(averageScore.toFixed(1)),
      average_time_spent: Math.round(averageTime),
      highest_error_question: highestErrorQuestion,
      total_attempts: analyticsData.length,
      data_available: true
    });
  } catch (error) {
    console.error('🐞 Quiz stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}