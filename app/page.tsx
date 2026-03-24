"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/supabaseClient";
import { useAuth } from "@/lib/auth/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string>("");


  useEffect(() => {
    if (!loading && user) {
      router.push("/home");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </main>
    );
  }

  if (user) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    
    if (authError) {
      setError("Invalid email or password");
      return;
    }
    
    router.push("/home");
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/forgot-password`,
    });

    if (error) {
      setResetMessage("Error: " + error.message);
    } else {
      setResetMessage("Password reset email sent! Check your inbox.");
      setResetEmail("");
      setTimeout(() => {
        setShowResetForm(false);
        setResetMessage("");
      }, 3000);
    }
  };

  // ✅ SECURE: Use Supabase anonymous auth
  const handleAnonymousLogin = async () => {
    setGuestLoading(true);
    
    const { data, error } = await supabase.auth.signInAnonymously();
    
    if (error) {
      console.error("Anonymous sign-in error:", error);
      alert("Failed to sign in as guest. Please try again.");
      setGuestLoading(false);
      return;
    }

    // ✅ Create user profile with 'guest' role in database
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          role: 'guest',
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
      }
    }

    setGuestLoading(false);
    router.push("/home");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
          Biomedical Learning Platform
        </h1>

        {error && (
          <div className="text-red-500 text-sm mt-2 text-center">
            {error}
          </div>
        )}

        {!showResetForm ? (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
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
                  className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowResetForm(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Forgot password?
              </button>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Log In
              </button>

              <button
                type="button"
                onClick={handleAnonymousLogin}
                disabled={guestLoading}
                className="w-full bg-gray-600 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400"
              >
                {guestLoading ? "Loading..." : "Continue as Guest"}
              </button>
            </form>

            <p className="text-sm text-center text-gray-600 mt-4">
              Don't have an account?{" "}
              <Link href="/register" className="text-blue-600 hover:underline">
                Register
              </Link>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
              Reset Password
            </h2>
            <p className="text-sm text-gray-600 text-center mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="name@email.com"
                />
              </div>

              {resetMessage && (
                <p
                  className={`text-sm text-center ${
                    resetMessage.startsWith("Error")
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {resetMessage}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Send Reset Link
              </button>
              
              <button
                onClick={() => {
                  setShowResetForm(false);
                  setResetMessage("");
                }}
                className="w-full bg-gray-600 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to login
              </button> 

            </form>
          </>
        )}
      </div>
    </main>
  );
}