/**
 * API service for mobile app - now uses direct Supabase like the web app
 */

import { supabase } from './supabase';

export interface Department {
  department_id: string;
  name: string;
  courses: Course[];
}

export interface Course {
  course_id: string;
  name: string;
}

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * Fetch departments directly from Supabase (same as web app)
 */
export const fetchDepartments = async (): Promise<Department[]> => {
  try {

    
    const { data: departments, error } = await supabase
      .from('departments')
      .select('department_id, name, courses')
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase error fetching departments:', error);
      throw new Error(`Failed to fetch departments: ${error.message}`);
    }




    // Process departments to ensure courses are properly parsed (same as web app)
    const processedDepartments = departments?.map(dept => {
      let courses = [];
      
      if (dept.courses) {
        try {
          // If courses is a string, parse it
          if (typeof dept.courses === 'string') {
            courses = JSON.parse(dept.courses);
          } else if (Array.isArray(dept.courses)) {
            courses = dept.courses;
          }
          
          // Ensure each course has the expected structure
          courses = courses.map((course: any, index: number) => {
            if (typeof course === 'string') {
              return { course_id: `course_${index}`, name: course };
            }
            return course;
          });
        } catch (error) {
          console.error('Error parsing courses for department:', dept.name, error);
          courses = [];
        }
      }
      
      return {
        ...dept,
        courses
      };
    }) || [];

    console.log('Processed departments:', processedDepartments.map(d => ({
      name: d.name,
      coursesCount: d.courses.length,
      courses: d.courses
    })));
    
    return processedDepartments;
  } catch (error) {
    console.error('Error fetching departments from Supabase:', error);
    throw error;
  }
};

/**
 * Convert departments to dropdown options format
 */
export const departmentsToDropdownOptions = (departments: Department[]): DropdownOption[] => {
  return departments.map(dept => ({
    value: dept.name,
    label: dept.name
  }));
};

/**
 * Get courses for a specific department
 */
export const getCoursesForDepartment = (departments: Department[], departmentName: string): Course[] => {
  const department = departments.find(dept => dept.name === departmentName);
  return department?.courses || [];
};

/**
 * Convert courses to dropdown options format
 */
export const coursesToDropdownOptions = (courses: Course[]): DropdownOption[] => {
  return courses.map(course => ({
    value: course.name,
    label: course.name
  }));
};

/**
 * Fetch interests/tags directly from Supabase (same as web app)
 */
export const fetchInterests = async (): Promise<any[]> => {
  try {

    
    const { data: tags, error } = await supabase
      .from('org_tags')
      .select('tag_id, tag_name')
      .order('tag_name', { ascending: true });

    if (error) {
      console.error('Supabase error fetching tags:', error);
      throw new Error(`Failed to fetch interests: ${error.message}`);
    }



    // Transform tag_name to name for frontend compatibility (same as web app)
    const transformedTags = tags?.map(tag => ({
      tag_id: tag.tag_id,
      name: tag.tag_name,
      value: tag.tag_name, // For dropdown compatibility
      label: tag.tag_name  // For dropdown compatibility
    })) || [];


    
    return transformedTags;
  } catch (error) {
    console.error('Error fetching interests from Supabase:', error);
    throw error;
  }
};

/**
 * Upload profile image to Supabase Storage
 */
export const uploadProfileImage = async (imageUri: string, userId: string): Promise<string | null> => {
  try {

    
    // For now, return the image URI as placeholder
    // TODO: Implement actual Supabase Storage upload when file upload is ready

    return imageUri;
    
    /* TODO: Uncomment when ready for actual upload
    const fileName = `profile_${userId}_${Date.now()}.jpg`;
    
    // Convert image to blob for upload
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    const { data, error } = await supabase.storage
      .from('profile-images')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error('Error uploading profile image:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);


    return publicUrl;
    */
  } catch (error) {
    console.error('Error in uploadProfileImage:', error);
    return null;
  }
};

/**
 * Create user profile directly via Supabase (same as web app fallback)
 */
