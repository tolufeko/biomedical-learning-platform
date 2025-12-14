"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient"; // ✅ Use absolute path
import { getGuestUserCookie, clearGuestUserCookie } from "@/lib/cookieHelpers"; // ✅ Absolute path

interface AuthContextType {
  user: any | null;
  role: string | null;
  username: string | null;
  loading: boolean;
  refreshUser: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  username: null,
  loading: true,
  refreshUser: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleAuthSession = async (session: any) => {
    setLoading(true);
    const currentUser = session.user;
    setUser(currentUser);

    try {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("role, username")
        .eq("id", currentUser.id)
        .single();

      if (!error && profileData) {
        setRole(profileData.role);
        setUsername(profileData.username || null);
      } else {
        setRole("student");
        setUsername(null);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setRole("student");
      setUsername(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      await handleAuthSession(session);
    } else {
      const guestUser = getGuestUserCookie();
      if (guestUser) {
        setUser(guestUser);
        setRole(guestUser.role);
        setUsername(null);
      } else {
        setUser(null);
        setRole(null);
        setUsername(null);
      }
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Supabase signOut failed:", error);
    }
    clearGuestUserCookie();
    setUser(null);
    setRole(null);
    setUsername(null);
  };

  useEffect(() => {
    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          handleAuthSession(session);
        } else {
          const guestUser = getGuestUserCookie();
          if (guestUser) {
            setUser(guestUser);
            setRole(guestUser.role);
            setUsername(null);
          } else {
            setUser(null);
            setRole(null);
            setUsername(null);
          }
          setLoading(false);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        username,
        loading,
        refreshUser: fetchUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);