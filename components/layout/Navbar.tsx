'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import UserMenu from './UserMenu';
import MobileMenu from './MobileMenu';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // ✅ Added mobile state

  useEffect(() => {
    // Get initial user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, role, avatar_url')
          .eq('id', user.id)
          .single();

        setProfile(profile);
      }
    };

    getUser();

    // ✅ FIXED: Correct destructuring syntax
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        supabase
          .from('profiles')
          .select('username, role, avatar_url')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => setProfile(data));
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Navigation logic based on role...
  const navLinks = user ? (
    profile?.role === 'admin' ? [
      { href: '/admin', label: 'Dashboard' },
      { href: '/admin/quizzes', label: 'Quizzes' },
    ] : profile?.role === 'teacher' ? [
      { href: '/teacher', label: 'Dashboard' },
      { href: '/teacher/quizzes', label: 'My Quizzes' },
    ] : [
      { href: '/student', label: 'Dashboard' },
      { href: '/student/quizzes', label: 'Quizzes' },
    ]
  ) : [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
  ];

  return (
    <nav className="fixed w-full bg-white z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="font-bold text-xl text-blue-600">
            Quiz Platform
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth/User Menu */}
          <div className="flex items-center space-x-4">
            {user ? (
              <UserMenu user={user} profile={profile} /> // ✅ Pass user and profile
            ) : (
              <Link href="/auth/sign-in" className="text-blue-600 hover:text-blue-700">
                Sign In
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} 
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu - conditionally rendered */}
        {mobileMenuOpen && (
          <MobileMenu 
            user={user} 
            profile={profile} 
            navLinks={navLinks} 
            onClose={() => setMobileMenuOpen(false)}
          />
        )}
      </div>
    </nav>
  );
}