export const createUserProfile = async (profileData: any) => {

  
  try {
    let profileImageUrl = null;
    
    // Upload profile image if provided
    if (profileData.profile_image && profileData.profile_image.uri) {
      profileImageUrl = await uploadProfileImage(profileData.profile_image.uri, profileData.user_id);
    }

    // Insert profile data directly into Supabase (same as web app fallback)
    const { data: profile, error } = await supabase
      .from('profiles')
      .insert({
        user_id: profileData.user_id,
        institutional_email: profileData.institutional_email,
        full_name: profileData.full_name,
        course: profileData.course,
        role: profileData.role,
        id_number: profileData.id_number,
        department: profileData.department,
        year: profileData.year,
        phone_number: profileData.phone_number || '',
        address: profileData.address || '',
        profile_image: profileImageUrl || '',
        interests: profileData.interests || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating profile:', error);
      throw new Error(`Failed to create profile: ${error.message}`);
    }


    return { profile };
  } catch (error) {
    console.error('Error creating user profile via Supabase:', error);
    throw error;
  }
};

/**
 * Fetch user's organizations (all memberships) directly from Supabase
 */
export const fetchUserOrganizations = async (): Promise<any[]> => {
  try {

    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User not authenticated:', userError);
      return [];
    }

    // Get organization memberships with organization details
    const { data: memberships, error } = await supabase
      .from('organization_members')
      .select(`
        org_id,
        base_role,
        joined_at,
        organizations (
          org_id,
          org_name,
          description,
          status,
          org_pic,
          org_coverpic,
          created_at
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Supabase error fetching user organizations:', error);
      throw new Error(`Failed to fetch organizations: ${error.message}`);
    }



    // Transform data for mobile app compatibility
    const transformedOrgs = memberships?.map((membership: any) => ({
      id: membership.organizations.org_id,
      name: membership.organizations.org_name,
      description: membership.organizations.description || 'No description',
      status: membership.organizations.status,
      role: membership.base_role,
      joinedAt: membership.joined_at,
      org_pic: membership.organizations.org_pic,
      org_coverpic: membership.organizations.org_coverpic,
      createdAt: membership.organizations.created_at,
      // Generate a color based on org name for UI
      color: generateOrgColor(membership.organizations.org_name)
    })) || [];


    
    return transformedOrgs;
  } catch (error) {
    console.error('Error fetching user organizations from Supabase:', error);
    throw error;
  }
};

/**
 * Generate a consistent color for an organization based on its name
 */
const generateOrgColor = (orgName: string): string => {
  const colors = [
    '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', 
    '#F59E0B', '#10B981', '#06B6D4', '#3B82F6'
  ];
  
  // Simple hash function to get consistent color
  let hash = 0;
  for (let i = 0; i < orgName.length; i++) {
    hash = orgName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Fetch member count for organizations
 */
export const fetchOrganizationMemberCounts = async (orgIds: string[]): Promise<{ [key: string]: number }> => {
  try {

    
    if (!orgIds || orgIds.length === 0) {
      return {};
    }

    const { data: memberCounts, error } = await supabase
      .from('organization_members')
      .select('org_id')
      .in('org_id', orgIds);

    if (error) {
      console.error('Error fetching member counts:', error);
      return {};
    }

    // Count members per organization
    const counts: { [key: string]: number } = {};
    memberCounts?.forEach((member: any) => {
      counts[member.org_id] = (counts[member.org_id] || 0) + 1;
    });


    return counts;
  } catch (error) {
    console.error('Error fetching organization member counts:', error);
    return {};
  }
};

/**
 * Fetch user's announcements from organizations they're in (raw format for feed)
 */
export const fetchUserAnnouncementsRaw = async (): Promise<any[]> => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return [];
    }

    // Get user's organization IDs
    const { data: memberships, error: memberError } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id);

    if (memberError || !memberships || memberships.length === 0) {
      return [];
    }

    const orgIds = memberships.map(m => m.org_id);

    // Try different possible table names and column structures for announcements
    let { data: announcements, error: announcementError } = await supabase
      .from('announcements')
      .select(`
        announcement_id,
        title,
        content,
        created_at,
        org_id,
        organizations (
          org_name,
          org_pic
        )
      `)
      .in('org_id', orgIds)
      .order('created_at', { ascending: false });

    // If announcement_id doesn't work, try other possible ID column names
    if (announcementError && announcementError.message?.includes('announcement_id does not exist')) {
      // Try with 'id' column
      const idResult = await supabase
        .from('announcements')
        .select(`
          id,
          title,
          content,
          created_at,
          org_id,
          organizations (
            org_name,
            org_pic
          )
        `)
        .in('org_id', orgIds)
        .order('created_at', { ascending: false });
      
      if (!idResult.error) {
        // Transform id to announcement_id for consistency
        announcements = idResult.data?.map((item: any) => ({
          ...item,
          announcement_id: item.id
        })) || null;
        announcementError = null;
      }
    }

    // If that fails, try 'organization_announcements' table
    if (announcementError) {
      const result = await supabase
        .from('organization_announcements')
        .select(`
          announcement_id,
          title,
          content,
          created_at,
          org_id,
          organizations (
            org_name,
            org_pic
          )
        `)
        .in('org_id', orgIds)
        .order('created_at', { ascending: false });
      
      // Transform the data to match expected format
      announcements = result.data?.map((item: any) => ({
        id: item.announcement_id, // Map announcement_id to id for consistency
        announcement_id: item.announcement_id,
        title: item.title,
        content: item.content,
        created_at: item.created_at,
        org_id: item.org_id,
        organizations: item.organizations
      })) || null;
      announcementError = result.error;
      
      // If organization_announcements also fails, try organization_posts as suggested
      if (announcementError) {
        const postResult = await supabase
          .from('organization_posts')
          .select(`
            post_id,
            title,
            content,
            created_at,
            org_id,
            organizations (
              org_name,
              org_pic
            )
          `)
          .in('org_id', orgIds)
          .order('created_at', { ascending: false });
        
        if (!postResult.error && postResult.data && postResult.data.length > 0) {
          // Transform posts to announcement format
          announcements = postResult.data.map((item: any) => ({
            id: item.post_id,
            announcement_id: item.post_id,
            title: item.title,
            content: item.content,
            created_at: item.created_at,
            org_id: item.org_id,
            organizations: item.organizations
          }));
          announcementError = null;
        }
      }
    }

    if (announcementError) {
      return [];
    }

    return announcements || [];

  } catch (error) {
    console.error('Error fetching user announcements (raw):', error);
    return [];
  }
};

/**
 * Fetch user's announcements from organizations they're in
 */
export const fetchUserAnnouncements = async (): Promise<any[]> => {
  try {

    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User not authenticated:', userError);
      return [];
    }

    // Get user's organization IDs
    const { data: memberships, error: memberError } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id);

    if (memberError || !memberships || memberships.length === 0) {

      return [];
    }

    const orgIds = memberships.map(m => m.org_id);

    // Fetch announcements from the correct table (matching web version)
    const { data: announcements, error: announcementError } = await supabase
      .from('announcements')
      .select(`
        announcement_id,
        title,
        content,
        created_at,
        org_id,
        organizations (
          org_name,
          org_pic
        )
      `)
      .in('org_id', orgIds)
      .order('created_at', { ascending: false })
      .limit(10);

    if (announcementError) {

      return [];
    }



    return announcements?.map((announcement: any) => ({
      id: announcement.announcement_id,
      title: announcement.title,
      subtitle: announcement.content?.substring(0, 50) + '...' || 'No content',
      createdAt: announcement.created_at,
      orgId: announcement.org_id,
      orgName: announcement.organizations?.org_name || 'Unknown Org',
      orgPic: announcement.organizations?.org_pic || null
    })) || [];

  } catch (error) {
    console.error('Error fetching user announcements:', error);
    return [];
  }
};

/**
 * Fetch user's upcoming events from organizations they're in
 */
export const fetchUserEvents = async (): Promise<any[]> => {
  try {

    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User not authenticated:', userError);
      return [];
    }

    // Get user's organization IDs
    const { data: memberships, error: memberError } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id);

    if (memberError || !memberships || memberships.length === 0) {

      return [];
    }

    const orgIds = memberships.map(m => m.org_id);

    // Fetch events from user's organizations
    // Note: This assumes there's an events table - adjust based on your schema
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        event_date,
        location,
        org_id,
        organizations (
          org_name
        )
      `)
      .in('org_id', orgIds)
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })
      .limit(10);

    if (eventError) {

      return [];
    }

    return events?.map((event: any) => ({
      id: event.id,
      title: event.title,
      date: new Date(event.event_date).toLocaleDateString(),
      location: event.location || 'TBA',
      orgId: event.org_id,
      orgName: event.organizations?.org_name || 'Unknown Org'
    })) || [];

  } catch (error) {
    console.error('Error fetching user events:', error);
    return [];
  }
};

