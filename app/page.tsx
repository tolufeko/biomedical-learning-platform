"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);

  // Listen to auth changes (login/logout) and update state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) fetchUserRole(session.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!error && profileData) {
      setRole(profileData.role);
      return profileData.role;
    }
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Login failed: " + error.message);
      return;
    }

    if (data.user?.id) {
      const userRole = await fetchUserRole(data.user.id);
      
      if (userRole === "admin") {
        router.push("/admin");
      } else {
        router.push("/home");
      }
    }
  };

  const handleAnonymousRegister = async () => {
    const guestUser = {
      id: `guest-${Date.now()}`,
      email: "guest@temporary.com",
      role: "guest"
    };

    sessionStorage.setItem('guestUser', JSON.stringify(guestUser));
    setUser(guestUser);
    setRole("guest");
    
    router.push("/home");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-8">

        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
          Biomedical Learning Platform
        </h1>

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
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Log In
          </button>

          <button
            type="button"
            onClick={handleAnonymousRegister}
            className="w-full bg-gray-600 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors">
            Continue as Guest
          </button>
        </form>

        <p className="text-sm text-center text-gray-600 mt-4">
          Don't have an account?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>

      </div>
    </main>
  );
}