// lib/types/feedback.ts
export interface AIFeedbackSuggesterProps {
    questionText: string;
    questionType: string;
    options?: string[];
    correctAnswer: string | string[];
    quizTitle?: string;
    questionTopic?: string;
    currentFeedback?: string;
    onAccept: (feedback: string) => void;
}

export interface StandardFeedback {
    scoreMessage: string;
    scoreEmoji: string;
    slowQuestions: { text: string; seconds: number }[];
    byTopic: { topic: string; correct: number; total: number }[];
    mostMissed: { text: string; attempts: number } | null;
}

export interface QuestionFeedbackPayload {
    questionText: string;
    questionType: string;
    options?: string[];
    correctAnswer: string | string[];
    quizTitle?: string;
    questionTopic?: string;
}

export interface QuizFeedbackQuestion {
    questionText: string;
    questionType: string;
    correct: boolean;
    userAnswer: string;
    correctAnswer: string;
    timeSpent: number;
}

export interface QuizFeedbackPayload {
    quizTitle: string;
    score: number;
    questions: QuizFeedbackQuestion[];
}