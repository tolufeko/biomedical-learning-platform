// lib/types/quiz.ts
import { HotspotAnswer } from "./answers";
import { GraphFeatureData } from "./graph";

export interface QuizData {
  id: string;
  title: string;
  description: string;
  module: string;
  questions: any[];
  created_at?: string;
  updated_at: string;
  user_id: string;
}

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
  correct_answer: QuestionCorrectAnswer;
  display_order: number;
  image_path?: string;
  image_url?: string;
  question_topic?: string;
  question_feedback?: string;
  question_assignment_id?: string;
}

export interface BaseQuizQuestion {
  id: string;
  question_type: QuestionType;
  question_text: string;
  question_feedback: string;
  topic?: string; 
  image_path?: string;
  image_url?: string;
  question_assignment_id: string;
}

export interface QuestionInput {
  type: string;
  question: string;
  options: string[];
  correctAnswer: string | string[] | Hotspot[] | GraphFeatureData;
  image_path?: string;
  question_topic?: string;
  question_feedback?: string;
}

export interface QuestionFormProps {
  onFormSubmit?: (formData: { title: string; questions: QuestionInput[]; description?: string; module: string }) => void;
  initialData?: {
    id?: string;
    title: string;
    module: string;
    description: string;
    questions: any[];
  };
  isEditing?: boolean;
}

export interface LocalQuestion {
  id: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: string | string[] | Hotspot[] | GraphFeatureData;
  image_url?: string;
  imageFile?: File | null;
  filePath?: string;
  graphFeatureData?: GraphFeatureData;
  question_topic?: string;
  question_feedback?: string;
}

export interface Hotspot {
  x: number;
  y: number;
}

export interface GenerateQuizPayload {
  title: string;
  module: string;
  description?: string;
  maxQuestions?: number;
  questions: {
    id: string;
    type: string;
    question: string;
    topic?: string;
    options?: string[];
  }[];
}

export interface GenerateQuizResponse {
  selectedIds: string[];
  reasoning: string;
}

export interface TextQuestion extends BaseQuizQuestion { question_type: 'text'; correct_answer: string; }
export interface MultipleChoiceQuestion extends BaseQuizQuestion { question_type: 'multiple-choice'; options: string[]; correct_answer: string[]; }
export interface CheckboxQuestion extends BaseQuizQuestion { question_type: 'checkbox'; options: string[]; correct_answer: string[]; }
export interface HotspotQuestion extends BaseQuizQuestion { question_type: 'hotspot'; correct_answer: HotspotAnswer[]; }
export interface GraphFeatureQuestion extends BaseQuizQuestion { question_type: 'graph_feature'; correct_answer: GraphFeatureData | string; }

export type QuestionType = 'text' | 'multiple-choice' | 'checkbox' | 'hotspot' | 'graph_feature';
export type QuizQuestionData = TextQuestion | MultipleChoiceQuestion | CheckboxQuestion | HotspotQuestion | GraphFeatureQuestion;
export type QuestionCorrectAnswer = string | string[] | HotspotAnswer[]