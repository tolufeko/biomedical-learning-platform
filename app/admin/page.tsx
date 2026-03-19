// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, role, username, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // ✅ Use global auth state for access control
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push("/");
    } else if (role !== 'admin') {
      router.push("/home");
    }
  }, [user, role, authLoading, router]);

  // ✅ Filter out current user + apply search
  useEffect(() => {
    if (!user) return;

    const filtered = users
      .filter(u => u.id !== user.id)
      .filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    setFilteredUsers(filtered);
  }, [searchTerm, users, user]);

  // ✅ Use API route instead of direct Supabase client
  const fetchUsers = async () => {
    try {
      setMessage("");
      const response = await fetch('/api/admin-users');
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const profiles = await response.json();
      setUsers(profiles || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      setMessage(`Error loading users: ${error.message}`);
    }
  };

  // ✅ Use API route for updates
  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setUpdating(userId);
      const response = await fetch('/api/adminusers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!response.ok) throw new Error('Failed to update role');

      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
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