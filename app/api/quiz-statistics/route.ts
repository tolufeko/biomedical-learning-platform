import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Helper: Check if user can view target user's data
async function canAccessUserData(viewerUserId: string, targetUserId?: string): Promise<boolean> {
  if (!targetUserId) return true; // No specific user = general stats allowed
  
  // 1. User can always view their own data
  if (viewerUserId === targetUserId) return true;
  
  // 2. Check if viewer is admin
  const profileResult = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', viewerUserId)
    .single();

  if (profileResult.error || !profileResult.data) return false;
  if (profileResult.data.role === 'admin') return true;
  
  // 3. Check if viewer is teacher (can view all student data)
  if (profileResult.data.role === 'teacher') {
    // Verify target user is a student (not another teacher/admin)
    const targetProfileResult = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', targetUserId)
      .single();
    
    if (targetProfileResult.error || !targetProfileResult.data) return false;
    return targetProfileResult.data.role === 'student';
  }
  
  return false;
}

// ✅ Helper: Check if user can view quiz stats
async function canAccessQuizData(viewerUserId: string, quizId: string): Promise<boolean> {
  // 1. Check if viewer is admin
  const profileResult = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', viewerUserId)
    .single();

  if (profileResult.error || !profileResult.data) return false;
  if (profileResult.data.role === 'admin') return true;
  
  // 2. Check if viewer is teacher AND owns the quiz
  if (profileResult.data.role === 'teacher') {
    const quizResult = await supabaseAdmin
      .from('quiz')
      .select('user_id')
      .eq('id', quizId)
      .single();
    
    if (quizResult.error || !quizResult.data) return false;
    return quizResult.data.user_id === viewerUserId;
  }
  
  // 3. Students can view quiz stats for quizzes they've taken
  // (This is already handled by the user_id filter in main logic)
  return true;
}

export async function GET(request: Request) {
  try {
    // ✅ VERIFY AUTHENTICATION
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    
    const userData = await supabase.auth.getUser();
    const currentUser = userData.data?.user;

    if (userData.error || !currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const username = searchParams.get('username');
    const quizId = searchParams.get('quiz_id');

    // ✅ VERIFY USER ACCESS PERMISSIONS
    if (userId || username) {
      // Resolve username to user_id if needed
      let targetUserId = userId;
      if (username) {
        const profileResult = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('username', username)
          .single();

        if (profileResult.error) {
          if (profileResult.error.code === 'PGRST116') {
            return NextResponse.json({
              average_score: 0,
              average_time_spent: 0,
              highest_error_question: null,
              total_attempts: 0,
              data_available: false
            });
          }
          throw profileResult.error;
        }
        targetUserId = profileResult.data.id;
      }

      // Check if current user can access this user's data
      const hasAccess = await canAccessUserData(currentUser.id, targetUserId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view this data' },
          { status: 403 }
        );
      }
    }

    // ✅ VERIFY QUIZ ACCESS PERMISSIONS
    if (quizId) {
      const hasAccess = await canAccessQuizData(currentUser.id, quizId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view this quiz statistics' },
          { status: 403 }
        );
      }
    }

    // Resolve username → user_id if needed (for query logic)
    let resolvedUserId = userId;
    if (username) {
      const profileResult = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();
      
      resolvedUserId = profileResult.data.id;
    }

    let analyticsData: any[] = [];

    if (quizId) {
      // Get all question_ids for this quiz via junction table
      const assignmentsResult = await supabaseAdmin
        .from('question_assignments')
        .select('question_id')
        .eq('quiz_id', quizId);

      if (assignmentsResult.error) throw assignmentsResult.error;

      if (assignmentsResult.data.length === 0) {
        analyticsData = [];
      } else {
        const questionIds = assignmentsResult.data.map(a => a.question_id);
        let query = supabaseAdmin
          .from('analytics')
          .select('*')
          .in('question_id', questionIds);

        if (resolvedUserId) {
          query = query.eq('user_id', resolvedUserId);
        }

        const queryResult = await query;
        if (queryResult.error) throw queryResult.error;
        analyticsData = queryResult.data;
      }
    } else {
      // General or per-user stats (no quiz filter)
      let query = supabaseAdmin.from('analytics').select('*');
      if (resolvedUserId) {
        query = query.eq('user_id', resolvedUserId);
      }
      const queryResult = await query;
      if (queryResult.error) throw queryResult.error;
      analyticsData = queryResult.data;
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
      const questionsResult = await supabaseAdmin
        .from('questions')
        .select('id, question_text')
        .in('id', questionIds);
      
      if (questionsResult.data) {
        for (const q of questionsResult.data) {
          questionTextMap[q.id] = q.question_text;
        }
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
  } catch (error: any) {
    console.error('🐞 Quiz stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}