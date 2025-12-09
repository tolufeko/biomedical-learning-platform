import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const quizId = searchParams.get('quiz_id');

    // Average score (overall or per student)
    let scoreQuery = supabase
      .from('quiz_analytics')
      .select('correct');
    
    if (userId) scoreQuery = scoreQuery.eq('user_id', userId);

    const { data: scoreData, error: scoreError } = await scoreQuery;
    if (scoreError) throw scoreError;

    const averageScore = scoreData.length > 0
      ? (scoreData.filter(r => r.correct).length / scoreData.length) * 100
      : 0;

    // Average time spent
    let timeQuery = supabase
      .from('quiz_analytics')
      .select('time_spent');
    
    if (userId) timeQuery = timeQuery.eq('user_id', userId);

    const { data: timeData, error: timeError } = await timeQuery;
    if (timeError) throw timeError;

    const averageTime = timeData.length > 0
      ? timeData.reduce((sum, r) => sum + r.time_spent, 0) / timeData.length
      : 0;

    // Question with highest error rate
    let errorQuery = supabase
      .from('quiz_analytics')
      .select('question_id, correct');
    
    if (userId) errorQuery = errorQuery.eq('user_id', userId);

    const { data: errorData, error: errorError } = await errorQuery;
    if (errorError) throw errorError;

    const questionStats: { [key: string]: { total: number; incorrect: number } } = {};
    
    errorData.forEach(record => {
      if (!questionStats[record.question_id]) {
        questionStats[record.question_id] = { total: 0, incorrect: 0 };
      }
      questionStats[record.question_id].total++;
      if (!record.correct) {
        questionStats[record.question_id].incorrect++;
      }
    });

    let highestErrorQuestion = null;
    let highestErrorRate = 0;

    Object.entries(questionStats).forEach(([questionId, stats]) => {
      const errorRate = (stats.incorrect / stats.total) * 100;
      if (errorRate > highestErrorRate) {
        highestErrorRate = errorRate;
        highestErrorQuestion = {
          question_id: questionId,
          error_rate: errorRate,
          total_attempts: stats.total,
          incorrect_attempts: stats.incorrect
        };
      }
    });

    return NextResponse.json({
      average_score: Math.round(averageScore * 10) / 10,
      average_time_spent: Math.round(averageTime),
      highest_error_question: highestErrorQuestion,
      total_attempts: scoreData.length
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}