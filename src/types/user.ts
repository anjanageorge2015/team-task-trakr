export type UserRole = 'Admin' | 'Engineer';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  roles: UserRole[];
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
  created_by?: string;
}

export const USER_ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'Admin', label: 'Administrator', description: 'Full access to all features and user management' },
  { value: 'Engineer', label: 'Engineer', description: 'Access to task management and technical features' },
];