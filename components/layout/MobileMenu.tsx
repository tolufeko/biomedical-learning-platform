'use client';

import Link from 'next/link';

interface MobileMenuProps {
  user: any;
  profile: any;
  navLinks: { href: string; label: string }[];
  onClose: () => void;
}

export default function MobileMenu({ user, profile, navLinks, onClose }: MobileMenuProps) {
  const handleSignOut = async () => {
    const { supabase } = await import('@/lib/supabaseClient');
    await supabase.auth.signOut();
    onClose();
    window.location.href = '/';
  };

  return (
    <div className="md:hidden pb-4 border-t">
      <div className="space-y-2">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block py-2 text-gray-700 hover:text-blue-600"
            onClick={onClose}
          >
            {link.label}
          </Link>
        ))}
        {user && (
          <button
            onClick={handleSignOut}
            className="block w-full text-left py-2 text-red-600"
          >
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
}