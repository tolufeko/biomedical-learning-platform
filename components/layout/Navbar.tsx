'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import type { User } from '@supabase/supabase-js';
import { UserRole } from '@/lib/constants/roles';
import { UserProfile } from '@/lib/types/profile';

// ─── Nav link config ──────────────────────────────────────────────────────────

const ALL_LINKS = {
  home:        { href: '/home',        label: 'Home'        },
  admin:       { href: '/admin',       label: 'Admin'       },
  createQuiz:  { href: '/create-quiz', label: 'Create Quiz' },
  analytics:   { href: '/analytics',   label: 'Analytics'   },
  guide:       { href: '/guide',       label: 'Guide'       },
} as const;

type LinkKey = keyof typeof ALL_LINKS;

// Links available per role (current page is filtered out dynamically below)
const ROLE_LINKS: Record<UserRole, LinkKey[]> = {
  admin:   ['home', 'admin', 'createQuiz', 'analytics', 'guide'],
  teacher: ['home', 'createQuiz', 'analytics', 'guide'],
  student: ['home', 'analytics', 'guide'],
  guest:   ['home', 'guide'],
};

function getNavLinks(role: UserRole | null, pathname: string) {
  const keys = ROLE_LINKS[role ?? 'student'];
  return keys
    .map((k) => ALL_LINKS[k])
    // ✅ Filter the current page instead of 60-line switch blocks
    .filter((link) => !pathname.includes(link.href));
}

// ─── UserMenu ─────────────────────────────────────────────────────────────────

function UserMenu({ user, profile, onSignOut }: {
  user: User;           
  profile: UserProfile | null;
  onSignOut: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // ✅ Scoped to the .user-menu element — no global mousedown leak
  const handleClickOutside = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.user-menu')) setIsOpen(false);
  };

  // Attach/detach only while open
  useState(() => {
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    else         document.removeEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  return (
    <div className="relative user-menu">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="block text-gray-700 hover:text-blue-600 font-medium py-1.5"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        Profile
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="font-semibold text-gray-900 truncate">
              {profile?.username ?? user.email}
            </p>
            <p className="text-sm text-gray-500 capitalize">
              {profile?.role ?? 'temp'}
            </p>
          </div>

          <Link
            href="/update-password"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            Change Password
          </Link>

          <button
            onClick={async () => { setIsOpen(false); await onSignOut(); }}
            className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MobileMenu ───────────────────────────────────────────────────────────────

function MobileMenu({ user, profile, navLinks, onClose, onSignOut }: {
  user: User;           // ✅ Typed properly
  profile: UserProfile | null;
  navLinks: { href: string; label: string }[];
  onClose: () => void;
  onSignOut: () => Promise<void>;
}) {
  return (
    <div className="md:hidden bg-white border-t border-gray-200">
      <div className="px-4 py-4 space-y-3">
        <div className="pb-3 border-b border-gray-200">
          <p className="font-semibold text-gray-900">
            Hi, {profile?.username ?? user.email?.split('@')[0]}
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
          onClick={async () => { onClose(); await onSignOut(); }}
          className="w-full text-left text-red-600 hover:text-red-700 font-medium py-2"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export default function Navbar() {
  const pathname = usePathname();
  const { user, role, username, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const profile: UserProfile | null = user ? {
    id: user.id,
    email: user.email ?? '',
    username,
    role: role ?? 'guest',
  } : null;

  // ✅ Replaces the 60-line switch/if-else chain
  const navLinks = useMemo(
    () => getNavLinks(role, pathname ?? ''),
    [role, pathname]
  );

  if (loading) {
    return (
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="animate-pulse bg-gray-200 h-8 w-32 rounded" />
          </div>
        </div>
      </nav>
    );
  }

  if (!user) return null;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold text-blue-600">
            BioLearn
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-700 hover:text-blue-600 font-medium"
              >
                {link.label}
              </Link>
            ))}
            <UserMenu user={user} profile={profile} onSignOut={logout} />
          </div>

          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden text-gray-700 hover:text-blue-600 p-2"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <MobileMenu
          user={user}
          profile={profile}
          navLinks={navLinks}
          onClose={() => setMobileMenuOpen(false)}
          onSignOut={logout}
        />
      )}
    </nav>
  );
}