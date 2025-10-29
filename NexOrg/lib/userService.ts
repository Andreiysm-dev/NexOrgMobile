import { supabase } from './supabase';
import { getUserRole, type UserRole } from './mockRoles';

// Interface that matches your ACTUAL database structure
export interface ProfileData {
  user_id: string;
  full_name: string;
  course: string;
  role: string;
  created_at: string;
}

// Interface for form data (includes fields you plan to add later)
export interface MembershipFormData {
  full_name: string;
  course: string;
  role?: string;
  // Fields you plan to add later but don't exist yet:
  yearLevel?: string;
  student_id?: string;
  phone_number?: string;
  // ... other future fields
}

/**
 * Save only the fields that exist in the database
 */
export async function saveUserProfile(userId: string, formData: MembershipFormData) {
  try {
    // Only include fields that exist in your profiles table
    const profileToSave = {
      user_id: userId,
      full_name: formData.full_name,
      course: formData.course,
      role: formData.role || 'student',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileToSave, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving profile:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in saveUserProfile:', error);
    throw error;
  }
}

/**
 * Fetch users from profiles table with proper mapping
 */
export async function fetchUsersFromProfiles(): Promise<EnrichedUser[]> {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        user_id,
        full_name,
        course,
        role,
        created_at
      `);

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    return users.map(user => ({
      id: user.user_id,
      email: '', // Not available in profiles table
      name: user.full_name || 'User',
      role: user.role as UserRole || 'student',
      course: user.course || '',
      yearLevel: undefined, // Field doesn't exist yet
      created_at: user.created_at
    }));

  } catch (error) {
    console.error('Error in fetchUsersFromProfiles:', error);
    return [];
  }
}

export interface EnrichedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  course?: string;
  yearLevel?: string; // Optional since it doesn't exist in DB yet
  created_at: string;
}
