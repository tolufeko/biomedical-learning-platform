import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Helper: Verify user owns quiz (or is admin)
async function verifyQuizOwnership(quizId: string, userId: string): Promise<boolean> {
  // 1. Get quiz owner
  const quizResult = await supabaseAdmin
    .from('quiz')
    .select('user_id')
    .eq('id', quizId)
    .single();

  if (quizResult.error || !quizResult.data) return false;
  
  // 2. If user owns quiz → allow
  if (quizResult.data.user_id === userId) return true;
  
  // 3. Otherwise check if user is teacher/admin
  const profileResult = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileResult.error || !profileResult.data) return false;
  return (profileResult.data.role === 'teacher' || profileResult.data.role === 'admin');
}

// Helper: Extract unique image paths from questions array
function extractImagePaths(questions: any[]): string[] {
  if (!Array.isArray(questions)) return [];
  
  return Array.from(
    new Set(
      questions
        .map(q => 
          q.image_path ||          // Standard field
          q.filePath ||            // Alternate field
          (q.image_url?.includes('supabase.co') ? null : null) // Skip signed URLs
        )
        .filter(Boolean) as string[]
    )
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const quizResult = await supabaseAdmin
      .from("quiz")
      .select(`
        *,
        profiles (username, email, role)
      `)
      .eq("id", id)
      .single();

    if (quizResult.error) {
      console.error('Quiz fetch error:', quizResult.error);
      throw quizResult.error;
    }
    if (!quizResult.data) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const assignmentsResult = await supabaseAdmin
      .from('question_assignments')
      .select(`
        id,
        display_order,
        questions (
          id,
          question_type,
          question_text,
          options,
          correct_answer,
          image_path,
          topic,
          creator_id
        )
      `)
      .eq('quiz_id', id)
      .order('display_order', { ascending: true });

    if (assignmentsResult.error) {
      console.error('Assignments fetch error:', assignmentsResult.error);
      throw assignmentsResult.error;
    }

    const questions = assignmentsResult.data?.map(a => ({
      ...a.questions,
      display_order: a.display_order,
      question_assignment_id: a.id
    })) || [];

    const questionsWithImages = await Promise.all(
      questions.map(async (q: any) => {
        if (q.question_type === 'hotspot' && q.image_path) {
          const signedUrlResult = await supabaseAdmin.storage
            .from('quiz-images')
            .createSignedUrl(q.image_path, 3600);
          
          return {
            ...q,
            image_url: signedUrlResult.data?.signedUrl || null
          };
        }
        return q;
      })
    );

    return NextResponse.json({
      ...quizResult.data,
      questions: questionsWithImages
    });
  } catch (err: any) {
    console.error("GET /quizzes/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ✅ FIXED DELETE HANDLER
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    // ✅ VERIFY AUTHENTICATION
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    
    const userData = await supabase.auth.getUser();
    const user = userData.data?.user;

    if (userData.error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }

    // ✅ VERIFY OWNERSHIP
    const ownsQuiz = await verifyQuizOwnership(id, user.id);
    if (!ownsQuiz) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this quiz' },
        { status: 403 }
      );
    }

    // 🔑 STEP 1: FETCH QUESTION ASSIGNMENTS TO GET IMAGE PATHS (BEFORE DELETION)
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('question_assignments')
      .select(`
        id,
        display_order,
        questions (
          id,
          image_path
        )
      `)
      .eq('quiz_id', id)
      .order('display_order', { ascending: true });

    if (assignmentsError) {
      console.error('Failed to fetch assignments:', assignmentsError);
    }

    // 🔑 STEP 2: EXTRACT IMAGE PATHS FROM QUESTIONS
    const questions = assignments?.map(a => a.questions) || [];
    const imagePaths = extractImagePaths(questions);
    const deletedPaths: string[] = [];
    const failedPaths: { path: string; error: string }[] = [];

    // 🔑 STEP 3: DELETE IMAGES FROM STORAGE
    if (imagePaths.length > 0) {
      console.log(`🧹 Cleaning up ${imagePaths.length} image(s) for quiz ${id}`);
      
      await Promise.allSettled(
        imagePaths.map(async (path) => {
          try {
            const { error: deleteError } = await supabaseAdmin.storage
              .from('quiz-images')
              .remove([path]);
            
            if (deleteError) {
              console.error(`Failed to delete image ${path}:`, deleteError.message);
              failedPaths.push({ path, error: deleteError.message });
            } else {
              deletedPaths.push(path);
              console.log(`✅ Deleted image: ${path}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`Exception deleting ${path}:`, msg);
            failedPaths.push({ path, error: msg });
          }
        })
      );
    }

    // 🔑 STEP 4: DELETE QUIZ FROM DATABASE (assignments auto-delete via CASCADE)
    const { error: deleteError } = await supabaseAdmin
      .from('quiz')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Database delete failed:', deleteError);
      console.warn('⚠️ WARNING: Images were deleted but quiz deletion failed');
      return NextResponse.json(
        { 
          error: 'Failed to delete quiz after image cleanup',
          deletedImages: deletedPaths,
          failedImages: failedPaths
        },
        { status: 500 }
      );
    }

    // ✅ SUCCESS RESPONSE WITH CLEANUP REPORT
    return NextResponse.json({ 
      success: true,
      message: "Quiz deleted successfully",
      cleanup: {
        totalImages: imagePaths.length,
        deleted: deletedPaths.length,
        failed: failedPaths.length,
        failedDetails: failedPaths
      }
    });
  } catch (err: any) {
    console.error("DELETE /quizzes/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // ✅ VERIFY AUTHENTICATION
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    
    const userData = await supabase.auth.getUser();
    const user = userData.data?.user;

    if (userData.error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Login required' },
        { status: 401 }
      );
    }

    // ✅ VERIFY OWNERSHIP (or admin)
    const ownsQuiz = await verifyQuizOwnership(id, user.id);
    if (!ownsQuiz) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this quiz' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, questions } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Update quiz metadata
    const updateResult = await supabaseAdmin
      .from('quiz')
      .update({
        title,
        description: description || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateResult.error) {
      console.error('Update quiz error:', updateResult.error);
      throw updateResult.error;
    }

    // If questions array is provided, update assignments
    if (Array.isArray(questions) && questions.length > 0) {
      // Delete existing assignments
      const deleteAssignmentsResult = await supabaseAdmin
        .from('question_assignments')
        .delete()
        .eq('quiz_id', id);

      if (deleteAssignmentsResult.error) {
        console.error('Delete assignments error:', deleteAssignmentsResult.error);
        throw deleteAssignmentsResult.error;
      }

      // Create new assignments
      const assignmentData: any[] = [];
      
      for (let [index, q] of questions.entries()) {
        let questionId: string;
        
        // Reuse or create question
        const existingQuestionResult = await supabaseAdmin
          .from('questions')
          .select('id')
          .eq('question_text', q.question)
          .eq('question_type', q.type)
          .single();

        if (existingQuestionResult.data) {
          questionId = existingQuestionResult.data.id;
        } else {
          let correctAnswer = q.correctAnswer;
          
          if (q.type === 'text') {
            correctAnswer = typeof correctAnswer === 'string' 
              ? correctAnswer 
              : String(correctAnswer);
          } else if (['multiple-choice', 'checkbox', 'hotspot'].includes(q.type)) {
            if (!Array.isArray(correctAnswer)) {
              correctAnswer = [correctAnswer];
            }
          }

          const newQuestionResult = await supabaseAdmin
            .from('questions')
            .insert([{
              question_type: q.type,
              question_text: q.question,
              options: q.options || null,
              correct_answer: correctAnswer,
              image_path: q.image_path || null,
              topic: q.topic || null,
              creator_id: user.id,
            }])
            .select('id')
            .single();

          if (newQuestionResult.error) throw newQuestionResult.error;
          questionId = newQuestionResult.data!.id;
        }

        assignmentData.push({
          quiz_id: id,
          question_id: questionId,
          display_order: index,
        });
      }

      const insertAssignmentsResult = await supabaseAdmin
        .from('question_assignments')
        .insert(assignmentData);

      if (insertAssignmentsResult.error) {
        console.error('Insert assignments error:', insertAssignmentsResult.error);
        throw insertAssignmentsResult.error;
      }
    }

    // Fetch updated quiz with questions (include assignment ID)
    const assignmentsResult = await supabaseAdmin
      .from('question_assignments')
      .select(`
        id,
        display_order,
        questions (
          id,
          question_type,
          question_text,
          options,
          correct_answer,
          image_path
        )
      `)
      .eq('quiz_id', id)
      .order('display_order', { ascending: true });

    if (assignmentsResult.error) throw assignmentsResult.error;

    // Include question_assignment_id in response
    const quizWithQuestions = {
      ...updateResult.data,
      questions: assignmentsResult.data?.map(a => ({
        ...a.questions,
        display_order: a.display_order,
        question_assignment_id: a.id
      })) || []
    };

    return NextResponse.json(quizWithQuestions);
  } catch (err: any) {
    console.error("PUT /quizzes/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}