/**
 * Fetch all organizations from the database for directory listing
 */
export const fetchAllOrganizations = async (): Promise<any[]> => {
  try {

    
    // Fetch all organizations with member count (matching web version schema)
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select(`
        org_id,
        org_name,
        org_full_name,
        description,
        status,
        org_pic,
        org_coverpic,
        created_at,
        accredited_until,
        adviser_list,
        department,
        organization_members (count)
      `)
      .order('org_name', { ascending: true });

    if (error) {
      console.error('Supabase error fetching organizations:', error);
      throw new Error(`Failed to fetch organizations: ${error.message}`);
    }



    // Transform data for mobile app compatibility (matching web version)
    const transformedOrgs = organizations?.map((org: any) => ({
      id: org.org_id,
      name: org.org_full_name || org.org_name, // Use full name as primary name
      description: org.description || 'No description available',
      category: generateOrgCategory(org.org_name), // Use short name for category
      status: mapOrgStatus(org.status),
      type: categorizeOrgType(org.org_name, org.description),
      color: generateOrgColor(org.org_name),
      memberCount: org.organization_members?.[0]?.count || 0,
      org_pic: org.org_pic,
      org_coverpic: org.org_coverpic,
      createdAt: org.created_at,
      accreditedUntil: org.accredited_until,
      shortName: org.org_name, // Add short name
      department: org.department,
      advisers: org.adviser_list || []
    })) || [];


    
    return transformedOrgs;
  } catch (error) {
    console.error('Error fetching all organizations from Supabase:', error);
    throw error;
  }
};

/**
 * Generate organization category/acronym from name
 */
const generateOrgCategory = (orgName: string): string => {
  // Extract acronyms or create them from organization names
  if (orgName.includes('MASTECH')) return 'MASTECH';
  if (orgName.includes('JPIA')) return 'EU-JPIA';
  if (orgName.includes('Pet Society')) return 'PET-SOC';
  if (orgName.includes('Esports') || orgName.includes('Wildcats')) return 'ESPORTS';
  if (orgName.includes('Honor Society') || orgName.includes('Lambda')) return 'HONORS';
  if (orgName.includes('Student Council')) return 'SC';
  if (orgName.includes('Drama') || orgName.includes('Theater')) return 'DRAMA';
  if (orgName.includes('Music') || orgName.includes('Band')) return 'MUSIC';
  
  // Generate acronym from first letters of major words
  const words = orgName.split(' ').filter(word => 
    word.length > 2 && 
    !['of', 'the', 'and', 'for', 'in', 'at', 'to'].includes(word.toLowerCase())
  );
  
  if (words.length >= 2) {
    return words.slice(0, 3).map(word => word.charAt(0).toUpperCase()).join('');
  }
  
  return orgName.substring(0, 6).toUpperCase();
};

/**
 * Map database status to display status
 */
const mapOrgStatus = (dbStatus: string): 'Accredited' | 'Pending' | 'Active' => {
  if (!dbStatus) return 'Active';
  
  const status = dbStatus.toLowerCase();
  if (status.includes('accredited') || status === 'approved') return 'Accredited';
  if (status.includes('pending') || status === 'under_review') return 'Pending';
  return 'Active';
};

/**
 * Categorize organization type based on name and description
 */
