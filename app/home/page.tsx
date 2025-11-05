"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
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

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center mt-16 px-6">
        <h2 className="text-3xl font-semibold mb-8 text-gray-800">
          Welcome to your Biomedical Learning Hub
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
          {/* Revision Card */}
          <Card
            className="hover:shadow-lg transition cursor-pointer"
            onClick={() => router.push("/quiz")}
          >
            <CardHeader>
              <CardTitle>Revision Centre</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Access detailed biomedical revision materials, quizzes, and practice questions to
                prepare effectively.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}