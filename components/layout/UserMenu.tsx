'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UserMenuProps {
  user: any;
  profile: any;
}

export default function UserMenu({ user, profile }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-menu')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    const { supabase } = await import('@/lib/supabaseClient');
    await supabase.auth.signOut();
    setIsOpen(false);
    window.location.href = '/'; // Force refresh
  };

  return (
    <div className="user-menu relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 focus:outline-none"
      >
        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center">
          {profile?.username?.charAt(0).toUpperCase() || user.email?.charAt(0)}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md py-1">
          <div className="px-4 py-2 border-b text-sm">
            <p className="font-medium">{profile?.username || user.email}</p>
            <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
          </div>
          <Link 
            href="/profile" 
            className="block px-4 py-2 hover:bg-gray-100"
            onClick={() => setIsOpen(false)}
          >
            My Profile
          </Link>
          <button
            onClick={handleSignOut}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}