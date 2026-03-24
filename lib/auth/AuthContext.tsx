// lib/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase/supabaseClient";
import type { User, Session } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/constants/roles";

interface AuthContextType {
  user: User | null; // ✅ Typed with Supabase's User instead of any
  role: UserRole | null; // ✅ Typed role
  username: string | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  username: null,
  loading: true,
  refreshUser: async () => {},
  logout: async () => {},
});

// ✅ Explicit guard instead of silent fallback to "student"
function parseRole(raw: string | null | undefined): UserRole | null {
  if (raw === "student" || raw === "teacher" || raw === "admin" || raw === "guest") return raw;
  return null;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null); // ✅ No more any
  const [role, setRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setRole(null);
    setUsername(null);
    setLoading(false);
  }, []);

  const handleAuthSession = useCallback(async (session: Session) => { // ✅ Typed Session instead of any
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
        setRole(parseRole(profileData.role)); // ✅ Validated, no silent fallback
        setUsername(profileData.username ?? null);
      } else {
        // ✅ Unknown profile state: clear role rather than assume "student"
        setRole(null);
        setUsername(null);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setRole(null); // ✅ Same here — don't grant a role on error
      setUsername(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    setLoading(true);

    // ✅ getUser() instead of getSession() — cryptographically verified server-side
    const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();

    if (error || !verifiedUser) {
      clearAuthState();
      return;
    }

    // getUser() doesn't return a full Session object, so we build
    // what handleAuthSession actually needs: just session.user
    await handleAuthSession({ user: verifiedUser } as Session);
  }, [clearAuthState, handleAuthSession]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Supabase signOut failed:", error);
    }
    clearAuthState();
  }, [clearAuthState]);

  useEffect(() => {
    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        handleAuthSession(session); // ✅ session here IS a full Session — safe to pass
      } else {
        clearAuthState();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [fetchUser, handleAuthSession, clearAuthState]);

  return (
    <AuthContext.Provider value={{ user, role, username, loading, refreshUser: fetchUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);