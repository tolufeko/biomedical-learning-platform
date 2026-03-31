// lib/utility/transformQuiz.ts
import type { QuizQuestionRaw, QuizQuestionShaped } from '@/lib/types/quiz';

export function shapeQuestion(q: QuizQuestionRaw): QuizQuestionShaped {
  return {
    type: q.question_type,
    question: q.question_text,
    options: q.options || [],
    correctAnswer: q.correct_answer,
    image_url: q.image_url || (q.question_type === 'hotspot' ? '' : undefined),
    image_path: q.image_path || (q.question_type === 'hotspot' ? '' : undefined),
    question_topic: q.question_topic || undefined,
    question_feedback: q.question_feedback || undefined,
  };
}