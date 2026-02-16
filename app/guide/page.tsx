'use client';

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useEffect } from "react";

export default function HelpPage() {
  const router = useRouter();
  const { user, role, username, loading: authLoading, logout } = useAuth();

  // Access check
  useEffect(() => {
    if (authLoading) return;
  
    if (!user) {
      router.push("/");
    }
  }, [user, role, authLoading, router]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
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
          {(role === 'teacher' || role === 'admin') && (
            <Link href="/teacher" className="text-gray-700 hover:text-blue-600 font-medium">
              Teacher View
            </Link>
          )}
          <Link href="/home" className="text-gray-700 hover:text-blue-600 font-medium">
            Home
          </Link>
          <button
            onClick={async () => {
              await logout();
              window.location.href = "/"; 
            }}
            className="text-gray-700 hover:text-blue-600 font-medium"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Help content */}
      <div className="flex flex-col items-center mt-16 px-6">
        <h2 className="text-3xl font-semibold mb-4">Help & Support</h2>
        <p className="text-gray-700 mb-6 text-center">
          This page provides guidance on how to use this website.
        </p>

        <div className="space-y-4 max-w-2xl">
          <section>
            <h3 className="text-xl font-bold mb-2">📘 How to Use the Platform</h3>
            <ul className="list-disc ml-6 text-gray-700">
              <li>Navigate through revision modules using the navigation bar.</li>
              <li>Access quizzes, diagrams, animations, and topic summaries.</li>
              <li>Your progress is automatically saved.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold mb-2">🛠 Common Issues</h3>
            <ul className="list-disc ml-6 text-gray-700">
              <li>If content isn’t loading, try refreshing the page.</li>
              <li>Make sure you’re logged in with your student account.</li>
              <li>Use Chrome, Edge or Firefox for best performance.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}