const categorizeOrgType = (orgName: string, description: string): 'Academic' | 'Interest' | 'Sports' | 'Cultural' => {
  const text = `${orgName} ${description}`.toLowerCase();
  
  // Academic organizations
  if (text.includes('academic') || text.includes('institute') || text.includes('honor') || 
      text.includes('scholar') || text.includes('study') || text.includes('research') ||
      text.includes('jpia') || text.includes('mastech') || text.includes('engineering') ||
      text.includes('science') || text.includes('business') || text.includes('accounting')) {
    return 'Academic';
  }
  
  // Sports organizations
  if (text.includes('sport') || text.includes('esport') || text.includes('athletic') || 
      text.includes('team') || text.includes('competition') || text.includes('tournament') ||
      text.includes('wildcats') || text.includes('gaming')) {
    return 'Sports';
  }
  
  // Cultural organizations
  if (text.includes('cultural') || text.includes('art') || text.includes('music') || 
      text.includes('dance') || text.includes('theater') || text.includes('drama') ||
      text.includes('creative') || text.includes('performance')) {
    return 'Cultural';
  }
  
  // Default to Interest for everything else
  return 'Interest';
};

/**
 * Fetch single organization details by ID
 */
export const fetchOrganizationById = async (orgId: string): Promise<any> => {
  try {

    
    // Fetch organization with member count (matching web version schema)
    const { data: organization, error } = await supabase
      .from('organizations')
      .select(`
        org_id,
        org_name,
        org_full_name,
        description,
        status,
        org_pic,
        org_coverpic,
        created_at,
        accredited_until,
        adviser_list,
        officer_list,
        department,
        dean,
        allow_outside_dept,
        organization_members (count)
      `)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('Supabase error fetching organization:', error);
      throw new Error(`Failed to fetch organization: ${error.message}`);
    }

    if (!organization) {
      throw new Error('Organization not found');
    }



    // Fetch advisers with profile information (like web version)
    let advisers: Array<{email: string; full_name: string}> = [];
    
    // First try to get advisers from organization_members table
    const { data: adviserMembers, error: adviserError } = await supabase
      .from('organization_members')
      .select(`
        user_id,
        profiles!inner(institutional_email, full_name)
      `)
      .eq('org_id', orgId)
      .eq('base_role', 'adviser');

    if (!adviserError && adviserMembers && adviserMembers.length > 0) {
      // Use organization_members data (most up-to-date)
      advisers = adviserMembers.map((member: any) => ({
        email: member.profiles.institutional_email,
        full_name: member.profiles.full_name || member.profiles.institutional_email
      }));
    } else {
      // Fallback to organizations.adviser_list (convert strings to objects)
      advisers = (organization.adviser_list || []).map((email: string) => ({
        email: email,
        full_name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      }));
    }

    // Fetch officers with profile information (like web version)
    let officers: Array<{email: string; full_name: string; position?: string}> = [];
    
    // First try to get officers from organization_members table
    const { data: officerMembers, error: officerError } = await supabase
      .from('organization_members')
      .select(`
        user_id,
        profiles!inner(institutional_email, full_name),
        organization_roles(title)
      `)
      .eq('org_id', orgId)
      .eq('base_role', 'officer');

    if (!officerError && officerMembers && officerMembers.length > 0) {
      // Use organization_members data (most up-to-date)
      officers = officerMembers.map((member: any) => ({
        email: member.profiles.institutional_email,
        full_name: member.profiles.full_name || member.profiles.institutional_email,
        position: member.organization_roles?.title || 'Officer'
      }));
    } else if (organization.officer_list && Array.isArray(organization.officer_list)) {
      // Fallback to organizations.officer_list
      if (organization.officer_list.length > 0 && typeof organization.officer_list[0] === 'object') {
        // New format: array of {email, position} objects
        officers = organization.officer_list.map((officer: any) => ({
          email: officer.email,
          full_name: officer.email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          position: officer.position || 'Officer'
        }));
      } else {
        // Old format: array of email strings
        officers = organization.officer_list.map((email: string) => ({
          email: email,
          full_name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          position: 'Officer'
        }));
      }
    }

    // Transform data for mobile app compatibility (matching web version)
    const transformedOrg = {
      id: organization.org_id,
      name: organization.org_full_name || organization.org_name, // Use full name as primary name
      shortName: organization.org_name, // Use org_name as short name/acronym
      description: organization.description || 'No description available',
      status: mapOrgStatus(organization.status),
      contact: advisers.length > 0 ? advisers[0].email : 'No contact available',
      category: organization.department || categorizeOrgType(organization.org_name, organization.description || ''),
      color: generateOrgColor(organization.org_name),
      memberCount: organization.organization_members?.[0]?.count || 0,
      org_pic: organization.org_pic,
      org_coverpic: organization.org_coverpic,
      createdAt: organization.created_at,
      accreditedUntil: organization.accredited_until,
      advisers: advisers, // Now contains objects with email and full_name
      officers: officers, // Now contains objects with email, full_name, and position
      department: organization.department,
      dean: organization.dean,
      allowOutsideDept: organization.allow_outside_dept || false
    };


    
    return transformedOrg;
  } catch (error) {
    console.error('Error fetching organization by ID:', error);
    throw error;
  }
};

/**
 * Fetch organization members by organization ID
 */
