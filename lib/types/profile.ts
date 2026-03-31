// lib/types/profile.ts
export interface UserProfile {
    id: string;
    username: string;
    email: string;
    role: string;
}

export type UserRole = 'student' | 'teacher' | 'admin'| 'guest';