// lib/types/quiz.ts
export interface QuizQuestionShaped {
    type: string;
    question: string;
    options: string[];
    correctAnswer: any;
    image_url?: string;
    image_path?: string;
    question_topic?: string;
    question_feedback?: string;
  }
  
  export interface QuizQuestionRaw {
    id: string;
    question_type: string;
    question_text: string;
    options: string[];
    correct_answer: any;
    display_order: number;
    image_path?: string;
    image_url?: string;
    question_topic?: string;
    question_feedback?: string;
    question_assignment_id?: string;
  }