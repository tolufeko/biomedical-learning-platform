// lib/constants/roles.ts
export const PRIVILEGED_ROLES = ['teacher', 'admin'] as const;
export type UserRole = 'student' | 'teacher' | 'admin' | 'guest';