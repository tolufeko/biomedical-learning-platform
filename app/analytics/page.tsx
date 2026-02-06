'use client';

import { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";

// =============== TYPES ===============
interface HotspotAnswer { x: number; y: number; }
type QuestionCorrectAnswer = string | string[] | HotspotAnswer[];
interface QuizQuestion {
  id: string; 
  question_type: string; 
  question_text: string; 
  options: string[];
  correct_answer: QuestionCorrectAnswer; 
  display_order: number;
  image_path?: string; 
  image_url?: string;
}
interface Quiz {
  id: string; 
  title: string; 
  description?: string; 
  questions: QuizQuestion[];
  created_at: string; 
  updated_at: string; 
  user_id: string;
}
interface HardestQuestion {
    question_id: string;
    question_text: string;
    error_rate: number;
    total_attempts: number;
    incorrect_attempts: number;
  }
interface QuizStatistics {
average_score: number;
average_time_spent: number;
highest_error_question: HardestQuestion | null;
total_attempts: number;
data_available: boolean;
}

// =============== MAIN COMPONENT ===============
export default function TeacherPage() {
    const router = useRouter();
    const { username, role, user, loading: authLoading, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [stats, setStats] = useState<QuizStatistics | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAnalyticsForm, setShowAnalyticsForm] = useState(false);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  
    // 🔍 Analytics filters
    const [viewMode, setViewMode] = useState<'general' | 'quiz' | 'student'>('general');
    const [selectedQuizId, setSelectedQuizId] = useState<string>('');
    const [selectedUserName, setSelectedUserName] = useState<string>('');
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

     // 🔁 Fetch stats based on current filters
    const fetchStatistics = async () => {
        setAnalyticsLoading(true);
        try {
        let url = '/api/quiz-statistics';
        const params = new URLSearchParams();
        if (viewMode === 'quiz' && selectedQuizId) {
            params.append('quiz_id', selectedQuizId);
        } else if (viewMode === 'student' && selectedUserName) {
            params.append('username', selectedUserName);
        }

        const finalUrl = params.toString() ? `${url}?${params.toString()}` : url;
        const res = await fetch(finalUrl);
        const data = await res.json();
        setStats(data);
        } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load statistics');
        setStats(null);
        } finally {
        setAnalyticsLoading(false);
        }
    };

    // Refetch stats when filters change
    useEffect(() => {
        fetchStatistics()
    }, [role, viewMode, selectedQuizId, selectedUserName]);

    if (authLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    // =============== RENDER ===============
    return (
        <div className="min-h-screen bg-gray-50">
        {/* Navbar */}
        <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
            <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
            <div className="flex gap-6 items-center">
            {username ? `${username}` : "Guest"}
            {role === 'admin' && <Link href="/admin" className="text-gray-700 hover:text-blue-600">Admin View</Link>}
            <Link href="/home" className="text-gray-700 hover:text-blue-600">Home</Link>
            <Link href="/guide" className="text-gray-700 hover:text-blue-600">Guide</Link>
            <button onClick={async () => {
                await logout();
                window.location.href = "/";
            }} className="text-gray-700 hover:text-blue-600">Sign Out</button>
            </div>
        </nav>

        {/* Messages */}
        {error && (
            <div className="max-w-6xl mx-auto mt-6 px-6">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="absolute top-0 right-0 px-4 py-3">×</button>
            </div>
            </div>
        )}

        <div className="max-w-6xl mx-auto p-6">
            <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
            <p className="text-gray-600">Analyze student performance</p>
            </div>

            {/* 🔍 ANALYTICS CONTROLS */}
            <div className="mb-8">
            <button
                onClick={() => setShowAnalyticsForm(!showAnalyticsForm)}
                className="w-full text-left px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100"
            >
                {showAnalyticsForm ? 'Hide Analytics' : 'View Analytics'}
            </button>
            {showAnalyticsForm && (
                <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Performance Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* View Selector */}
                    <div className="flex flex-wrap gap-4 mb-6">
                    <button
                        onClick={() => setViewMode('general')}
                        className={`px-4 py-2 rounded-lg font-medium ${
                        viewMode === 'general'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        All Students & Quizzes
                    </button>
                    <button
                        onClick={() => setViewMode('quiz')}
                        className={`px-4 py-2 rounded-lg font-medium ${
                        viewMode === 'quiz'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Specific Quiz
                    </button>
                    <button
                        onClick={() => setViewMode('student')}
                        className={`px-4 py-2 rounded-lg font-medium ${
                        viewMode === 'student'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Specific Student
                    </button>
                    </div>

                    {/* Conditional Inputs */}
                    {viewMode === 'quiz' && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Quiz</label>
                        <select
                        value={selectedQuizId}
                        onChange={(e) => setSelectedQuizId(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        >
                        <option value="">-- Choose a quiz --</option>
                        {quizzes.map(quiz => (
                            <option key={quiz.id} value={quiz.id}>{quiz.title}</option>
                        ))}
                        </select>
                    </div>
                    )}

                    {viewMode === 'student' && (
                    <div className="mb-4 space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                        Student Username
                        </label>
                        <input
                        type="text"
                        value={selectedUserName}
                        onChange={(e) => setSelectedUserName(e.target.value.trim())}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                        Enter the student's username (not user ID)
                        </p>
                    </div>
                    </div>
                    )}

                    {/* Stats Display */}
                    {analyticsLoading ? (
                    <div className="text-center py-6 text-gray-600">Loading analytics...</div>
                    ) : stats ? (
                    <div className="mt-6">
                        {stats.data_available ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-blue-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Avg. Score</p>
                            <p className="text-2xl font-bold text-blue-700">{stats.average_score}%</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Avg. Time (sec)</p>
                            <p className="text-2xl font-bold text-green-700">{stats.average_time_spent}</p>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Total Attempts</p>
                            <p className="text-2xl font-bold text-purple-700">{stats.total_attempts}</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg text-center">
                            {stats?.highest_error_question ? (
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
                        ) : (
                        <div className="text-center py-6 text-gray-500">
                            No analytics data available for this selection.
                        </div>
                        )}
                    </div>
                    ) : null}
                </CardContent>
                </Card>
            )}
            </div>
        </div>
        </div>
    );
}
