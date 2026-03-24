// app/update-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/supabaseClient";
import Link from "next/link";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/");
      else setUser(user);
    });
  }, [router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match!");
      setMessageType("error");
      return;
    }

    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters long.");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setMessage("Error updating password: " + error.message);
        setMessageType("error");
      } else {
        setMessage("Password changed successfully! Redirecting...");
        setMessageType("success");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => router.push("/"), 2000);
      }
    } catch (err) {
      setMessage("An unexpected error occurred. Please try again.");
      setMessageType("error");
      console.error("Change password error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
          Change Password
        </h1>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Confirm New Password
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

          {message && (
            <div className={`text-sm text-center p-3 rounded-lg ${
              messageType === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
            }`}>
              {message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? "Updating..." : "Change Password"}
            </button>
            <Link
              href="/"
              className="flex-1 bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg hover:bg-gray-300 transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}