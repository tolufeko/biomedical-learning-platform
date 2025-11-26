'use client';

import { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut } from "@/public/lib/utils";
import { useAuth } from "@/public/lib/AuthContext";
import QuestionForm from "@/components/QuestionForm";

interface CustomForm {
  id: string;
  title: string;
  description?: string;
  questions: any[];
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function AdminPage() {
  const [customForms, setCustomForms] = useState<CustomForm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { username, role, user } = useAuth();
  const [formSearchTerm, setFormSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [formsLoading, setFormsLoading] = useState(false);
  const router = useRouter();

  // Check if user is teacher or admin
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        router.push("/");
        return;
      }

      // Allow access only for teachers and admins
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

  // Fetch custom forms
  const fetchCustomForms = async () => {
    setFormsLoading(true);
    try {
      const res = await fetch('/api/custom-forms');
      if (res.ok) {
        const data = await res.json();
        setCustomForms(data || []);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch forms');
      }
    } catch (err) {
      console.error('Failed to fetch custom forms:', err);
      setError('Failed to load custom forms');
    } finally {
      setFormsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'teacher' || role === 'admin') {
      fetchCustomForms();
    }
  }, [role]);

  // Handle custom form submission
  const handleFormSubmit = async (formData: { title: string; questions: any[]; description?: string }) => {
    try {
      const response = await fetch('/api/custom-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('Quiz created successfully!');
        fetchCustomForms();
      } else {
        throw new Error(result.error || 'Failed to create quiz');
      }
    } catch (error) {
      console.error('Error saving custom form:', error);
      setError(`Failed to create quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Delete custom form
  const handleDeleteForm = async (formId: string, formTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${formTitle}"?`)) return;

    setError(null);

    try {
      const res = await fetch(`/api/custom-forms/${formId}`, { 
        method: 'DELETE' 
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }
      
      setSuccess('Quiz deleted successfully!');
      fetchCustomForms();
    } catch (err) {
      console.error('Delete error:', err);
      setError(`Failed to delete quiz: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // If user doesn't have access, don't render the page
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

        {/* Create Custom Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Create New Quiz</CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionForm onFormSubmit={handleFormSubmit} />
          </CardContent>
        </Card>

        {/* Custom Forms List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Your Quizzes</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search Bar for Forms */}
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

            {/* List of custom forms */}
            {!formsLoading && (
              <div className="space-y-4">
                {customForms
                  .filter(form => 
                    form.title.toLowerCase().includes(formSearchTerm.toLowerCase())
                  )
                  .map((form) => (
                    <div
                      key={form.id}
                      className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">{form.title}</h3>
                          {form.description && (
                            <p className="text-gray-600 mb-3">{form.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                            <span>
                              {form.questions?.length || 0} question{form.questions?.length !== 1 ? 's' : ''}
                            </span>
                            <span>•</span>
                            <span>
                              Created: {new Date(form.created_at).toLocaleDateString()}
                            </span>
                            <span>•</span>
                            <span>
                              Updated: {new Date(form.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {form.questions?.slice(0, 5).map((q: any, idx: number) => (
                              <span 
                                key={idx} 
                                className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded capitalize"
                              >
                                {q.type?.replace('-', ' ') || 'unknown'}
                              </span>
                            ))}
                            {form.questions?.length > 5 && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                +{form.questions.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-6">
                          <button
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            onClick={() => {
                              // View quiz - you can implement this later
                              console.log('View quiz', form.id);
                              alert('View quiz functionality to be implemented');
                            }}
                          >
                            View
                          </button>
                          <button
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                            onClick={() => {
                              // Edit quiz - you can implement this later
                              console.log('Edit quiz', form.id);
                              alert('Edit quiz functionality to be implemented');
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            onClick={() => handleDeleteForm(form.id, form.title)}
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
            {!formsLoading && customForms.filter(form => 
              form.title.toLowerCase().includes(formSearchTerm.toLowerCase())
            ).length === 0 && formSearchTerm && (
              <div className="text-center text-gray-500 py-12">
                <div className="text-lg mb-2">No quizzes found</div>
                <p className="text-sm">No quizzes match "{formSearchTerm}"</p>
              </div>
            )}

            {!formsLoading && customForms.length === 0 && !formSearchTerm && (
              <div className="text-center text-gray-500 py-12">
                <div className="text-lg mb-2">No quizzes created yet</div>
                <p className="text-sm">Create your first quiz using the quiz builder above!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}