import { supabase } from './supabase';

export interface PublicProfile {
  user_id: string;
  full_name: string;
  profile_image?: string;
  cover_photo?: string;
  course?: string;
  year?: number;
  department?: string;
  role: string;
  id_number?: string;
  institutional_email?: string;
  is_verified: boolean;
  organizations: Array<{
    org_id: string;
    org_name: string;
    org_full_name: string;
    org_pic?: string;
    role: string;
    status: string;
  }>;
  created_at?: string;
}

/**
 * Fetch public profile data for a user
 * @param userId - User ID or 'me' for current user
 */
export const fetchPublicProfile = async (userId: string = 'me'): Promise<PublicProfile> => {
  try {
    // If userId is 'me', get current user's ID
    let targetUserId = userId;
    if (userId === 'me') {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Authentication required');
      targetUserId = user.id;
    }

    // Get profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, profile_image, cover_photo, course, year, department, role, id_number, institutional_email, regform, consent_form, created_at')
      .eq('user_id', targetUserId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw new Error('Failed to fetch profile');
    }

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Check if verified as student (both regform and consent_form are submitted)
    const isVerified = !!(profile.regform && profile.consent_form);

    // Get organizations where user is a member
    const { data: orgMemberships, error: orgError } = await supabase
      .from('organization_members')
      .select(`
        org_id,
        base_role,
        organizations (
          org_id,
          org_name,
          org_full_name,
          org_pic,
          status
        )
      `)
      .eq('user_id', targetUserId);

    let organizations: PublicProfile['organizations'] = [];

    if (!orgError && orgMemberships) {
      organizations = orgMemberships
        .filter((membership: any) => membership.organizations)
        .map((membership: any) => ({
          org_id: membership.org_id,
          org_name: membership.organizations.org_name,
          org_full_name: membership.organizations.org_full_name,
          org_pic: membership.organizations.org_pic,
          role: membership.base_role,
          status: membership.organizations.status,
        }));
    }

    // Return public profile data
    return {
      user_id: profile.user_id,
      full_name: profile.full_name,
      profile_image: profile.profile_image,
      cover_photo: profile.cover_photo,
      course: profile.course,
      year: profile.year,
      department: profile.department,
      role: profile.role,
      id_number: profile.id_number,
      institutional_email: profile.institutional_email,
      is_verified: isVerified,
      organizations,
      created_at: profile.created_at,
    };
  } catch (error) {
    console.error('Error in fetchPublicProfile:', error);
    throw error;
  }
};
