"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { username, role, user, logout } = useAuth(); // ✅ All in one

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // ✅ Use global auth state for access control
  useEffect(() => {
    if (role === null) {
      // Still loading
      return;
    }
    if (role !== "admin") {
      router.push("/home");
      return;
    }
    fetchUsers();
    setLoading(false);
  }, [role, router]);

  // ✅ Filter out current user + apply search
  useEffect(() => {
    if (!user) return;

    const filtered = users
      .filter(u => u.id !== user.id) // Exclude current admin
      .filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    setFilteredUsers(filtered);
  }, [searchTerm, users, user]);

  const fetchUsers = async () => {
    try {
      setMessage("");
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, email, role")
        .limit(1000);

      if (error) throw error;
      setUsers(profiles || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      setMessage(`Error loading users: ${error.message}`);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setUpdating(userId);
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setMessage(`Role updated successfully to ${newRole}`);
    } catch (error: any) {
      console.error("Error updating role:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    if (confirm(`Change role to ${newRole}?`)) {
      updateUserRole(userId, newRole);
    }
  };

  if (loading || role === null) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (role !== "admin") return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
        <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
        <div className="flex gap-6 items-center">
          {username || "Guest"}
          <Link href="/teacher" className="text-gray-700 hover:text-blue-600 font-medium">
            Teacher View
          </Link>
          <Link href="/home" className="text-gray-700 hover:text-blue-600 font-medium">
            Home
          </Link>
          <Link href="/guide" className="text-gray-700 hover:text-blue-600 font-medium">
            Guide
          </Link>
          <button
            onClick={async () => {
              await logout();
              window.location.href = "/"; // ✅ Hard redirect
            }}
            className="text-gray-700 hover:text-blue-600 font-medium"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* User Management */}
      <div className="p-6 bg-white rounded-lg shadow-md mt-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">User Management</h2>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by username, email, role, or user ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchUsers}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh Users
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          }`}>
            {message}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-3 text-left font-semibold">Username</th>
                <th className="border p-3 text-left font-semibold">Email</th>
                <th className="border p-3 text-left font-semibold">Role</th>
                <th className="border p-3 text-left font-semibold">Change Role</th>
                <th className="border p-3 text-left font-semibold">User ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border p-3 text-center text-gray-500">
                    {users.length === 0 ? "No users found" : "No matching users"}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="border p-3 font-medium">{u.username}</td>
                    <td className="border p-3">{u.email || "No email"}</td>
                    <td className="border p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        u.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800'
                          : u.role === 'teacher'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="border p-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={updating === u.id}
                        className="p-2 border rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                      </select>
                      {updating === u.id && (
                        <span className="ml-2 text-sm text-gray-500">Updating...</span>
                      )}
                    </td>
                    <td className="border p-3 text-sm text-gray-600 font-mono">
                      {u.id.substring(0, 8)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}