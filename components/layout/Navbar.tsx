'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ✅ INLINED USER MENU COMPONENT
function UserMenu({ user, profile }: { user: any; profile: any }) {
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
    window.location.href = '/';
  };

  return (
    <div className="relative user-menu">
      {/* ✅ TEXT TRIGGER: "Profile" (styled like nav links) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="block text-gray-700 hover:text-blue-600 font-medium py-1.5"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        Profile
      </button>

      {/* ✅ DROPDOWN APPEARS ON CLICK */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* User info header */}
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="font-semibold text-gray-900 truncate">
              {profile?.username || user.email}
            </p>
            <p className="text-sm text-gray-500">{profile?.role || 'User'}</p>
          </div>

          <Link
            href="/update-password"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            Change Password
          </Link>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ✅ INLINED MOBILE MENU COMPONENT
function MobileMenu({
  user,
  profile,
  navLinks,
  onClose,
}: {
  user: any;
  profile: any;
  navLinks: { href: string; label: string }[];
  onClose: () => void;
}) {
  const handleSignOut = async () => {
    const { supabase } = await import('@/lib/supabaseClient');
    await supabase.auth.signOut();
    onClose();
    window.location.href = '/';
  };

  return (
    <div className="md:hidden bg-white border-t border-gray-200">
      <div className="px-4 py-4 space-y-3">
        <div className="pb-3 border-b border-gray-200">
          <p className="font-semibold text-gray-900">
            Hi, {profile?.username || user.email?.split('@')[0]}
          </p>
        </div>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block text-gray-700 hover:text-blue-600 font-medium py-2"
            onClick={onClose}
          >
            {link.label}
          </Link>
        ))}
        <button
          onClick={handleSignOut}
          className="w-full text-left text-red-600 hover:text-red-700 font-medium py-2"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ✅ MAIN NAVBAR COMPONENT
export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authStateChange = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      setIsLoading(false);

      if (currentUser) {
        supabase
          .from('profiles')
          .select('username, role')
          .eq('id', currentUser.id)
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.warn('Profile fetch failed (using fallback):', error.message);
              setProfile({
                username: currentUser.email?.split('@')[0] || 'User',
                role: 'student'
              });
            } else {
              setProfile(data);
            }
          });
      } else {
        setProfile(null);
      }
    });

    const subscription = authStateChange.data.subscription;
    return () => subscription.unsubscribe();
  }, []);

  // ✅ NAVIGATION LOGIC (page-aware + role-based)
  const navLinks = useMemo(() => {
    if (!user) return [];

    switch (profile?.role) {
      case 'admin':
        if (pathname?.includes('/admin')) {
          return [
            { href: '/home', label: 'Home' },
            { href: '/create-quiz', label: 'Create Quiz' },
            { href: '/analytics', label: 'Analytics' },
            { href: '/guide', label: 'Guide' },
          ];
        } else if (pathname?.includes('/analytics')) {
          return [
            { href: '/home', label: 'Home' },
            { href: '/admin', label: 'Admin' },
            { href: '/create-quiz', label: 'Create Quiz' },
            { href: '/guide', label: 'Guide' },
          ];
        } else if (pathname?.includes('/guide')) {
          return [
            { href: '/home', label: 'Home' },
            { href: '/admin', label: 'Admin' },
            { href: '/create-quiz', label: 'Create Quiz' },
            { href: '/analytics', label: 'Analytics' },
          ];
        } else if (pathname?.includes('/home')) {
          return [
            { href: '/admin', label: 'Admin' },
            { href: '/create-quiz', label: 'Create Quiz' },
            { href: '/analytics', label: 'Analytics' },
            { href: '/guide', label: 'Guide' },
          ];
        } else if (pathname?.includes('/create-quiz')) {
          return [
            { href: '/home', label: 'Home' },
            { href: '/admin', label: 'Admin' },
            { href: '/analytics', label: 'Analytics' },
            { href: '/guide', label: 'Guide' },
          ];
        } else {
          return [
            { href: '/home', label: 'Home' },
            { href: '/admin', label: 'Admin' },
            { href: '/create-quiz', label: 'Create Quiz' },
            { href: '/analytics', label: 'Analytics' },
            { href: '/guide', label: 'Guide' },
          ];
        }

      case 'teacher':
        if (pathname?.includes('/analytics')) {
          return [
            { href: '/home', label: 'Home' },
            { href: '/create-quiz', label: 'Create Quiz' },
            { href: '/guide', label: 'Guide' },
          ];
        } else if (pathname?.includes('/guide')) {
          return [
            { href: '/home', label: 'Home' },
            { href: '/create-quiz', label: 'Create Quiz' },
            { href: '/analytics', label: 'Analytics' },
          ];
        } else if (pathname?.includes('/home')) {
          return [
            { href: '/create-quiz', label: 'Create Quiz' },
            { href: '/analytics', label: 'Analytics' },
            { href: '/guide', label: 'Guide' },
          ];
        } else if (pathname?.includes('/create-quiz')) {
          return [
            { href: '/home', label: 'Home' },
            { href: '/analytics', label: 'Analytics' },
            { href: '/guide', label: 'Guide' },
          ];
        } else {
          return [
            { href: '/home', label: 'Home' },
            { href: '/create-quiz', label: 'Create Quiz' },
            { href: '/analytics', label: 'Analytics' },
            { href: '/guide', label: 'Guide' },
          ];
        }

      default:
        // Handles teacher, student, and other roles
        if (pathname?.includes('/analytics')) {
          return [
            { href: '/home', label: 'Home' },
            { href: '/guide', label: 'Guide' },
          ];
        } else if (pathname?.includes('/guide')) {
          return [
            { href: '/home', label: 'Home' },
            { href: '/analytics', label: 'Analytics' },
          ];
        } else if (pathname?.includes('/home')) {
          return [
            { href: '/analytics', label: 'Analytics' },
            { href: '/guide', label: 'Guide' },
          ];
        } else {
          return [
            { href: '/home', label: 'Home' },
            { href: '/analytics', label: 'Analytics' },
            { href: '/guide', label: 'Guide' },
          ];
        }
      
    }
  }, [user, profile, pathname]);

  // ✅ LOADING STATE
  if (isLoading) {
    return (
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="animate-pulse bg-gray-200 h-8 w-32 rounded"></div>
          </div>
        </div>
      </nav>
    );
  }

  // ✅ HIDE NAVBAR IF NO USER (not logged in)
  if (!user) {
    return null;
  }

  // ✅ MAIN NAVBAR RENDER - ALL LINKS ON RIGHT
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo (LEFT) */}
          <Link href="/" className="text-xl font-bold text-blue-600">
            BioLearn
          </Link>

          {/* Desktop Navigation + Auth (ALL ON RIGHT) */}
          <div className="hidden md:flex items-center space-x-8">
            {/* ✅ All nav links aligned to the right */}
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-700 hover:text-blue-600 font-medium"
              >
                {link.label}
              </Link>
            ))}
            
            {/* ✅ Profile menu on the right */}
            <UserMenu user={user} profile={profile} />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-gray-700 hover:text-blue-600 p-2"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <MobileMenu
          user={user}
          profile={profile}
          navLinks={navLinks}
          onClose={() => setMobileMenuOpen(false)}
        />
      )}
    </nav>
  );
}