// app/api/quizzes/[id]/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    // Fetch quiz details
    const { data: quiz, error: quizError } = await supabase
      .from("quiz")
      .select(`
        *,
        profiles (username, email)
      `)
      .eq("id", id)
      .single();

    if (quizError) {
      console.error('Quiz fetch error:', quizError);
      throw quizError;
    }
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Fetch questions via junction table
    const { data: assignments, error: assignError } = await supabase
      .from('question_assignments')
      .select(`
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

    if (assignError) {
      console.error('Assignments fetch error:', assignError);
      throw assignError;
    }

    const questions = assignments?.map(a => ({
      ...a.questions,
      display_order: a.display_order
    })) || [];

    // Generate signed URLs for hotspot images
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const questionsWithImages = await Promise.all(
      questions.map(async (q: any) => {
        if (q.question_type === 'hotspot' && q.image_path) {
          const { data: signedUrlData } = await supabaseAdmin.storage
            .from('quiz-images')
            .createSignedUrl(q.image_path, 3600);
          
          return {
            ...q,
            image_url: signedUrlData?.signedUrl || null
          };
        }
        return q;
      })
    );

    return NextResponse.json({
      ...quiz,
      questions: questionsWithImages
    });
  } catch (err: any) {
    console.error("GET /quizzes/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const { error } = await supabase.from("quiz").delete().eq("id", id);

    if (error) {
      console.error('Delete error:', error);
      throw error;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Quiz deleted successfully" 
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
    const body = await request.json();
    const { title, description, questions } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Update quiz metadata
    const { data: updatedQuiz, error: updateError } = await supabase
      .from('quiz')
      .update({
        title,
        description: description || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update quiz error:', updateError);
      throw updateError;
    }

    // If questions array is provided, update assignments
    if (Array.isArray(questions) && questions.length > 0) {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('question_assignments')
        .delete()
        .eq('quiz_id', id);

      if (deleteError) {
        console.error('Delete assignments error:', deleteError);
        throw deleteError;
      }

      // Create new assignments
      const assignmentData: any[] = [];
      
      for (let [index, q] of questions.entries()) {
        let questionId: string;
        
        // Reuse or create question
        const { data: existingQuestion } = await supabase
          .from('questions')
          .select('id')
          .eq('question_text', q.question)
          .eq('question_type', q.type)
          .single();

        if (existingQuestion) {
          questionId = existingQuestion.id;
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

          const { data: newQuestion } = await supabase
            .from('questions')
            .insert([{
              question_type: q.type,
              question_text: q.question,
              options: q.options || null,
              correct_answer: correctAnswer,
              image_path: q.image_path || null,
            }])
            .select('id')
            .single();

          questionId = newQuestion!.id;
        }

        assignmentData.push({
          quiz_id: id,
          question_id: questionId,
          display_order: index,
        });
      }

      const { error: insertError } = await supabase
        .from('question_assignments')
        .insert(assignmentData);

      if (insertError) {
        console.error('Insert assignments error:', insertError);
        throw insertError;
      }
    }

    // Fetch updated quiz with questions
    const { data: assignments } = await supabase
      .from('question_assignments')
      .select(`
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

    const quizWithQuestions = {
      ...updatedQuiz,
      questions: assignments?.map(a => ({
        ...a.questions,
        display_order: a.display_order
      })) || []
    };

    return NextResponse.json(quizWithQuestions);
  } catch (err: any) {
    console.error("PUT /quizzes/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}