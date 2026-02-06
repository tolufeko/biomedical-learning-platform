import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Helper: Get user role
async function getUserRole(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data.role;
}

// ✅ Helper: Check if user can view TARGET USER'S data
async function canAccessUserData(
  viewerUserId: string, 
  targetUserId?: string | null
): Promise<{ allowed: boolean; reason?: string }> {
  // No target user = general stats (handled by query filtering later)
  if (!targetUserId) {
    return { allowed: true };
  }

  // User can always view their own data
  if (viewerUserId === targetUserId) {
    return { allowed: true };
  }

  // Get viewer's role
  const viewerRole = await getUserRole(viewerUserId);
  if (!viewerRole) {
    return { allowed: false, reason: 'Viewer role not found' };
  }

  // ✅ ADMINS AND TEACHERS CAN VIEW ANY USER'S DATA
  if (viewerRole === 'admin' || viewerRole === 'teacher') {
    return { allowed: true };
  }

  // ❌ STUDENTS CANNOT VIEW OTHER USERS' DATA
  if (viewerRole === 'student') {
    return { 
      allowed: false, 
      reason: 'Students can only view their own statistics' 
    };
  }

  return { allowed: false, reason: 'Unknown user role' };
}

// ✅ Helper: Check if user can access QUIZ stats endpoint
// (All authenticated users with valid roles can access the endpoint)
// Actual data visibility is controlled by user access checks + query filtering
async function canAccessQuizEndpoint(
  viewerUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const userRole = await getUserRole(viewerUserId);
  
  if (!userRole) {
    return { allowed: false, reason: 'User role not found' };
  }

  // ✅ ADMINS, TEACHERS, AND STUDENTS CAN ACCESS QUIZ STATS ENDPOINT
  if (['admin', 'teacher', 'student'].includes(userRole)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Insufficient permissions' };
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

    // Get current user's role for logging and enforcement
    const currentUserRole = await getUserRole(currentUser.id);

    // ✅ STEP 1: Verify access to QUIZ STATS ENDPOINT
    if (quizId) {
      const endpointAccess = await canAccessQuizEndpoint(currentUser.id);
      if (!endpointAccess.allowed) {
        return NextResponse.json(
          { error: 'Forbidden', reason: endpointAccess.reason },
          { status: 403 }
        );
      }
    }

    // ✅ STEP 2: Resolve username to user_id if needed
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
            average_score: 0,
            average_time_spent: 0,
            highest_error_question: null,
            total_attempts: 0,
            data_available: false
          });
        }
        throw profileError;
      }
      resolvedUserId = profileData.id;
    }

    // ✅ STEP 3: Verify access to TARGET USER'S DATA
    if (resolvedUserId) {
      const userAccess = await canAccessUserData(currentUser.id, resolvedUserId);
      if (!userAccess.allowed) {
        return NextResponse.json(
          { 
            error: 'Forbidden: You do not have permission to view this user\'s statistics',
            reason: userAccess.reason
          },
          { status: 403 }
        );
      }
    }

    // 🔑 CRITICAL: ENFORCE STUDENT SELF-FILTERING
    // If student makes request WITHOUT user filter, automatically filter to themselves
    if (currentUserRole === 'student' && !resolvedUserId) {
      resolvedUserId = currentUser.id;
    }

    // ✅ STEP 4: FETCH ANALYTICS DATA
    let analyticsData: any[] = [];

    if (quizId) {
      // Get assignment IDs for this quiz
      const { data: assignments, error: assignmentsError } = await supabaseAdmin
        .from('question_assignments')
        .select('id')
        .eq('quiz_id', quizId);

      if (assignmentsError) throw assignmentsError;

      if (assignments && assignments.length > 0) {
        const assignmentIds = assignments.map(a => a.id);
        
        let query = supabaseAdmin
          .from('analytics')
          .select(`
            *,
            question_assignments (
              id,
              quiz_id,
              question_id,
              display_order,
              questions (id, question_text, question_type)
            )
          `)
          .in('question_assignment_id', assignmentIds);

        // Apply user filter (enforced for students above)
        if (resolvedUserId) {
          query = query.eq('user_id', resolvedUserId);
        }

        const { data, error } = await query;
        if (error) throw error;
        analyticsData = data || [];
      }
    } else {
      // General stats (all quizzes)
      let query = supabaseAdmin
        .from('analytics')
        .select(`
          *,
          question_assignments (
            id,
            quiz_id,
            question_id,
            display_order,
            questions (id, question_text, question_type)
          )
        `);
      
      if (resolvedUserId) {
        query = query.eq('user_id', resolvedUserId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      analyticsData = data || [];
    }

    // Filter out records missing question context
    const filteredData = analyticsData.filter(record => 
      record.question_assignments?.questions?.question_text
    );

    if (filteredData.length === 0) {
      return NextResponse.json({
        average_score: 0,
        average_time_spent: 0,
        highest_error_question: null,
        total_attempts: 0,
        data_available: false
      });
    }

    // ✅ COMPUTE STATS (same as before)
    const questionTextMap: Record<string, string> = {};
    filteredData.forEach(record => {
      const qId = record.question_assignments?.question_id;
      const qText = record.question_assignments?.questions?.question_text;
      if (qId && qText && !questionTextMap[qId]) {
        questionTextMap[qId] = qText;
      }
    });

    const correctCount = filteredData.filter(r => r.correct).length;
    const averageScore = (correctCount / filteredData.length) * 100;
    const totalTime = filteredData.reduce((sum, r) => sum + (r.time_spent || 0), 0);
    const averageTime = totalTime / filteredData.length;

    const questionStats: Record<string, { total: number; incorrect: number }> = {};
    filteredData.forEach(record => {
      const qId = record.question_assignments?.question_id;
      if (!qId) return;
      
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
      total_attempts: filteredData.length,
      data_available: true
    });
  } catch (error: any) {
    console.error('🐞 Quiz stats API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch statistics',
        details: error.message 
      },
      { status: 500 }
    );
  }
}