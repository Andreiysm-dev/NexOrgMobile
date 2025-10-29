// Mock role assignment system based on login email
// This allows testing different permission levels without a full backend

export type UserRole = 'member' | 'officer' | 'admin';

export interface MockUser {
  email: string;
  role: UserRole;
  name: string;
}

// Mock role assignments based on email
const MOCK_ROLE_ASSIGNMENTS: Record<string, MockUser> = {
  'andrei@admin.com': {
    email: 'andrei@admin.com',
    role: 'admin',
    name: 'Admin User'
  },
  'officer@test.com': {
    email: 'officer@test.com',
    role: 'officer',
    name: 'Officer User'
  },
  // Add more test accounts as needed
  'member@test.com': {
    email: 'member@test.com',
    role: 'member',
    name: 'Member User'
  }
};

/**
 * Get user role based on email address
 * @param email - User's email address from Supabase auth
 * @returns UserRole - The role assigned to this email, defaults to 'member'
 */
export function getUserRole(email: string): UserRole {
  const mockUser = MOCK_ROLE_ASSIGNMENTS[email.toLowerCase()];
  return mockUser?.role || 'member';
}

/**
 * Get full mock user data based on email
 * @param email - User's email address from Supabase auth
 * @returns MockUser - Full user data including name and role
 */
export function getMockUser(email: string): MockUser {
  const mockUser = MOCK_ROLE_ASSIGNMENTS[email.toLowerCase()];
  return mockUser || {
    email,
    role: 'member',
    name: 'User'
  };
}

/**
 * Check if user has admin permissions
 * @param email - User's email address
 * @returns boolean - True if user is admin
 */
export function isAdmin(email: string): boolean {
  return getUserRole(email) === 'admin';
}

/**
 * Check if user has officer or admin permissions
 * @param email - User's email address
 * @returns boolean - True if user is officer or admin
 */
export function canPostAnnouncements(email: string): boolean {
  const role = getUserRole(email);
  return role === 'officer' || role === 'admin';
}

/**
 * Check if user can manage organization members
 * @param email - User's email address
 * @returns boolean - True if user is admin
 */
export function canManageMembers(email: string): boolean {
  return isAdmin(email);
}
