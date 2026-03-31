// lib/types/analytics.ts
export interface RawRecord {
    user_id: string;
    username: string;
    correct: boolean;
    time_spent: number;
    quiz_id: string;
    quiz_title: string;
    module: string;
    question_id: string;
    question_text: string;
    question_topic: string;
}

export type SortKey = 'average_score' | 'error_rate' | 'total_attempts' | 'avg_time';
export type SortDir = 'asc' | 'desc';
export type ViewMode = 'student' | 'module' | 'quiz' | 'topic' | 'question';