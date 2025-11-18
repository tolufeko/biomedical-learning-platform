"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut } from "@/public/lib/utils";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
        <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
        <div className="flex gap-6 items-center">
          <Link href="" className="text-gray-700 hover:text-blue-600 font-medium">
            Change Password
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

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center mt-16 px-6">
        <h2 className="text-3xl font-semibold mb-8 text-gray-800">
          Welcome to your Biomedical Learning Hub
        </h2>

        <p className="text-gray-700 mb-6">
          Please click on the subject area you wish to revise.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
          {/* Revision Cards */}
          <Card
            className="hover:shadow-lg transition cursor-pointer"
            onClick={() => router.push("/quiz?subject=Neurophysiology")}
          >
            <CardHeader>
              <CardTitle> NEUROPHYSIOLOGY </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                The study of how the nervous system functions, including how neurons communicate and control body processes.
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition cursor-pointer"
            onClick={() => router.push("/quiz?subject=Biomechanics")}
          >
            <CardHeader>
              <CardTitle> BIOMECHANICS </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                The application of mechanical principles to understand how biological structures move and bear forces.
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition cursor-pointer"
            onClick={() => router.push("/quiz?subject=Cardiorespiratory_Physiology")}
          >
            <CardHeader>
              <CardTitle> CARDIORESPIRATORY PHYSIOLOGY </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                The study of how the heart, lungs, and blood vessels work together to deliver oxygen and remove carbon dioxide from the body.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}