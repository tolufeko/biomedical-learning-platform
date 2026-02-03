'use client';

import { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import QuestionForm from "@/components/QuestionForm";

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
  question_ids: string[];
  quiz_questions: QuizQuestion[]; 
  created_at: string; 
  updated_at: string; 
  user_id: string;
}
interface HardestQuestion {
  question_id: string;
  question_text: string; // ✅ Added
  error_rate: number;
  total_attempts: number;
  incorrect_attempts: number;
}
interface QuizStatistics {
  average_score: number;
  average_time_spent: number;
  highest_error_question: HardestQuestion | null; // ✅ Updated type
  total_attempts: number;
  data_available: boolean;
}

// =============== MAIN COMPONENT ===============
export default function AdminPage() {
  const router = useRouter();
  // ✅ Single useAuth() call
  const { username, role, user, loading: authLoading, logout } = useAuth();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [stats, setStats] = useState<QuizStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formSearchTerm, setFormSearchTerm] = useState("");
  const [formsLoading, setFormsLoading] = useState(false);
  const [editingForm, setEditingForm] = useState<Quiz | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [resetFormKey, setResetFormKey] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showQuizzesList, setShowQuizzesList] = useState(false);
  const [showAnalyticsForm, setShowAnalyticsForm] = useState(false);
  
  // 🔍 Analytics filters
  const [viewMode, setViewMode] = useState<'general' | 'quiz' | 'student'>('general');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Access check
  useEffect(() => {
    if (authLoading) return; // Don't redirect while loading
  
    if (!user) {
      router.push("/");
    } else if (role !== 'teacher' && role !== 'admin') {
      router.push("/home");
    }
  }, [user, role, authLoading, router]);

  // Clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => { setError(null); setSuccess(null); }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Fetch quizzes (for dropdown)
  const fetchQuizzes = async () => {
    setFormsLoading(true);
    try {
      const res = await fetch('/api/quizzes');
      const data = await res.json();
      setQuizzes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load quizzes');
    } finally {
      setFormsLoading(false);
    }
  };

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
      // For 'general', no params → global stats

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
    if (role === 'teacher' || role === 'admin') {
      fetchQuizzes();
      fetchStatistics();
    }
  }, [role, viewMode, selectedQuizId, selectedUserName]);

  // =============== Rest of handlers unchanged ===============
  const handleFormSubmit = async (formData: { title: string; questions: any[]; description?: string }) => {
    try {
      const response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userId: user?.id }),
      });
      const result = await response.json();
      if (response.ok) {
        setSuccess('Quiz created successfully!');
        setQuizzes(prev => [result, ...prev]);
        setResetFormKey(p => p + 1);
        setShowCreateForm(false);
      } else throw new Error(result.error || 'Failed to create quiz');
    } catch (error) {
      setError(`Failed to create quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFormUpdate = async (formData: { title: string; questions: any[]; description?: string }) => {
    if (!editingForm) return;
    try {
      await fetch(`/api/quizzes/${editingForm.id}`, { method: 'DELETE' });
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userId: user?.id }),
      });
      const result = await res.json();
      if (res.ok) {
        setSuccess('Quiz updated successfully!');
        fetchQuizzes();
        setEditingForm(null);
        setIsEditModalOpen(false);
      } else throw new Error(result.error || 'Update failed');
    } catch (error) {
      setError(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteQuiz = async (quizId: string, quizTitle: string) => {
    if (!confirm(`Delete "${quizTitle}"?`)) return;
    try {
      const res = await fetch(`/api/quizzes/${quizId}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess('Quiz deleted!');
        fetchQuizzes();
      } else throw new Error('Delete failed');
    } catch (err) {
      setError(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleEditQuiz = async (quizId: string) => {
    setFormsLoading(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}`);
      const fullQuiz = await res.json();
      setEditingForm(fullQuiz);
      setIsEditModalOpen(true);
      setShowQuizzesList(true);
    } catch (err) {
      setError('Could not load quiz for editing');
    } finally {
      setFormsLoading(false);
    }
  };

  const handleCloseEditModal = () => {
    setEditingForm(null);
    setIsEditModalOpen(false);
  };

  const convertQuizQuestions = (questions: QuizQuestion[]) => {
    return questions.map(q => {
      if (q.question_type === 'hotspot') {
        return {
          type: q.question_type,
          question: q.question_text,
          options: q.options || [],
          correctAnswer: q.correct_answer,
          image_url: q.image_url || '',
          image_path: q.image_path || '',
        };
      }
      return { type: q.question_type, question: q.question_text, options: q.options || [], correctAnswer: q.correct_answer };
    });
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (role !== 'teacher' && role !== 'admin') return null;

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
            window.location.href = "/"; // ✅ HARD REDIRECT
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
      {success && (
        <div className="max-w-6xl mx-auto mt-6 px-6">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="absolute top-0 right-0 px-4 py-3">×</button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Management & Analytics</h1>
          <p className="text-gray-600">Create quizzes and analyze student performance</p>
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
                      placeholder="e.g., toluwani"
                      value={selectedUserName}
                      onChange={(e) => setSelectedUserName(e.target.value.trim())} // ✅ Fixed typo
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

        {/* Rest of UI: Create Quiz & Quizzes List (unchanged) */}
        <div className="mb-8">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full text-left px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100"
          >
            {showCreateForm ? 'Hide Quiz Creator' : 'Create New Quiz'}
          </button>
          {showCreateForm && (
            <Card className="mt-4">
              <CardHeader><CardTitle>Create New Quiz</CardTitle></CardHeader>
              <CardContent>
                <QuestionForm key={resetFormKey} onFormSubmit={handleFormSubmit} />
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowQuizzesList(!showQuizzesList)}
            className="w-full text-left px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100"
          >
            {showQuizzesList ? 'Hide Your Quizzes' : 'View Your Quizzes'}
          </button>
          {showQuizzesList && (
            <Card className="mt-4">
              <CardHeader><CardTitle>Your Quizzes</CardTitle></CardHeader>
              <CardContent>
                <div className="mb-6">
                  <input
                    type="text"
                    placeholder="Search quizzes..."
                    value={formSearchTerm}
                    onChange={(e) => setFormSearchTerm(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>
                {/* ... rest of quiz list rendering (same as before) ... */}
                {formsLoading ? (
                  <div className="text-center py-8">Loading quizzes...</div>
                ) : (
                  <div className="space-y-4">
                    {quizzes
                      .filter(q => q.title.toLowerCase().includes(formSearchTerm.toLowerCase()))
                      .map(quiz => (
                        <div key={quiz.id} className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="text-xl font-semibold text-gray-900 mb-2">{quiz.title}</h3>
                              {quiz.description && <p className="text-gray-600 mb-3">{quiz.description}</p>}
                              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                                <span>{quiz.quiz_questions?.length || 0} question{quiz.quiz_questions?.length !== 1 ? 's' : ''}</span>
                                <span>•</span>
                                <span>Created: {new Date(quiz.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-6">
                              <Link href={`/quiz/${quiz.id}`} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                                View
                              </Link>
                              <button
                                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                                onClick={() => handleEditQuiz(quiz.id)}
                              >
                                Edit
                              </button>
                              <button
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                                onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                {/* Empty states */}
                {!formsLoading && quizzes.filter(q => q.title.toLowerCase().includes(formSearchTerm.toLowerCase())).length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    <div className="text-lg mb-2">
                      {formSearchTerm ? 'No quizzes found' : 'No quizzes created yet'}
                    </div>
                    <p className="text-sm">
                      {formSearchTerm
                        ? `No quizzes match "${formSearchTerm}"`
                        : 'Create your first quiz using the quiz builder above!'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Edit Quiz: {editingForm.title}</h2>
                <button onClick={handleCloseEditModal} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
              </div>
              <QuestionForm
                onFormSubmit={handleFormUpdate}
                initialData={{
                  title: editingForm.title,
                  description: editingForm.description || '',
                  questions: convertQuizQuestions(editingForm.quiz_questions)
                }}
                isEditing={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}