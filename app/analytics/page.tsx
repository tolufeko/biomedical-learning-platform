// app/analytics/page.tsx
'use client';

import { useRouter } from "next/navigation";
import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthContext";

interface HotspotAnswer { x: number; y: number; }
interface QuizQuestion {
  id: string; question_type: string; question_text: string; options: string[];
  correct_answer: string | string[] | HotspotAnswer[]; display_order: number;
  image_path?: string; image_url?: string;
}
interface Quiz {
  id: string; title: string; description?: string; questions: QuizQuestion[];
  created_at: string; updated_at: string; user_id: string; module: string;
}
interface HardestQuestion {
  question_id: string; question_text: string; error_rate: number;
  total_attempts: number; incorrect_attempts: number;
}
interface TopicStat {
  topic: string;
  total: number;
  correct: number;
  incorrect: number;
  error_rate: number;
}
interface QuizStatistics {
  average_score: number; average_time_spent: number;
  highest_error_question: HardestQuestion | null;
  total_attempts: number; data_available: boolean;
  topic_breakdown: TopicStat[];
}

const ALL_VIEW_MODES = [
  { key: 'general', label: 'All Students & Quizzes' },
  { key: 'quiz',    label: 'Specific Quiz' },
  { key: 'module',  label: 'Specific Module' },
  { key: 'student', label: 'Specific Student' },
] as const;

const STUDENT_VIEW_MODES = [
  { key: 'general', label: 'My Overall Stats' },
  { key: 'quiz',    label: 'Specific Quiz' },
  { key: 'module',  label: 'Specific Module' },
] as const;

type ViewMode = 'general' | 'quiz' | 'module' | 'student';

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, role } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<QuizStatistics | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('general');
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const isPrivileged = role === 'teacher' || role === 'admin';
  const viewModes = isPrivileged ? ALL_VIEW_MODES : STUDENT_VIEW_MODES;

  // Derive unique modules from quizzes
  const modules = Array.from(new Set(quizzes.map(q => q.module).filter(Boolean))).sort();

  useEffect(() => {
    fetch('/api/quizzes')
      .then(r => r.json())
      .then(setQuizzes)
      .catch(() => setError('Failed to load quizzes'));
  }, []);

  useEffect(() => {
    if (!user) router.push("/");
  }, [user, role, router]);

  useEffect(() => {
    if (!isPrivileged && viewMode === 'student') setViewMode('general');
  }, [role]);

  const fetchStatistics = async () => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      if (viewMode === 'quiz' && selectedQuizId) params.append('quiz_id', selectedQuizId);
      if (viewMode === 'module' && selectedModule) params.append('module', selectedModule);
      if (isPrivileged && viewMode === 'student' && selectedUserName) params.append('username', selectedUserName);

      const res = await fetch(`/api/quiz-statistics${params.toString() ? `?${params}` : ''}`);
      setStats(await res.json());
    } catch {
      setError('Failed to load statistics');
      setStats(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => { fetchStatistics(); }, [role, viewMode, selectedQuizId, selectedModule, selectedUserName]);

  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <div className="max-w-6xl mx-auto mt-6 px-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
            <button onClick={() => setError(null)} className="absolute top-0 right-0 px-4 py-3">×</button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">
            {isPrivileged ? 'Analyze student performance' : 'View your performance'}
          </p>
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          {viewModes.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setViewMode(key as ViewMode)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                viewMode === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {viewMode === 'quiz' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Quiz</label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">-- Choose a quiz --</option>
                  {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </div>
            )}

            {viewMode === 'module' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Module</label>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">-- Choose a module --</option>
                  {modules.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}

            {isPrivileged && viewMode === 'student' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Username</label>
                <input
                  type="text"
                  value={selectedUserName}
                  onChange={(e) => setSelectedUserName(e.target.value.trim())}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">Enter the student's username (not user ID)</p>
              </div>
            )}

            {analyticsLoading ? (
              <div className="text-center py-6 text-gray-600">Loading analytics...</div>
            ) : stats?.data_available ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {[
                    { label: 'Avg. Score',      value: `${stats.average_score}%`, color: 'blue' },
                    { label: 'Avg. Time (sec)', value: stats.average_time_spent,   color: 'green' },
                    { label: 'Total Attempts',  value: stats.total_attempts,       color: 'purple' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`bg-${color}-50 p-4 rounded-lg text-center`}>
                      <p className="text-sm text-gray-600">{label}</p>
                      <p className={`text-2xl font-bold text-${color}-700`}>{value}</p>
                    </div>
                  ))}
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    {stats.highest_error_question ? (
                      <>
                        <p className="text-sm text-gray-600">Hardest Question</p>
                        <p className="text-xs font-medium text-gray-800 mt-1 line-clamp-2">
                          "{stats.highest_error_question.question_text}"
                        </p>
                        <p className="text-sm mt-2 text-red-700 font-bold">
                          {stats.highest_error_question.error_rate}% error
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">No question data</p>
                    )}
                  </div>
                </div>

                {stats.topic_breakdown?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Error Rate by Topic</h3>
                    <div className="space-y-2">
                      {[...stats.topic_breakdown]
                        .sort((a, b) => b.error_rate - a.error_rate)
                        .map(t => (
                          <div key={t.topic} className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-40 truncate shrink-0" title={t.topic}>
                              {t.topic}
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                              <div
                                className={`h-2.5 rounded-full ${
                                  t.error_rate >= 60 ? 'bg-red-500' :
                                  t.error_rate >= 30 ? 'bg-yellow-400' : 'bg-green-400'
                                }`}
                                style={{ width: `${t.error_rate}%` }}
                              />
                            </div>
                            <span className={`text-sm font-medium w-12 text-right ${
                              t.error_rate >= 60 ? 'text-red-600' :
                              t.error_rate >= 30 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {t.error_rate}%
                            </span>
                            <span className="text-xs text-gray-400 w-20 text-right">
                              {t.incorrect}/{t.total} wrong
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : stats && !stats.data_available ? (
              <div className="text-center py-6 text-gray-500">No analytics data available for this selection.</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}