"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";

interface AuthContextType {
  user: any | null;
  role: string | null;
  username: string | null;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  username: null,
  refreshUser: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const fetchUser = async () => {
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
  };

  useEffect(() => {
    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        supabase.from("profiles")
          .select("role, username")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setRole(data.role);
              setUsername(data.username ?? null);
            }
          });
      } else {
        setRole(null);
        setUsername(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, username, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);