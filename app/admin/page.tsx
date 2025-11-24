"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/public/lib/supabaseClient";
import Link from "next/link";
import { signOut } from "@/public/lib/utils";
import { useAuth } from "@/public/lib/AuthContext";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const { username, role } = useAuth();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (userRole === "admin") {
      fetchUsers();
    }
  }, [userRole]);

  useEffect(() => {
    const filtered = users.filter(user =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        router.push("/home");
        return;
      }

      if (profile?.role !== "admin") {
        router.push("/home");
        return;
      }

      setUserRole(profile.role);
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/home");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setMessage("");
      
      // Only select columns that exist in your table
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, email, role")
        .limit(1000);

      if (error) {
        console.error("Supabase query error:", error);
        setMessage(`Error loading users: ${error.message}`);
        return;
      }

      setUsers(profiles || []);
      setFilteredUsers(profiles || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setUpdating(userId);
      setMessage("");

      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      // Update local state
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );

      setMessage(`Role updated successfully to ${newRole}`);
    } catch (error: any) {
      console.error("Error updating role:", error);
      setMessage(`Error updating role: ${error.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    if (confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      updateUserRole(userId, newRole);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (userRole !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
        <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
        <div className="flex gap-6 items-center">
          {username ? `${username}` : "Guest"}
          {(role === 'teacher' || role === 'admin') && (
          <Link href="teacher/" className="text-gray-700 hover:text-blue-600 font-medium">
            Teacher View
          </Link>
          )}
          <Link href="home/" className="text-gray-700 hover:text-blue-600 font-medium">
            Home
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
      
        {/* User Management Section */}
        <div className="p-6 bg-white rounded-lg shadow-md mt-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">User Management</h2>
          
          {/* Search and Refresh */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input
              type="text"
              placeholder="Search by username, email, role, or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={fetchUsers}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Refresh Users
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}>
              {message}
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 p-3 text-left font-semibold">Username</th>
                  <th className="border border-gray-200 p-3 text-left font-semibold">Email</th>
                  <th className="border border-gray-200 p-3 text-left font-semibold">Current Role</th>
                  <th className="border border-gray-200 p-3 text-left font-semibold">Change Role</th>
                  <th className="border border-gray-200 p-3 text-left font-semibold">User ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border border-gray-200 p-3 text-center text-gray-500">
                      {users.length === 0 ? "No users found in database" : "No users match your search"}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="border border-gray-200 p-3 font-medium">
                        {user.username}
                      </td>
                      <td className="border border-gray-200 p-3">
                        {user.email || "No email"}
                      </td>
                      <td className="border border-gray-200 p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800'
                            : user.role === 'teacher'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="border border-gray-200 p-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={updating === user.id}
                          className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                          <option value="admin">Admin</option>
                        </select>
                        {updating === user.id && (
                          <span className="ml-2 text-sm text-gray-500">Updating...</span>
                        )}
                      </td>
                      <td className="border border-gray-200 p-3 text-sm text-gray-600 font-mono">
                        {user.id.substring(0, 8)}...
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>
      </div>
  );
}