export const fetchOrganizationMembers = async (orgId: string): Promise<any[]> => {
  try {

    
    // Fetch members with profile information
    const { data: members, error } = await supabase
      .from('organization_members')
      .select(`
        user_id,
        base_role,
        joined_at,
        profiles (
          user_id,
          full_name,
          institutional_email,
          course,
          year,
          role,
          created_at
        )
      `)
      .eq('org_id', orgId)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching organization members:', error);
      throw new Error(`Failed to fetch members: ${error.message}`);
    }



    // Transform data for mobile app compatibility
    const transformedMembers = members?.map((member: any) => ({
      id: member.user_id,
      name: member.profiles?.full_name || 'Unknown User',
      email: member.profiles?.institutional_email || 'No email',
      role: member.base_role || 'member',
      course: member.profiles?.course || '',
      yearLevel: member.profiles?.year ? `${member.profiles.year}${getYearSuffix(member.profiles.year)} Year` : '',
      joinDate: member.joined_at,
      created_at: member.profiles?.created_at || member.joined_at,
      profileRole: member.profiles?.role || 'student'
    })) || [];


    
    return transformedMembers;
  } catch (error) {
    console.error('Error fetching organization members:', error);
    throw error;
  }
};

/**
 * Fetch organization events by organization ID (matches web dashboard exactly)
 */
export const fetchOrganizationEvents = async (orgId: string): Promise<any[]> => {
  try {

    
    // Fetch events exactly like web dashboard: only from events table
    const { data: events, error } = await supabase
      .from('events')
      .select('event_id, title, description, scheduled_at, venue, created_at')
      .eq('org_id', orgId)
      .order('scheduled_at', { ascending: true });

    if (error) {

      return [];
    }



    
    // Also check if there are ANY events in the database for debugging
    const { data: allEvents, error: allEventsError } = await supabase
      .from('events')
      .select('event_id, title, org_id, scheduled_at')
      .limit(10);
    



    // Transform data exactly like web version
    const transformedEvents = (events || []).map((event: any) => ({
      id: event.event_id,
      title: event.title,
      description: event.description,
      date: event.scheduled_at ? new Date(event.scheduled_at).toLocaleDateString() : 'TBA',
      location: event.venue || 'TBA',
      status: 'Open', // Default status like web version
      scheduled_at: event.scheduled_at
    }));


    
    return transformedEvents;
  } catch (error) {
    console.error('Error fetching organization events:', error);
    return [];
  }
};

/**
 * Fetch organization announcements by organization ID
 */
export const fetchOrganizationAnnouncements = async (orgId: string): Promise<any[]> => {
  try {

    
    // Fetch announcements from the organization (using same structure as web version)
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('announcement_id, org_id, title, content, created_at, image, send_to_teams, teams_message_sent, teams_sent_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {

      return [];
    }



    // Return announcements with same structure as web version
    const transformedAnnouncements = announcements || [];


    
    return transformedAnnouncements;
  } catch (error) {
    console.error('Error fetching organization announcements:', error);
    return [];
  }
};

/**
 * Helper function to get year suffix
 */
const getYearSuffix = (year: number): string => {
  switch (year) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    case 4: return 'th';
    default: return 'th';
  }
};

/**
 * Map event status from database to display status
 */
const mapEventStatus = (dbStatus: string): 'Open' | 'Registration Soon' | 'Closed' => {
  if (!dbStatus) return 'Open';
  
  const status = dbStatus.toLowerCase();
  if (status.includes('open') || status === 'active') return 'Open';
  if (status.includes('soon') || status === 'upcoming') return 'Registration Soon';
  if (status.includes('closed') || status === 'ended') return 'Closed';
  return 'Open';
};

/**
 * Get contact email from advisers list
 */
const getContactFromAdvisers = (adviserList: any[]): string => {
  if (!adviserList || adviserList.length === 0) {
    return 'No contact available';
  }
  
  // Handle both string and object formats
  const firstAdviser = adviserList[0];
  if (typeof firstAdviser === 'string') {
    return firstAdviser;
  } else if (typeof firstAdviser === 'object') {
    return firstAdviser.email || firstAdviser.institutional_email || 'No contact available';
  }
  
  return 'No contact available';
};

/**
 * Update organization settings
 */
export const updateOrganization = async (orgId: string, updateData: any): Promise<any> => {
  try {

    
    // Map mobile form data to database schema
    const dbUpdateData: any = {};
    
    if (updateData.title) dbUpdateData.org_full_name = updateData.title;  // Organization Name → org_full_name
    if (updateData.acronym) dbUpdateData.org_name = updateData.acronym;   // Acronym/Short Name → org_name
    if (updateData.description !== undefined) dbUpdateData.description = updateData.description;
    if (updateData.department) dbUpdateData.department = updateData.department;
    if (updateData.dean !== undefined) dbUpdateData.dean = updateData.dean;
    if (updateData.allowOutsideDepartment !== undefined) dbUpdateData.allow_outside_dept = updateData.allowOutsideDepartment;
    
    // Update the organization
    const { data, error } = await supabase
      .from('organizations')
      .update(dbUpdateData)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error updating organization:', error);
      throw new Error(`Failed to update organization: ${error.message}`);
    }


    return data;
  } catch (error) {
    console.error('Error updating organization:', error);
    throw error;
  }
};

/**
 * Create a new announcement for an organization
 */
