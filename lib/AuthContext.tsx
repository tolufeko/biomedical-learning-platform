// lib/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";

interface AuthContextType {
  user: any | null;
  role: string | null;
  username: string | null;
  loading: boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  username: null,
  loading: true,
  refreshUser: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    if (currentUser?.id) {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("role, username")
        .eq("id", currentUser.id)
        .single();

      if (!error && profileData) {
        setRole(profileData.role);
        setUsername(profileData.username ?? null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(true);

        if (session?.user?.id) {
          const { data: profileData, error } = await supabase
            .from("profiles")
            .select("role, username")
            .eq("id", session.user.id)
            .single();

          if (!error && profileData) {
            setRole(profileData.role);
            setUsername(profileData.username ?? null);
          }
        } else {
          setRole(null);
          setUsername(null);
        }

        setLoading(false);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);