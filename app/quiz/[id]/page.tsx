'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import H5PPlayer from "@/components/H5PPlayer";
import { signOut } from "@/public/lib/utils";

export default function QuizPage() {
  const { id } = useParams();
  const [quizData, setQuizData] = useState<any>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/get-quiz/${id}`)
      .then((res) => res.json())
      .then((data) => setQuizData(data.h5p_parameters));
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
        <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
        <div className="flex gap-6 items-center">
          <Link href="/home" className="text-gray-700 hover:text-blue-600 font-medium">Home</Link>
          <Link href="" className="text-gray-700 hover:text-blue-600 font-medium">Change Password</Link>
          <Link href="/guide" className="text-gray-700 hover:text-blue-600 font-medium">Guide</Link>
          <button onClick={signOut} className="text-gray-700 hover:text-blue-600 font-medium">Sign Out</button>
        </div>
      </nav>

      <main className="flex flex-col items-center mt-16 px-6">
        <h2 className="text-3xl font-semibold mb-8 text-gray-800">
          {id} Quiz
        </h2>

        <div className="w-full max-w-3xl">
          <H5PPlayer path="practice-questions" />
        </div>
      </main>
    </div>
  );
}
