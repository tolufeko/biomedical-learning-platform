// app/home/page.tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

// ✅ Fixed: Changed quiz_questions to questions
interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: any[]; // ✅ Changed from quiz_questions
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export default function HomePage() {
  const router = useRouter();
  const { username, role, logout } = useAuth();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // 🔁 Extract navbar to avoid duplication
  const renderNavbar = () => (
    <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
      <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
      <div className="flex gap-6 items-center">
        {username ? `${username}` : "Guest"}
        {role === 'admin' && (
          <Link href="/admin" className="text-gray-700 hover:text-blue-600 font-medium">
            Admin View
          </Link>
        )}
        {(role === 'teacher' || role === 'admin') && (
          <Link href="/teacher" className="text-gray-700 hover:text-blue-600 font-medium">
            Teacher View
          </Link>
        )}
        <Link href="/guide" className="text-gray-700 hover:text-blue-600 font-medium">
          Guide
        </Link>
        <button
          onClick={async () => {
            await logout();
            window.location.href = '/';
          }}
          className="text-gray-700 hover:text-blue-600 font-medium"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const response = await fetch('/api/quizzes');
        
        // ✅ Better error handling
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Quizzes loaded:', data); // ✅ Debug log
        setQuizzes(data);
      } catch (error: any) {
        console.error('Error fetching quizzes:', error);
        setError(error.message || 'Failed to load subjects. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, []);

  const filteredQuizzes = quizzes.filter(quiz =>
    (quiz.title?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
    (quiz.description?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        {renderNavbar()}
        <main className="flex flex-col items-center justify-center mt-16 px-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">Loading subjects...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        {renderNavbar()}
        <main className="flex flex-col items-center justify-center mt-16 px-6">
          <div className="text-center text-red-600">
            <div className="text-lg mb-4">{error}</div>
            <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">
              Try Again
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {renderNavbar()}
      <main className="flex flex-col items-center justify-center mt-8 px-6">
        <h2 className="text-3xl font-semibold mb-4 text-gray-800">
          Welcome to your Biomedical Learning Hub
        </h2>
        <p className="text-gray-700 mb-4 text-center">
          Please click on the subject area you wish to revise.
        </p>
        <div className="w-full max-w-2xl mb-6">
          <input
            type="text"
            placeholder="Search subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
          {filteredQuizzes.map((quiz) => (
            <Card
              key={quiz.id}
              className="hover:shadow-lg transition cursor-pointer border-2 border-transparent hover:border-blue-200"
              onClick={() => router.push(`/quiz/${quiz.id}`)}
            >
              <CardHeader>
                <CardTitle className="text-lg flex justify-between items-start">
                  <span>{quiz.title}</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {/* ✅ Fixed: Changed quiz_questions to questions */}
                    {quiz.questions?.length || 0} Qs
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-3">
                  {quiz.description || "No description available"}
                </p>
                <div className="text-xs text-gray-500">
                  {/* ✅ Fixed: Changed quiz_questions to questions */}
                  {quiz.questions?.length || 0} question{quiz.questions?.length !== 1 ? 's' : ''}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {filteredQuizzes.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-lg mb-2">No subjects match your search</div>
            <p className="text-sm mb-4">Try a different keyword.</p>
          </div>
        )}
      </main>
    </div>
  );
}