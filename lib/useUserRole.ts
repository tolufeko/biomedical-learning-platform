import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

type UserRole = 'guest' | 'student' | 'instructor' | 'admin';

interface UserProfile {
  role: UserRole;
  username: string | null;
}

export function useUserRole() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
      
      setLoading(false);
    }

    fetchProfile();
  }, [user]);

  return { profile, loading };
}