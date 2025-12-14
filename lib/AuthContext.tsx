// lib/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { getGuestUserCookie, clearGuestUserCookie } from "lib/cookieHelpers";

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

  const fetchUser = async () => {
    setLoading(true);
    
    // First check for Supabase authenticated user
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (currentUser?.id) {
      setUser(currentUser);
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("role, username")
        .eq("id", currentUser.id)
        .single();

      if (!error && profileData) {
        setRole(profileData.role);
        setUsername(profileData.username ?? null);
      }
    } else {
      // Check for guest user in cookie
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
    }
    
    setLoading(false);
  };

  const logout = async () => {
    // Clear Supabase session
    await supabase.auth.signOut();
    
    // Clear guest user cookie
    clearGuestUserCookie();
    
    // Reset state
    setUser(null);
    setRole(null);
    setUsername(null);
  };

  useEffect(() => {
    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true);

        if (session?.user?.id) {
          setUser(session.user);
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
          // Check for guest user when no Supabase session
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
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);