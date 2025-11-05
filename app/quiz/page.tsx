"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import H5PPlayer from '@/components/H5PPlayer';

export default function QuizPage() {
  const router = useRouter();

  const handleSignOut = () => {
    // Add your sign-out logic here (e.g., clear auth, call API)
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
        <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
        <div className="flex gap-6 items-center">
          <Link href="/home" className="text-gray-700 hover:text-blue-600 font-medium">
            Home
          </Link>
          <Link href="" className="text-gray-700 hover:text-blue-600 font-medium">
            Change Password
          </Link>
          <Link href="" className="text-gray-700 hover:text-blue-600 font-medium">
            Guide
          </Link>
          <button
            onClick={handleSignOut}
            className="text-gray-700 hover:text-blue-600 font-medium">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="flex flex-col items-center mt-16 px-6">
        <h2 className="text-3xl font-semibold mb-8 text-gray-800">
          Bio Quiz
        </h2>
        <div className="w-full max-w-3xl">
          <H5PPlayer path="practice-questions" />
        </div>
      </main>
    </div>
  );
}