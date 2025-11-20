'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import H5PPlayer from "@/components/H5PPlayer";
import { signOut } from "@/public/lib/utils";
import { useAuth } from "@/public/lib/AuthContext";

interface QuizData {
  h5p_parameters: any;
  title?: string;
  description?: string;
}

export default function QuizPage() {
  const { id } = useParams();
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { username, role } = useAuth();

  useEffect(() => {
    if (!id) return;

    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/get-quiz/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch quiz');
        }
        
        const data = await response.json();
        setQuizData(data);
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError('Failed to load quiz. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
        <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
        <div className="flex gap-6 items-center">
          {username ? `${username} (${role})` : "Guest"}
          <Link href="/home" className="text-gray-700 hover:text-blue-600 font-medium">
            Home
          </Link>
          <Link href="" className="text-gray-700 hover:text-blue-600 font-medium">
            Change Password
          </Link>
          <Link href="/guide" className="text-gray-700 hover:text-blue-600 font-medium">
            Guide
          </Link>
          <button onClick={signOut} className="text-gray-700 hover:text-blue-600 font-medium">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="flex flex-col items-center mt-16 px-6">
        {/* Display actual quiz title instead of UUID */}
        <h2 className="text-3xl font-semibold mb-8 text-gray-800">
          {quizData?.title || "Quiz"}
        </h2>

        {/* Optional: Display quiz description */}
        {quizData?.description && (
          <p className="text-gray-600 mb-6 text-center max-w-2xl">
            {quizData.description}
          </p>
        )}

        <div className="w-full max-w-3xl">
          <H5PPlayer path="practice-questions" />
        </div>
      </main>
    </div>
  );
}