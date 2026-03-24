"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthContext";
import { ArrowLeft } from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  description: string;
  module: string;
  questions: any[];
  created_at?: string;
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.push("/");
  }, [user, router]);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const response = await fetch('/api/quizzes');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        const data = await response.json();
        setQuizzes(data);
      } catch (error: any) {
        setError(error.message || 'Failed to load quizzes.');
      }
    };
    fetchQuizzes();
  }, []);

  // Get unique modules
  const modules = Array.from(
    new Set(quizzes.map(q => q.module).filter(Boolean))
  ).sort();

  // Quizzes in the selected module, filtered by search
  const quizzesInModule = quizzes.filter(quiz =>
    quiz.module === selectedModule &&
    (
      (quiz.title?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (quiz.description?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
    )
  );

  const filteredModules = modules.filter(m =>
    m.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <main className="flex flex-col items-center mt-8 px-6">
        <h2 className="text-3xl font-semibold mb-2 text-gray-800">
          Biomedical Learning Hub
        </h2>
        {/* ── Module list view ── */}
        {!selectedModule ? (
          <>
            <p className="text-gray-600 mb-6 text-center">
              Select a module to begin revising.
            </p>

            <div className="w-full max-w-2xl mb-6">
              <input
                type="text"
                placeholder="Search modules..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
              {filteredModules.map(module => {
                const count = quizzes.filter(q => q.module === module).length;
                return (
                  <Card
                    key={module}
                    className="hover:shadow-lg transition cursor-pointer border-2 border-transparent hover:border-blue-200"
                    onClick={() => { setSelectedModule(module); setSearchTerm(""); }}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg flex justify-between items-start">
                        <span>{module}</span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {count} quiz{count !== 1 ? 'zes' : ''}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500">
                        {count} quiz{count !== 1 ? 'zes' : ''} available
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredModules.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <p className="text-lg mb-2">No modules found</p>
                <p className="text-sm">Try a different search term.</p>
              </div>
            )}
          </>
        ) : (

        /* ── Quiz list view for selected module ── */
          <>
            <div className="w-full max-w-6xl mb-6 flex flex-col items-center relative">
              {/* Text Stack */}
              <div className="text-center">
                <p className="text-gray-600 mb-1">
                  Select a quiz to begin revising.
                </p>
                <p className="text-xs font-medium uppercase tracking-widest text-gray-600 mb-2">
                  Module name: {selectedModule}
                </p>
              </div>

              {/* Searchbar */}
              <input
                type="text"
                placeholder="Search quizzes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />

              {/* Back Button */}
              <button
                onClick={() => { setSelectedModule(null); setSearchTerm(""); }}
                className="absolute left-0 p-2 text-gray-600 hover:bg-gray-100 hover:text-blue-600 rounded-full transition-colors"
                aria-label="Back to Modules"
              >
                <ArrowLeft size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
              {quizzesInModule.map(quiz => (
                <Card
                  key={quiz.id}
                  className="hover:shadow-lg transition cursor-pointer border-2 border-transparent hover:border-blue-200"
                  onClick={() => router.push(`/quiz/${quiz.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex justify-between items-start">
                      <span>{quiz.title}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {quiz.questions?.length || 0} Qs
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-3">
                      {quiz.description || "No description available"}
                    </p>
                    <div className="text-xs text-gray-500">
                      {quiz.questions?.length || 0} question{quiz.questions?.length !== 1 ? 's' : ''}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {quizzesInModule.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <p className="text-lg mb-2">No quizzes found</p>
                <p className="text-sm">Try a different search term.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}