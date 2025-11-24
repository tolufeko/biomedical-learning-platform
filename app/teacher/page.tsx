'use client';

import { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut } from "@/public/lib/utils";
import { useAuth } from "@/public/lib/AuthContext";

interface Quiz {
  id: string;
  title: string;
  description: string;
}

export default function AdminPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { username, role } = useAuth();
  const [quizSearchTerm, setQuizSearchTerm] = useState("");

  // Clear error after a delay
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Fetch all quizzes from Supabase
  const fetchQuizzes = async () => {
    try {
      const res = await fetch('/api/get-quizzes');
      const data = await res.json();
      setQuizzes(data || []);
    } catch (err) {
      setError('Failed to fetch quizzes');
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // Handle file selection
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null); // Clear error when new file is selected
    }
  };

  // Upload new quiz
  const submitQuiz = async () => {
    setError(null);

    if (!title || !file) {
      setError('Please provide a title and JSON file');
      return;
    }

    try {
      const text = await file.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        setError('Invalid JSON file');
        return;
      }

      const res = await fetch('/api/add-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, h5p_json: json }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setTitle('');
        setDescription('');
        setFile(null);
        fetchQuizzes();
      }
    } catch (err) {
      setError('Failed to upload quiz');
    }
  };

  // Delete quiz
  const handleDelete = async (quizId: string, quizTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${quizTitle}"?`)) return;

    setError(null);

    try {
      const res = await fetch(`/api/delete-quiz/${quizId}`, { 
        method: 'DELETE' 
      });
      
      console.log("Response status:", res.status);
      console.log("Response OK:", res.ok);
      
      const data = await res.json();
      console.log("Response data:", data);
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }
      
      fetchQuizzes();
    } catch (err) {
      console.error('Delete error:', err);
      setError(`Failed to delete quiz: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
        <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
        <div className="flex gap-6 items-center">
          {username ? `${username}` : "Guest"}
          {role === 'admin' && (
          <Link href="admin/" className="text-gray-700 hover:text-blue-600 font-medium">
            Admin View
          </Link>
          )}
          <Link href="home/" className="text-gray-700 hover:text-blue-600 font-medium">
            Home
          </Link>
          <Link href="guide/" className="text-gray-700 hover:text-blue-600 font-medium">
            Guide
          </Link>
          <button
            onClick={signOut}
            className="text-gray-700 hover:text-blue-600 font-medium">
            Sign Out
          </button>
        </div>
      </nav>

      {/* Error Message */}
      {error && (
        <div className="max-w-3xl mx-auto mt-6">
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

      {/* Upload H5P JSON */}
      <div className="flex flex-col gap-4 px-6 py-4 bg-white shadow-sm border-b mt-4 max-w-3xl mx-auto">
        <h2 className="flex flex-col items-center text-xl font-semibold mb-3">Upload Quizzes</h2>
        <input
          type="text"
          placeholder="Quiz title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded w-full"
        />
        
        <textarea
          placeholder="Quiz description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border p-2 rounded w-full min-h-[80px] resize-vertical"
          rows={3}
        />

        <div className="flex flex-col md:flex-row justify-between items-center gap-2">
          {/* Custom file button */}
          <label className="px-4 py-2 bg-gray-200 rounded cursor-pointer hover:bg-gray-300 w-full md:w-auto text-center">
            {file ? file.name : "Choose File"} {/* show file name if selected */}
            <input type="file" accept=".json" onChange={handleUpload} className="hidden" />
          </label>

          <button
            onClick={submitQuiz}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full md:w-auto"
          >
            Upload Quiz
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto mt-10">

      <div className="p-6 bg-white rounded-lg shadow-md mt-6">
        <h2 className="text-xl font-semibold mb-4 text-center">All Quizzes</h2>
        {/* Search Bar for Quizzes */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search quizzes by title or description..."
            value={quizSearchTerm}
            onChange={(e) => setQuizSearchTerm(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* List of quizzes */}
        <div className="space-y-3">
          {quizzes
            .filter(quiz => 
              quiz.title.toLowerCase().includes(quizSearchTerm.toLowerCase()) ||
              (quiz.description && quiz.description.toLowerCase().includes(quizSearchTerm.toLowerCase()))
            )
            .map((quiz) => (
              <div
                key={quiz.id}
                className="p-4 border rounded bg-white shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="text-lg font-medium truncate">{quiz.title}</p>
                    {quiz.description && (
                      <p className="text-gray-600 text-sm mt-1">{quiz.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                      onClick={() => console.log('Edit/Replace quiz', quiz.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                      onClick={() => handleDelete(quiz.id, quiz.title)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
        
        {/* Show message if no quizzes match search */}
        {quizzes.filter(quiz => 
          quiz.title.toLowerCase().includes(quizSearchTerm.toLowerCase()) ||
          (quiz.description && quiz.description.toLowerCase().includes(quizSearchTerm.toLowerCase()))
        ).length === 0 && quizSearchTerm && (
          <div className="text-center text-gray-500 py-8">
            No quizzes found matching "{quizSearchTerm}"
          </div>
        )}
        </div>
      </div>
    </div>
  );
}