export const createAnnouncement = async (orgId: string, announcementData: {
  title: string;
  content: string;
  image?: string | null;
  sendToTeams?: boolean;
}): Promise<any> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();
    
    const authorId = user?.id || session?.user?.id;
    
    if (!authorId) {
      return { error: 'Authentication required' };
    }
    
    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        org_id: orgId,
        title: announcementData.title,
        content: announcementData.content,
        image: announcementData.image,
        send_to_teams: announcementData.sendToTeams || false,
        teams_message_sent: false,
        created_by: authorId
      })
      .select('announcement_id, org_id, title, content, created_at, image, send_to_teams, teams_message_sent, teams_sent_at, created_by')
      .single();

    if (error) {
      throw new Error(`Failed to create announcement: ${error.message}`);
    }

    return { announcement };
  } catch (error) {
    console.error('Error creating announcement:', error);
    throw error;
  }
};

/**
 * Update an existing announcement
 */
export const updateAnnouncement = async (orgId: string, announcementId: string, announcementData: {
  title: string;
  content: string;
  image?: string | null;
}): Promise<any> => {
  try {

    
    const { data: announcement, error } = await supabase
      .from('announcements')
      .update({
        title: announcementData.title,
        content: announcementData.content,
        image: announcementData.image
      })
      .eq('announcement_id', announcementId)
      .eq('org_id', orgId)
      .select('announcement_id, org_id, title, content, created_at, image, send_to_teams, teams_message_sent, teams_sent_at')
      .single();

    if (error) {
      console.error('Error updating announcement:', error);
      throw new Error(`Failed to update announcement: ${error.message}`);
    }


    return { announcement };
  } catch (error) {
    console.error('Error updating announcement:', error);
    throw error;
  }
};

/**
 * Delete an announcement
 */
export const deleteAnnouncement = async (orgId: string, announcementId: string): Promise<void> => {
  try {

    
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('announcement_id', announcementId)
      .eq('org_id', orgId);

    if (error) {
      console.error('Error deleting announcement:', error);
      throw new Error(`Failed to delete announcement: ${error.message}`);
    }


  } catch (error) {
    console.error('Error deleting announcement:', error);
    throw error;
  }
};

/**
 * Fetch all posts from all organizations for the feed
 */
