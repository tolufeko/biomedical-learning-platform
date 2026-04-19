// app/register/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/supabaseClient";
import { useAuth } from "@/lib/auth/AuthContext";

export default function SignUpPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user) router.push("/home");
  }, [user, router]);

  if (user) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      const params = new URLSearchParams({ username, password, confirmPassword });
      const check = await fetch(`/api/create-profile?${params}`);
      const result = await check.json();
      
      if (!check.ok) {
        alert(result.error);
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.user || !data.session) throw new Error("User creation failed");
  
      const res = await fetch("/api/create-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ username, role: "student" }),
      });
  
      const profileResult = await res.json();
      if (!res.ok) {
        await supabase.auth.signOut();
        alert(profileResult.error || "Registration failed");
        return;
      }
  
      router.push("/home");
    } catch (error: any) {
      console.error("Signup error:", error);
      alert("Registration failed: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
          Create an Account
        </h1>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. bobby123"
            />
            <p className="text-xs text-gray-500 mt-1">
              3-20 characters, letters, numbers, and underscores only
            </p>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="name@email.com"
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
            <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full font-semibold py-2 rounded-lg transition-colors ${
              loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-600 mt-2">
          Already have an account?{" "}
          <Link href="/" className="text-blue-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}