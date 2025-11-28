'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut } from "@/public/lib/utils";
import { useAuth } from "@/public/lib/AuthContext";
import QuestionForm from "@/components/QuestionForm";

interface QuizQuestion { // Changed from FormQuestion
  id: string;
  question_type: string;
  question_text: string;
  options: string[];
  correct_answer: string | string[];
  display_order: number;
}

interface Quiz { // Changed from CustomForm
  id: string;
  title: string;
  description?: string;
  question_ids: string[];
  questions?: any[];
  quiz_questions: QuizQuestion[]; // Changed from form_questions
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function AdminPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]); // Changed from CustomForm[]
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { username, role, user } = useAuth();
  const [formSearchTerm, setFormSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [formsLoading, setFormsLoading] = useState(false);
  const [editingForm, setEditingForm] = useState<Quiz | null>(null); // Changed from CustomForm
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [resetFormKey, setResetFormKey] = useState(0);
  const router = useRouter();

  // Check if user is teacher or admin
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        router.push("/");
        return;
      }

      if (role !== 'teacher' && role !== 'admin') {
        router.push("/home");
        return;
      }

      setLoading(false);
    };

    checkAccess();
  }, [user, role, router]);

  // Clear messages after a delay
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Fetch quizzes
  const fetchQuizzes = async () => {
    setFormsLoading(true);
    try {
      const res = await fetch('/api/quizzes'); // Changed endpoint
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data || []);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch quizzes');
      }
    } catch (err) {
      console.error('Failed to fetch quizzes:', err);
      setError('Failed to load quizzes');
    } finally {
      setFormsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'teacher' || role === 'admin') {
      fetchQuizzes();
    }
  }, [role]);

  // Handle quiz submission
  const handleFormSubmit = async (formData: { title: string; questions: any[]; description?: string }) => {
    try {
      const response = await fetch('/api/quizzes', { // Changed endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          userId: user?.id
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('Quiz created successfully!');
        setQuizzes(prevQuizzes => [result, ...prevQuizzes]);
        setResetFormKey(prev => prev + 1);
      } else {
        throw new Error(result.error || 'Failed to create quiz');
      }
    } catch (error) {
      console.error('Error saving quiz:', error);
      setError(`Failed to create quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle quiz update
  const handleFormUpdate = async (formData: { title: string; questions: any[]; description?: string }) => {
    if (!editingForm) return;

    try {
      const deleteResponse = await fetch(`/api/quizzes/${editingForm.id}`, { // Changed endpoint
        method: 'DELETE',
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete existing quiz');
      }

      const createResponse = await fetch('/api/quizzes', { // Changed endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          userId: user?.id
        }),
      });

      const result = await createResponse.json();

      if (createResponse.ok) {
        setSuccess('Quiz updated successfully!');
        fetchQuizzes();
        setEditingForm(null);
        setIsEditModalOpen(false);
      } else {
        throw new Error(result.error || 'Failed to update quiz');
      }
    } catch (error) {
      console.error('Error updating quiz:', error);
      setError(`Failed to update quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Delete quiz
  const handleDeleteQuiz = async (quizId: string, quizTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${quizTitle}"?`)) return;

    setError(null);

    try {
      const res = await fetch(`/api/quizzes/${quizId}`, { // Changed endpoint
        method: 'DELETE' 
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }
      
      setSuccess('Quiz deleted successfully!');
      fetchQuizzes();
    } catch (err) {
      console.error('Delete error:', err);
      setError(`Failed to delete quiz: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Start editing a quiz
  const handleEditQuiz = (quiz: Quiz) => {
    setEditingForm(quiz);
    setIsEditModalOpen(true);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingForm(null);
    setIsEditModalOpen(false);
  };

  // Convert quiz questions to the format expected by QuestionForm
  const convertQuizQuestions = (questions: QuizQuestion[]) => {
    return questions.map(q => ({
      type: q.question_type,
      question: q.question_text,
      options: q.options || [],
      correctAnswer: q.correct_answer
    }));
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (role !== 'teacher' && role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
        <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
        <div className="flex gap-6 items-center">
          {username ? `${username}` : "Guest"}
          {role === 'admin' && (
            <Link href="/admin" className="text-gray-700 hover:text-blue-600 font-medium">
              Admin View
            </Link>
          )}
          <Link href="/home" className="text-gray-700 hover:text-blue-600 font-medium">
            Home
          </Link>
          <Link href="/guide" className="text-gray-700 hover:text-blue-600 font-medium">
            Guide
          </Link>
          <button
            onClick={signOut}
            className="text-gray-700 hover:text-blue-600 font-medium">
            Sign Out
          </button>
        </div>
      </nav>

      {/* Messages */}
      {error && (
        <div className="max-w-6xl mx-auto mt-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{error}</span>
            <button
              onClick={() => setError(null)}
              className="absolute top-0 right-0 px-4 py-3"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="max-w-6xl mx-auto mt-6">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="absolute top-0 right-0 px-4 py-3"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Management</h1>
          <p className="text-gray-600">Create and manage quizzes with automatic grading</p>
        </div>

        {/* Create Quiz Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Create New Quiz</CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionForm 
              key={resetFormKey}
              onFormSubmit={handleFormSubmit} 
            />
          </CardContent>
        </Card>

        {/* Quizzes List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Your Quizzes</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search quizzes by title..."
                value={formSearchTerm}
                onChange={(e) => setFormSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Loading State */}
            {formsLoading && (
              <div className="text-center py-8">
                <div className="text-lg">Loading quizzes...</div>
              </div>
            )}

            {/* List of quizzes */}
            {!formsLoading && (
              <div className="space-y-4">
                {quizzes
                  .filter(quiz => 
                    quiz.title.toLowerCase().includes(formSearchTerm.toLowerCase())
                  )
                  .map((quiz) => (
                    <div
                      key={quiz.id}
                      className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">{quiz.title}</h3>
                          {quiz.description && (
                            <p className="text-gray-600 mb-3">{quiz.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                            <span>
                              {quiz.quiz_questions?.length || 0} question{quiz.quiz_questions?.length !== 1 ? 's' : ''}
                            </span>
                            <span>•</span>
                            <span>
                              Created: {new Date(quiz.created_at).toLocaleDateString()}
                            </span>
                            <span>•</span>
                            <span>
                              Updated: {new Date(quiz.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {quiz.quiz_questions?.slice(0, 5).map((q: QuizQuestion, idx: number) => (
                              <span 
                                key={q.id} 
                                className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded capitalize"
                              >
                                {q.question_type?.replace('-', ' ') || 'unknown'}
                              </span>
                            ))}
                            {quiz.quiz_questions?.length > 5 && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                +{quiz.quiz_questions.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-6">
                          <Link 
                            href={`/quiz/${quiz.id}`}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-center"
                          >
                            View
                          </Link>
                          <button
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                            onClick={() => handleEditQuiz(quiz)}
                          >
                            Edit
                          </button>
                          <button
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
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
            
            {/* Empty States */}
            {!formsLoading && quizzes.filter(quiz => 
              quiz.title.toLowerCase().includes(formSearchTerm.toLowerCase())
            ).length === 0 && formSearchTerm && (
              <div className="text-center text-gray-500 py-12">
                <div className="text-lg mb-2">No quizzes found</div>
                <p className="text-sm">No quizzes match "{formSearchTerm}"</p>
              </div>
            )}

            {!formsLoading && quizzes.length === 0 && !formSearchTerm && (
              <div className="text-center text-gray-500 py-12">
                <div className="text-lg mb-2">No quizzes created yet</div>
                <p className="text-sm">Create your first quiz using the quiz builder above!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Edit Quiz: {editingForm.title}</h2>
                <button
                  onClick={handleCloseEditModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
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