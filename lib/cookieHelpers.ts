// lib/cookieHelpers.ts

export interface GuestUser {
    id: string;
    email: string;
    role: string;
  }
  
  export function setGuestUserCookie(guestUser: GuestUser) {
    const cookieValue = JSON.stringify(guestUser);
    // Set cookie for 7 days
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    
    document.cookie = `guestUser=${encodeURIComponent(cookieValue)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  }
  
  export function getGuestUserCookie(): GuestUser | null {
    const cookies = document.cookie.split('; ');
    const guestCookie = cookies.find(cookie => cookie.startsWith('guestUser='));
    
    if (!guestCookie) return null;
    
    try {
      const cookieValue = decodeURIComponent(guestCookie.split('=')[1]);
      return JSON.parse(cookieValue);
    } catch (error) {
      console.error('Error parsing guest user cookie:', error);
      return null;
    }
  }
  
  export function clearGuestUserCookie() {
    document.cookie = 'guestUser=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict';
  }