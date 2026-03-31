// lib/types/answers.ts
export interface EquationEntry {
  id: string;
  expr: string;
  color: string;
}

export interface FeatureAnswer {
  id: string;
  x: number | '';
  y: number | '';
}

export interface GraphStudentAnswer {
  id: string;
  x: string;
  y: string;
}

export interface QuestionState {
    answerState: AnswerState;
    isSubmitted: boolean;
    isCorrect: boolean | null;
    showSolution: boolean;
    showFeedback: boolean;
    startTime: number;
    endTime: number | null;
}

export interface HotspotAnswer { x: number; y: number; }
export interface TextAnswerState       { type: 'text';           userAnswer: string | null; }
export interface ChoiceAnswerState     { type: 'multiple-choice' | 'checkbox'; userAnswer: string[] | null; }
export interface HotspotAnswerState    { type: 'hotspot';        userAnswer: HotspotAnswer[] | null; }
export interface GraphFeatureAnswerState { type: 'graph_feature'; userAnswer: GraphStudentAnswer[] | null; }

export type AnswerState = TextAnswerState | ChoiceAnswerState | HotspotAnswerState | GraphFeatureAnswerState;