export const fetchAllPosts = async (): Promise<any[]> => {
  try {

    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    // Fetch posts with organizations
    const { data: posts, error } = await supabase
      .from('organization_posts')
      .select(`
        post_id, 
        org_id, 
        title, 
        content, 
        created_at, 
        media_url,
        media_urls,
        visibility, 
        author_id,
        organizations!organization_posts_org_id_fkey (
          org_name,
          org_pic
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching posts:', error);
      return [];
    }

    if (!posts || posts.length === 0) {
      return [];
    }

    // Get post IDs
    const postIds = posts.map(p => p.post_id);

    // Fetch like counts for all posts
    const { data: likeCounts } = await supabase
      .from('post_likes')
      .select('post_id')
      .in('post_id', postIds);

    // Count likes per post
    const likeCountMap = (likeCounts || []).reduce((acc: any, like: any) => {
      acc[like.post_id] = (acc[like.post_id] || 0) + 1;
      return acc;
    }, {});

    // Fetch user's likes if logged in
    let userLikesMap: any = {};
    if (user) {
      const { data: userLikes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);

      userLikesMap = (userLikes || []).reduce((acc: any, like: any) => {
        acc[like.post_id] = true;
        return acc;
      }, {});
    }

    // Fetch comment counts
    const { data: commentCounts } = await supabase
      .from('post_comments')
      .select('post_id')
      .in('post_id', postIds);

    const commentCountMap = (commentCounts || []).reduce((acc: any, comment: any) => {
      acc[comment.post_id] = (acc[comment.post_id] || 0) + 1;
      return acc;
    }, {});

    // Merge all data
    const postsWithCounts = posts.map(post => ({
      ...post,
      like_count: likeCountMap[post.post_id] || 0,
      user_has_liked: userLikesMap[post.post_id] || false,
      comment_count: commentCountMap[post.post_id] || 0
    }));


    return postsWithCounts;
  } catch (error) {
    console.error('Error fetching feed posts:', error);
    return [];
  }
};

/**
 * Fetch all announcements from all organizations for the feed
 */
export const fetchAllAnnouncements = async (): Promise<any[]> => {
  try {

    
    // First check if announcements exist
    const { data: allAnnouncements, error: allAnnouncementsError } = await supabase
      .from('announcements')
      .select('*')
      .limit(10);
    

    
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select(`
        announcement_id, 
        org_id, 
        title, 
        content, 
        created_at, 
        image,
        organizations!announcements_org_id_fkey (
          org_name,
          org_pic
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to recent 50 announcements

    if (error) {
      console.error('Error fetching announcements with organizations:', error);
      
      // Fallback: try without the join and fetch organization data separately
      const { data: simpleAnnouncements, error: simpleError } = await supabase
        .from('announcements')
        .select('announcement_id, org_id, title, content, created_at, image')
        .order('created_at', { ascending: false })
        .limit(50);
      

      
      if (simpleAnnouncements && simpleAnnouncements.length > 0) {
        // Get unique org_ids
        const orgIds = [...new Set(simpleAnnouncements.map(announcement => announcement.org_id))];
        
        // Fetch organization details separately
        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('org_id, org_name, org_pic')
          .in('org_id', orgIds);
        

        
        // Merge announcements with organization data
        const announcementsWithOrgs = simpleAnnouncements.map(announcement => ({
          ...announcement,
          organizations: orgs?.find(org => org.org_id === announcement.org_id) || null
        }));
        
        return announcementsWithOrgs;
      }
      
      return simpleAnnouncements || [];
    }



    return announcements || [];
  } catch (error) {
    console.error('Error fetching feed announcements:', error);
    return [];
  }
};

/**
 * Fetch organization posts by organization ID
 */
export const fetchOrganizationPosts = async (orgId: string): Promise<any[]> => {
  try {

    
    const { data: posts, error } = await supabase
      .from('organization_posts')
      .select('post_id, org_id, title, content, created_at, media_url, visibility, author_id')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {

      return [];
    }


    return posts || [];
  } catch (error) {
    console.error('Error fetching organization posts:', error);
    return [];
  }
};

/**
 * Create a new post for an organization
 */
export const createPost = async (orgId: string, postData: {
  title: string;
  content: string;
  media_url?: string | null;
  visibility: string;
}): Promise<any> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();
    
    const authorId = user?.id || session?.user?.id;
    
    if (!authorId) {
      return { error: 'Authentication required' };
    }
    
    const { data: post, error } = await supabase
      .from('organization_posts')
      .insert({
        org_id: orgId,
        title: postData.title,
        content: postData.content,
        media_url: postData.media_url,
        visibility: postData.visibility,
        author_id: authorId
      })
      .select('post_id, org_id, title, content, created_at, media_url, visibility, author_id')
      .single();

    if (error) {
      throw new Error(`Failed to create post: ${error.message}`);
    }

    return { post };
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

/**
 * Update an existing post
 */
export const updatePost = async (orgId: string, postId: string, postData: {
  title: string;
  content: string;
  media_url?: string | null;
  visibility: string;
}): Promise<any> => {
  try {

    
    const { data: post, error } = await supabase
      .from('organization_posts')
      .update({
        title: postData.title,
        content: postData.content,
        media_url: postData.media_url,
        visibility: postData.visibility
      })
      .eq('post_id', postId)
      .eq('org_id', orgId)
      .select('post_id, org_id, title, content, created_at, media_url, visibility')
      .single();

    if (error) {
      console.error('Error updating post:', error);
      throw new Error(`Failed to update post: ${error.message}`);
    }


    return { post };
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

/**
 * Delete a post
 */
export const deletePost = async (orgId: string, postId: string): Promise<void> => {
  try {

    
    const { error } = await supabase
      .from('organization_posts')
      .delete()
      .eq('post_id', postId)
      .eq('org_id', orgId);

    if (error) {
      console.error('Error deleting post:', error);
      throw new Error(`Failed to delete post: ${error.message}`);
    }


  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

/**
 * Comment interfaces
 */
export interface PostComment {
  comment_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  reply_to_comment_id?: string | null;
  replies?: PostComment[];
  profile: {
    full_name: string;
    profile_image?: string;
  };
}

/**
 * Fetch comments for a post
 */
export const fetchPostComments = async (postId: string): Promise<PostComment[]> => {
  try {

    
    if (!postId) {
      console.error('Post ID is undefined');
      return [];
    }
    
    // First, get comments
    const { data: comments, error } = await supabase
      .from('post_comments')
      .select(`
        comment_id,
        content,
        created_at,
        updated_at,
        user_id,
        reply_to_comment_id
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    if (!comments || comments.length === 0) {
      return [];
    }

    // Fetch user profiles separately
    const userIds = comments.map((comment: any) => comment.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, profile_image')
      .in('user_id', userIds);

    // Build nested comment structure with profiles
    const commentMap = new Map<string, PostComment>();
    const rootComments: PostComment[] = [];

    // First pass: create all comment objects with profiles
    comments.forEach((comment: any) => {
      const profile = profiles?.find((p: any) => p.user_id === comment.user_id);
      const commentObj: PostComment = {
        comment_id: comment.comment_id,
        content: comment.content,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        user_id: comment.user_id,
        reply_to_comment_id: comment.reply_to_comment_id,
        replies: [],
        profile: profile || { full_name: 'Unknown User' }
      };
      commentMap.set(comment.comment_id, commentObj);
    });

    // Second pass: build tree structure
    commentMap.forEach((comment) => {
      if (comment.reply_to_comment_id) {
        const parent = commentMap.get(comment.reply_to_comment_id);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(comment);
        } else {
          // Parent not found, treat as root
          rootComments.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });


    return rootComments;
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};

/**
 * Add a comment to a post
 */
export const addPostComment = async (
  postId: string,
  content: string,
  replyToCommentId?: string
): Promise<PostComment> => {
  try {

    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: comment, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content: content.trim(),
        reply_to_comment_id: replyToCommentId || null
      })
      .select(`
        comment_id,
        content,
        created_at,
        updated_at,
        user_id,
        reply_to_comment_id
      `)
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      throw new Error(`Failed to add comment: ${error.message}`);
    }

    // Fetch user profile separately
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, full_name, profile_image')
      .eq('user_id', user.id)
      .single();


    return {
      ...comment,
      profile: profile || { full_name: 'Unknown User' },
      replies: []
    };
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

/**
 * Delete a comment
 */
export const deletePostComment = async (commentId: string): Promise<void> => {
  try {

    
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('comment_id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      throw new Error(`Failed to delete comment: ${error.message}`);
    }


  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface Notification {
  notification_id: string;
  recipient_id: string;
  recipient_role: string;
  title: string;
  message: string;
  notification_type: string;
  priority: string;
  is_read: boolean;
  created_at: string;
  data?: {
    action_url?: string;
    deep_link?: string;
    liker_name?: string;
    commenter_name?: string;
    author_name?: string;
    post_title?: string;
    organization_name?: string;
    comment_content?: string;
  };
  organization_id?: string;
  post_id?: string;
  redbook_id?: string;
  event_id?: string;
}

export interface NotificationFilters {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  type?: string;
}

/**
 * Fetch notifications for the current user
 */
export const fetchNotifications = async (filters: NotificationFilters = {}): Promise<Notification[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const {
      limit = 50,
      offset = 0,
      unreadOnly = false,
      type
    } = filters;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (type) {
      query = query.eq('notification_type', type);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return notifications || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

/**
 * Get unread notification count
 */
export const getUnreadNotificationCount = async (): Promise<number> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('notification_id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('notification_id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

// ============================================================================
// MESSAGING
// ============================================================================

export interface Message {
  id: string;
  text: string;
  subject: string;
  created_at: string;
  updated_at: string;
  sender_id: string;
  recipient_id: string;
  is_read: boolean;
  attachments?: any[];
  priority?: string;
  message_type?: string;
  is_starred?: boolean;
  is_archived?: boolean;
  is_deleted?: boolean;
  is_draft?: boolean;
  reply_to_message_id?: string;
  sender_profile?: {
    user_id: string;
    full_name: string;
    profile_image?: string;
    institutional_email?: string;
  };
}

export interface Conversation {
  partner: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  lastMessage: {
    content: string;
    created_at: string;
  };
  unreadCount: number;
  totalMessages: number;
  isStarred: boolean;
  isArchived: boolean;
}

/**
 * Fetch all conversations for the current user
 */
export const fetchConversations = async (): Promise<Conversation[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get all messages where user is sender or recipient
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        text,
        subject,
        created_at,
        sender_id,
        recipient_id,
        is_read,
        is_starred,
        is_archived,
        is_deleted
      `)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    // Get unique partner IDs
    const partnerIds = new Set<string>();
    messages?.forEach((message: any) => {
      const partner = message.sender_id === user.id ? message.recipient_id : message.sender_id;
      if (partner && partner !== user.id) {
        partnerIds.add(partner);
      }
    });

    // Fetch profiles for all partners
    const { data: partnerProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name, profile_image, institutional_email')
      .in('user_id', Array.from(partnerIds));

    if (profilesError) {
      console.error('Error fetching partner profiles:', profilesError);
    }

    // Create a map of partner profiles
    const profileMap = new Map();
    partnerProfiles?.forEach((profile: any) => {
      profileMap.set(profile.user_id, profile);
    });

    // Group messages into conversations
    const conversationMap = new Map();
    messages?.forEach((message: any) => {
      const partner = message.sender_id === user.id ? message.recipient_id : message.sender_id;
      
      if (partner && partner !== user.id) {
        if (!conversationMap.has(partner)) {
          const partnerProfile = profileMap.get(partner);
          
          conversationMap.set(partner, {
            partner: {
              id: partner,
              name: partnerProfile?.full_name || 'Unknown User',
              email: partnerProfile?.institutional_email || 'No email',
              avatar: partnerProfile?.profile_image
            },
            lastMessage: {
              content: message.text || 'No message',
              created_at: message.created_at
            },
            unreadCount: 0,
            totalMessages: 1,
            isStarred: message.is_starred || false,
            isArchived: message.is_archived || false
          });
        }

        // Update unread count for messages sent TO the current user
        if (message.recipient_id === user.id && !message.is_read) {
          const conversation = conversationMap.get(partner);
          if (conversation) {
            conversation.unreadCount += 1;
          }
        }
        
        // Update total message count
        const conversation = conversationMap.get(partner);
        if (conversation) {
          conversation.totalMessages += 1;
        }
      }
    });

    return Array.from(conversationMap.values());
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

/**
 * Fetch messages in a conversation with a specific user
 */
export const fetchConversationMessages = async (partnerId: string): Promise<Message[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender_profile:profiles!messages_sender_id_fkey (
          user_id,
          full_name,
          profile_image,
          institutional_email
        )
      `)
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching conversation messages:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return messages || [];
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    throw error;
  }
};

/**
 * Send a message
 */
export const sendMessage = async (params: {
  recipientId: string;
  subject: string;
  content: string;
  attachments?: any[];
  replyToMessageId?: string;
}): Promise<Message> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        recipient_id: params.recipientId,
        subject: params.subject,
        text: params.content,
        attachments: params.attachments || [],
        reply_to_message_id: params.replyToMessageId,
        is_read: false,
        priority: 'normal',
        message_type: 'message'
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }

    return message;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Mark message as read
 */
export const markMessageAsRead = async (messageId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId);

    if (error) {
      console.error('Error marking message as read:', error);
      throw new Error(`Failed to mark message as read: ${error.message}`);
    }
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
};

/**
 * Mark all messages in a conversation as read
 */
export const markConversationAsRead = async (partnerId: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', partnerId)
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking conversation as read:', error);
      throw new Error(`Failed to mark conversation as read: ${error.message}`);
    }
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    throw error;
  }
};

/**
 * Search users for messaging
 */
export const searchUsersForMessaging = async (query: string): Promise<any[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: users, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, profile_image, institutional_email')
      .neq('user_id', user.id)
      .ilike('full_name', `%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error searching users:', error);
      throw new Error(`Failed to search users: ${error.message}`);
    }

    return users || [];
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};
