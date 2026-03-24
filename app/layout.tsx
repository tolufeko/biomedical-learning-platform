import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Navbar from '@/components/layout/Navbar';
import { AuthProvider } from "@/lib/auth/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Biomedical Learning Platform",
  description: "biomedical education and learning system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        
        <AuthProvider>
          <Navbar /> 
          <main>{children}</main>
        </AuthProvider>

        <footer className="bg-white border-t py-6">
          <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} Biomedical Learning Platform
          </div>
        </footer>
      </body>
    </html>
  );
}