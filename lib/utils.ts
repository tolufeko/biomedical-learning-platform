import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "./supabaseClient";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Error signing out:", error.message);
    return;
  }

  window.location.href = "/";
};

