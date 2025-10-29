import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  FlatList,
  Alert,
  TextInput,
  Dimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/hooks/useAuth';
import { canPostAnnouncements, canManageMembers } from '@/lib/mockRoles';
import { fetchOrganizationById, fetchOrganizationMembers, fetchOrganizationEvents } from '@/lib/api';
import { deletePost } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

// Expandable Text Component for Posts (2 lines max)
const ExpandablePostText = ({ content, colors }: { content: string, colors: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 80; // Shorter for 2 lines
  
  if (content.length <= maxLength) {
    return (
      <ThemedText style={[styles.redditPostTextCompact, { color: colors.tabIconDefault }]} numberOfLines={2}>
        {content}
      </ThemedText>
    );
  }
  
  return (
    <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} activeOpacity={0.7}>
      <ThemedText style={[styles.redditPostTextCompact, { color: colors.tabIconDefault }]} numberOfLines={isExpanded ? undefined : 2}>
        {content}
        {!isExpanded && content.length > maxLength && (
          <ThemedText style={[styles.showMoreInline, { color: '#800020' }]}> ...more</ThemedText>
        )}
      </ThemedText>
    </TouchableOpacity>
  );
};

// Expandable Text Component for Organization Description (2 lines max)
const ExpandableOrgDescription = ({ content, colors }: { content: string, colors: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 100; // Slightly longer for descriptions
  
  if (content.length <= maxLength) {
    return (
      <ThemedText style={[styles.redditDescription, { color: colors.tabIconDefault }]} numberOfLines={2}>
        {content}
      </ThemedText>
    );
  }
  
  return (
    <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} activeOpacity={0.7}>
      <ThemedText style={[styles.redditDescription, { color: colors.tabIconDefault }]} numberOfLines={isExpanded ? undefined : 2}>
        {content}
        {!isExpanded && content.length > maxLength && (
          <ThemedText style={[styles.showMoreInline, { color: '#800020' }]}> ...more</ThemedText>
        )}
      </ThemedText>
    </TouchableOpacity>
  );
};

// Placeholder API functions (to be implemented)
// fetchOrganizationEvents is now imported from @/lib/api

const fetchOrganizationAnnouncements = async (orgId: string) => {
  try {
    console.log('Fetching announcements for organization:', orgId);
    
    // Try different possible table names for announcements
    let { data: announcements, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    // If announcements table doesn't work, try organization_announcements
    if (error) {
      const result = await supabase
        .from('organization_announcements')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      
      announcements = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error fetching announcements:', error);
      return [];
    }

    console.log('Found announcements:', announcements?.length || 0);
    return announcements || [];
  } catch (error) {
    console.error('Error in fetchOrganizationAnnouncements:', error);
    return [];
  }
};

const fetchOrganizationPosts = async (orgId: string) => {
  try {
    console.log('Fetching posts for organization:', orgId);
    
    // Try different possible table names for posts
    let { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    // If posts table doesn't work, try organization_posts
    if (error) {
      const result = await supabase
        .from('organization_posts')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      
      posts = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error fetching posts:', error);
      return [];
    }

    console.log('Found posts:', posts?.length || 0);
    return posts || [];
  } catch (error) {
    console.error('Error in fetchOrganizationPosts:', error);
    return [];
  }
};

const createAnnouncement = async (data: any) => {
  console.log('createAnnouncement placeholder:', data);
  return { success: true };
};

const updateAnnouncement = async (id: string, data: any) => {
  console.log('updateAnnouncement placeholder:', id, data);
  return { success: true };
};

const deleteAnnouncement = async (id: string) => {
  console.log('deleteAnnouncement placeholder:', id);
  return { success: true };
};

const createPost = async (data: any) => {
  console.log('createPost placeholder:', data);
  return { success: true };
};

const updatePost = async (id: string, data: any) => {
  console.log('updatePost placeholder:', id, data);
  return { success: true };
};

const createJoinRequest = async (orgId: string, userId: string) => {
  console.log('createJoinRequest placeholder:', orgId, userId);
  return { success: true };
};

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  status: 'Open' | 'Registration Soon' | 'Closed';
}

export default function OrganizationDetailScreen() {
  const { id } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState('posts');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, email, role } = useAuth();
  const insets = useSafeAreaInsets();
  
  // State for real data
  const [organization, setOrganization] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberFilter, setMemberFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [currentMembersPage, setCurrentMembersPage] = useState(1);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  
  // Join functionality states
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [joinReason, setJoinReason] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  // Announcement functionality states
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showEditAnnouncementModal, setShowEditAnnouncementModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    image: '',
    sendToTeams: false
  });
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [isUpdatingAnnouncement, setIsUpdatingAnnouncement] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  
  // Posts functionality states
  const [posts, setPosts] = useState<any[]>([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showEditPostModal, setShowEditPostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [postForm, setPostForm] = useState({
    title: '',
    content: '',
    media_url: '',
    visibility: 'public'
  });
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);
  
  const MEMBERS_PER_PAGE = 10;

  // Load organization data on component mount
  useEffect(() => {
    if (id) {
      loadOrganizationData();
    }
  }, [id]);

  // Check membership status when user is available
  useEffect(() => {
    if (user?.supabaseUser?.id && id) {
      checkMembershipStatus();
    }
  }, [user?.supabaseUser?.id, id]);
  
  // Load members when Members tab is accessed
  useEffect(() => {
    if (activeTab === 'members' && organization) {
      loadMembers();
    }
  }, [activeTab, organization]);

  const loadOrganizationData = async () => {
    try {
      setIsLoading(true);
      console.log('Loading organization data for ID:', id);

      // Load organization details
      const orgData = await fetchOrganizationById(id as string);
      console.log('Loading organization data for ID:', id);
      console.log('Organization ID type:', typeof id);
      console.log('Organization ID value:', JSON.stringify(id));
      
      setOrganization(orgData);

      // Load events, announcements, posts, and members in parallel
      const [eventsData, announcementsData, postsData, membersData] = await Promise.all([
        fetchOrganizationEvents(id as string).catch(error => {
          console.error('Failed to load events:', error);
          return [];
        }),
        fetchOrganizationAnnouncements(id as string).catch(error => {
          console.error('Failed to load announcements:', error);
          return [];
        }),
        fetchOrganizationPosts(id as string).catch(error => {
          console.error('Failed to load posts:', error);
          return [];
        }),
        fetchOrganizationMembers(id as string).catch(error => {
          console.error('Failed to load members:', error);
          return [];
        })
      ]);

      console.log('=== ORGANIZATION PAGE EVENT DEBUG ===');
      console.log('Events data received:', eventsData);
      console.log('Events data length:', eventsData?.length);
      console.log('Events data type:', typeof eventsData);
      console.log('Is events data array?', Array.isArray(eventsData));
      
      setEvents(eventsData);
      setAnnouncements(announcementsData);
      setPosts(postsData);
      setMembers(membersData);
      
      console.log('Loaded announcements:', announcementsData);
      console.log('Announcements count:', announcementsData?.length || 0);
      console.log('Loaded posts:', postsData);
      console.log('Posts count:', postsData?.length || 0);
      console.log('Loaded members:', membersData);
      console.log('Members count:', membersData?.length || 0);

      // Check membership status and join request status
      await checkMembershipStatus();
      await checkJoinRequestStatus();

      console.log('Organization data loaded successfully');

    } catch (error) {
      console.error('Error loading organization data:', error);
      Alert.alert('Error', 'Failed to load organization data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      console.log('Loading organization members...');

      const membersData = await fetchOrganizationMembers(id as string);
      setMembers(membersData);

      console.log('Organization members loaded:', membersData.length);

    } catch (error) {
      console.error('Error loading organization members:', error);
      Alert.alert('Error', 'Failed to load organization members.');
    } finally {
      setLoadingMembers(false);
    }
  };

  // Check if current user is a member of this organization
  const checkMembershipStatus = async () => {
    if (!user?.supabaseUser?.id) {
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('org_id')
        .eq('org_id', id)
        .eq('user_id', user.supabaseUser.id);

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking membership:', error);
        return;
      }

      const membershipStatus = !!(data && data.length > 0);
      setIsMember(membershipStatus);
    } catch (error) {
      console.error('Error checking membership status:', error);
    }
  };

  // Check if user has already applied to join this organization
  const checkJoinRequestStatus = async () => {
    if (!user?.supabaseUser?.id || isMember) return;
    
    try {
      const { data, error } = await supabase
        .from('organization_member_requests')
        .select('member_request_id, status')
        .eq('org_id', id)
        .eq('user_id', user.supabaseUser.id)
        .eq('status', 'Pending')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking join request status:', error);
        return;
      }

      setHasApplied(!!data);
    } catch (error) {
      console.error('Error checking join request status:', error);
    }
  };

  // Handle join organization request
  const handleJoinOrganization = async () => {
    if (!user?.supabaseUser?.id || isJoining) return;

    setIsJoining(true);
    try {
      const { error } = await supabase
        .from('organization_member_requests')
        .insert({
          user_id: user.supabaseUser.id,
          org_id: id,
          status: 'Pending',
          requested_at: new Date().toISOString(),
          reason: joinReason || 'I would like to join this organization.'
        });

      if (error) {
        console.error('Error submitting join request:', error);
        Alert.alert('Error', 'Failed to submit join request. Please try again.');
        return;
      }

      setHasApplied(true);
      setShowJoinModal(false);
      setJoinReason('');
      Alert.alert('Success', 'Join request submitted successfully! You will be notified when it is reviewed.');
      
    } catch (error) {
      console.error('Error submitting join request:', error);
      Alert.alert('Error', 'Failed to submit join request. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrganizationData();
    if (activeTab === 'members') {
      await loadMembers();
    }
    setRefreshing(false);
  };

  // Get advisers and officers (leadership)
  const getLeadershipMembers = () => {
    const leadership: any[] = [];
    
    // Add advisers
    if (organization?.advisers) {
      organization.advisers.forEach((adviser: any) => {
        leadership.push({
          id: `adviser-${adviser.email}`,
          name: adviser.full_name || adviser.email?.split('@')[0]?.replace('.', ' ')?.replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Adviser',
          email: adviser.email,
          role: 'Adviser',
          position: 'Adviser',
          type: 'adviser'
        });
      });
    }
    
    // Add officers
    if (organization?.officers) {
      organization.officers.forEach((officer: any) => {
        leadership.push({
          id: `officer-${officer.email}`,
          name: officer.full_name || officer.email?.split('@')[0]?.replace('.', ' ')?.replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Officer',
          email: officer.email,
          role: 'Officer',
          position: officer.position || 'Officer',
          type: 'officer'
        });
      });
    }
    
    return leadership;
  };

  // Get regular members only
  const getRegularMembers = () => {
    if (!members) return [];
    
    return members.filter((member: any) => member.role === 'member').map((member: any) => ({
      id: `member-${member.id}`,
      name: member.name || 'Member',
      email: member.email || '',
      role: 'Member',
      position: (member.course && member.yearLevel) ? `${member.course} - ${member.yearLevel}` : 'Student',
      type: 'member',
      joinDate: member.joinDate || ''
    }));
  };

  // Filter leadership members (advisers + officers)
  const getFilteredLeadership = () => {
    let leadership = getLeadershipMembers();
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      leadership = leadership.filter(member => 
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.position.toLowerCase().includes(query)
      );
    }
    
    return leadership;
  };

  // Filter and paginate regular members
  const getFilteredAndPaginatedMembers = () => {
    let regularMembers = getRegularMembers();
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      regularMembers = regularMembers.filter(member => 
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.position.toLowerCase().includes(query)
      );
    }
    
    // Calculate pagination
    const totalMembers = regularMembers.length;
    const totalPages = Math.ceil(totalMembers / MEMBERS_PER_PAGE);
    const startIndex = (currentMembersPage - 1) * MEMBERS_PER_PAGE;
    const endIndex = startIndex + MEMBERS_PER_PAGE;
    const paginatedMembers = regularMembers.slice(startIndex, endIndex);
    
    return {
      members: paginatedMembers,
      totalMembers,
      totalPages,
      currentPage: currentMembersPage,
      hasNextPage: currentMembersPage < totalPages,
      hasPrevPage: currentMembersPage > 1
    };
  };

  // Check if user can access organization management
  const canAccessOrgManagement = () => {
    // Check if user is an officer or adviser in this organization
    const isOfficerInOrg = organization?.officers?.some((officer: any) => officer.email === email);
    const isAdviserInOrg = organization?.advisers?.some((adviser: any) => adviser.email === email);
    
    // Also check mock roles for testing (fallback)
    const hasMockPermissions = canPostAnnouncements(email) || canManageMembers(email);
    return isOfficerInOrg || isAdviserInOrg || hasMockPermissions;
  };

  // Organization management menu items
  const orgManagementItems = [
    {
      title: 'Members',
      icon: 'person.2',
      route: `/organization/${id}/members`,
      description: 'Manage member roles and permissions'
    },
    {
      title: 'Posts',
      icon: 'doc.text',
      route: `/organization/${id}/posts`,
      description: 'Create and manage posts'
    },
    {
      title: 'Files',
      icon: 'folder',
      route: `/organization/${id}/files`,
      description: 'Document and file management'
    },
    {
      title: 'Red Book',
      icon: 'book.closed',
      route: `/organization/${id}/redbook`,
      description: 'Organization records and history'
    },
    {
      title: 'Org Settings',
      icon: 'gearshape',
      route: `/organization/${id}/settings`,
      description: 'Organization configuration'
    }
  ];

  // Filter announcements by date
  const getFilteredAnnouncements = () => {
    if (dateFilter === 'all') return announcements;
    
    const now = new Date();
    const filterDate = new Date();
    
    switch (dateFilter) {
      case 'today':
        filterDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return announcements;
    }
    
    return announcements.filter((announcement: any) => 
      new Date(announcement.created_at) >= filterDate
    );
  };

  // Filter posts by date
  const getFilteredPosts = () => {
    if (dateFilter === 'all') return posts;
    
    const now = new Date();
    const filterDate = new Date();
    
    switch (dateFilter) {
      case 'today':
        filterDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return posts;
    }
    
    return posts.filter((post: any) => 
      new Date(post.created_at) >= filterDate
    );
  };

  // Handle create announcement
  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      Alert.alert('Error', 'Title and content are required');
      return;
    }

    try {
      setIsCreatingAnnouncement(true);
      
      // Call API to create announcement
      const data = await createAnnouncement(id as string, {
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        image: announcementForm.image.trim() || null,
        sendToTeams: announcementForm.sendToTeams
      });

      setAnnouncements(prev => [data.announcement, ...prev]);
      setShowAnnouncementModal(false);
      setAnnouncementForm({ title: '', content: '', image: '', sendToTeams: false });
      Alert.alert('Success', 'Announcement created successfully!');
    } catch (error) {
      console.error('Failed to create announcement:', error);
      Alert.alert('Error', 'Failed to create announcement');
    } finally {
      setIsCreatingAnnouncement(false);
    }
  };

  // Handle edit announcement
  const handleEditAnnouncement = (announcement: any) => {
    setSelectedAnnouncement(announcement);
    setAnnouncementForm({
      title: announcement.title,
      content: announcement.content,
      image: announcement.image || '',
      sendToTeams: false
    });
    setShowEditAnnouncementModal(true);
  };

  // Handle update announcement
  const handleUpdateAnnouncement = async () => {
    if (!selectedAnnouncement || !announcementForm.title.trim() || !announcementForm.content.trim()) {
      Alert.alert('Error', 'Title and content are required');
      return;
    }

    try {
      setIsUpdatingAnnouncement(true);
      
      const data = await updateAnnouncement(id as string, selectedAnnouncement.announcement_id, {
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        image: announcementForm.image.trim() || null
      });

      setAnnouncements(prev => prev.map(a => 
        a.announcement_id === selectedAnnouncement.announcement_id ? data.announcement : a
      ));
      setShowEditAnnouncementModal(false);
      setSelectedAnnouncement(null);
      setAnnouncementForm({ title: '', content: '', image: '', sendToTeams: false });
      Alert.alert('Success', 'Announcement updated successfully!');
    } catch (error) {
      console.error('Failed to update announcement:', error);
      Alert.alert('Error', 'Failed to update announcement');
    } finally {
      setIsUpdatingAnnouncement(false);
    }
  };

  // Handle delete announcement
  const handleDeleteAnnouncement = (announcement: any) => {
    Alert.alert(
      'Delete Announcement',
      `Are you sure you want to delete "${announcement.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAnnouncement(id as string, announcement.announcement_id);
              setAnnouncements(prev => prev.filter(a => a.announcement_id !== announcement.announcement_id));
              Alert.alert('Success', 'Announcement deleted successfully!');
            } catch (error) {
              console.error('Failed to delete announcement:', error);
              Alert.alert('Error', 'Failed to delete announcement');
            }
          }
        }
      ]
    );
  };

  // Handle create post
  const handleCreatePost = async () => {
    if (!postForm.title.trim() || !postForm.content.trim()) {
      Alert.alert('Error', 'Title and content are required');
      return;
    }

    try {
      setIsCreatingPost(true);
      
      const data = await createPost(id as string, {
        title: postForm.title.trim(),
        content: postForm.content.trim(),
        media_url: postForm.media_url.trim() || null,
        visibility: postForm.visibility
      });

      setPosts(prev => [data.post, ...prev]);
      setShowPostModal(false);
      setPostForm({ title: '', content: '', media_url: '', visibility: 'public' });
      Alert.alert('Success', 'Post created successfully!');
    } catch (error) {
      console.error('Failed to create post:', error);
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setIsCreatingPost(false);
    }
  };

  // Handle edit post
  const handleEditPost = (post: any) => {
    setSelectedPost(post);
    setPostForm({
      title: post.title,
      content: post.content,
      media_url: post.media_url || '',
      visibility: post.visibility
    });
    setShowEditPostModal(true);
  };

  // Handle update post
  const handleUpdatePost = async () => {
    if (!selectedPost || !postForm.title.trim() || !postForm.content.trim()) {
      Alert.alert('Error', 'Title and content are required');
      return;
    }

    try {
      setIsUpdatingPost(true);
      
      const data = await updatePost(id as string, selectedPost.post_id, {
        title: postForm.title.trim(),
        content: postForm.content.trim(),
        media_url: postForm.media_url.trim() || null,
        visibility: postForm.visibility
      });

      setPosts(prev => prev.map(p => 
        p.post_id === selectedPost.post_id ? data.post : p
      ));
      setShowEditPostModal(false);
      setSelectedPost(null);
      setPostForm({ title: '', content: '', media_url: '', visibility: 'public' });
      Alert.alert('Success', 'Post updated successfully!');
    } catch (error) {
      console.error('Failed to update post:', error);
      Alert.alert('Error', 'Failed to update post');
    } finally {
      setIsUpdatingPost(false);
    }
  };

  // Handle delete post
  const handleDeletePost = (post: any) => {
    Alert.alert(
      'Delete Post',
      `Are you sure you want to delete "${post.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(id as string, post.post_id);
              setPosts(prev => prev.filter(p => p.post_id !== post.post_id));
              Alert.alert('Success', 'Post deleted successfully!');
            } catch (error) {
              console.error('Failed to delete post:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          }
        }
      ]
    );
  };

  // Show loading state if organization data is not loaded yet
  if (isLoading || !organization) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ThemedText style={styles.loadingText}>Loading organization...</ThemedText>
      </View>
    );
  }

  // Updated tabs array
  const tabs = [
    { id: 'posts', title: 'Posts', icon: 'doc.text' },
    { id: 'announcements', title: 'Announcements', icon: 'megaphone' },
    { id: 'events', title: 'Upcoming Events', icon: 'calendar' },
    { id: 'about', title: 'About', icon: 'info.circle' },
    { id: 'members', title: 'Members', icon: 'person.2' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'posts':
        const filteredPosts = getFilteredPosts();
        console.log('Rendering posts tab');
        console.log('Total posts:', posts.length);
        console.log('Filtered posts:', filteredPosts.length);
        
        return (
          <View style={styles.tabContent}>
            {/* Header with Create Button and Date Filter */}
            <View style={styles.announcementHeader}>
              <View style={styles.announcementHeaderRow}>
                {/* Date Filter */}
                <TouchableOpacity 
                  style={styles.dateFilterButton}
                  onPress={() => {
                    Alert.alert(
                      'Filter by Date',
                      'Choose time period',
                      [
                        { text: 'All Time', onPress: () => setDateFilter('all') },
                        { text: 'Today', onPress: () => setDateFilter('today') },
                        { text: 'This Week', onPress: () => setDateFilter('week') },
                        { text: 'This Month', onPress: () => setDateFilter('month') },
                        { text: 'This Year', onPress: () => setDateFilter('year') },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <IconSymbol name="calendar" size={16} color="#6B7280" />
                  <ThemedText style={styles.dateFilterText}>
                    {dateFilter === 'all' ? 'All Time' : 
                     dateFilter === 'today' ? 'Today' :
                     dateFilter === 'week' ? 'This Week' :
                     dateFilter === 'month' ? 'This Month' : 'This Year'}
                  </ThemedText>
                </TouchableOpacity>

                {/* Create Button */}
                {canAccessOrgManagement() && (
                  <TouchableOpacity 
                    style={styles.createAnnouncementButton}
                    onPress={() => {
                      console.log('Opening post modal');
                      setShowPostModal(true);
                    }}
                  >
                    <IconSymbol name="plus" size={16} color="white" />
                    <ThemedText style={styles.createAnnouncementText}>
                      Create Post
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            {/* Reddit-style Posts with Organization Avatar */}
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post: any) => (
                <View key={post.post_id} style={[styles.redditStylePost, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                  {/* Post header with org avatar and info */}
                  <View style={styles.redditStylePostHeader}>
                    <View style={styles.redditStyleOrgAvatar}>
                      {(() => {
                        const profileImageUrl = organization.orgPic || 
                                              organization.org_pic || 
                                              organization.profilePhoto || 
                                              organization.logo || 
                                              organization.image;
                        
                        return profileImageUrl ? (
                          <Image 
                            source={{ uri: profileImageUrl }} 
                            style={styles.redditStyleOrgAvatarImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <ThemedText style={styles.redditStyleOrgAvatarText}>
                            {organization.shortName?.charAt(0) || organization.name?.charAt(0) || 'O'}
                          </ThemedText>
                        );
                      })()}
                    </View>
                    <View style={styles.redditHeaderInfo}>
                      <View style={styles.redditInlineHeader}>
                        <ThemedText style={[styles.redditOrgNameHeader, { color: colors.text }]}>
                          {organization.shortName || organization.name || 'Organization'}
                        </ThemedText>
                        <ThemedText style={[styles.redditPostTimeInline, { color: colors.tabIconDefault }]}>
                          • {new Date(post.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  {/* Post title */}
                  <ThemedText style={[styles.redditPostTitleMain, { color: colors.text }]}>
                    {post.title}
                  </ThemedText>

                  {/* Post content */}
                  <ExpandablePostText 
                    content={post.content}
                    colors={colors}
                  />

                  {/* Media if available */}
                  {post.media_url && (
                    <View style={styles.redditPostImageWrapper}>
                      <Image 
                        source={{ uri: post.media_url }} 
                        style={styles.redditPostImageMain}
                        resizeMode="cover"
                      />
                    </View>
                  )}

                  {/* Bottom action bar with clean text */}
                  <View style={styles.redditStyleActionBar}>
                    <TouchableOpacity style={styles.redditStyleActionButton}>
                      <ThemedText style={[styles.redditStyleActionText, { color: colors.tabIconDefault }]}>
                        {post.likes || 0} likes
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.redditStyleActionButton}>
                      <ThemedText style={[styles.redditStyleActionText, { color: colors.tabIconDefault }]}>
                        {post.comments || 0} comments
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.redditStyleActionButton}>
                      <ThemedText style={[styles.redditStyleActionText, { color: colors.tabIconDefault }]}>
                        Share
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <ThemedText style={styles.emptyStateText}>
                {posts.length === 0 ? 'No posts yet.' : 'No posts found for the selected time period.'}
              </ThemedText>
            )}
          </View>
        );
      
      case 'announcements':
        const filteredAnnouncements = getFilteredAnnouncements();
        console.log('Rendering announcements tab');
        console.log('Total announcements:', announcements.length);
        console.log('Filtered announcements:', filteredAnnouncements.length);
        console.log('Announcements data:', announcements);
        
        return (
          <View style={styles.tabContent}>
            {/* Header with Create Button and Date Filter */}
            <View style={styles.announcementHeader}>
              <View style={styles.announcementHeaderRow}>
                {/* Date Filter */}
                <TouchableOpacity 
                  style={styles.dateFilterButton}
                  onPress={() => {
                    // Show date filter options
                    Alert.alert(
                      'Filter by Date',
                      'Choose time period',
                      [
                        { text: 'All Time', onPress: () => setDateFilter('all') },
                        { text: 'Today', onPress: () => setDateFilter('today') },
                        { text: 'This Week', onPress: () => setDateFilter('week') },
                        { text: 'This Month', onPress: () => setDateFilter('month') },
                        { text: 'This Year', onPress: () => setDateFilter('year') },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <IconSymbol name="calendar" size={16} color="#6B7280" />
                  <ThemedText style={styles.dateFilterText}>
                    {dateFilter === 'all' ? 'All Time' : 
                     dateFilter === 'today' ? 'Today' :
                     dateFilter === 'week' ? 'This Week' :
                     dateFilter === 'month' ? 'This Month' : 'This Year'}
                  </ThemedText>
                </TouchableOpacity>

                {/* Create Button */}
                {canAccessOrgManagement() && (
                  <TouchableOpacity 
                    style={styles.createAnnouncementButton}
                    onPress={() => setShowAnnouncementModal(true)}
                  >
                    <IconSymbol name="plus" size={16} color="white" />
                    <ThemedText style={styles.createAnnouncementText}>
                      Create
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            {/* Reddit-style Announcements with Organization Avatar */}
            {filteredAnnouncements.length > 0 ? (
              filteredAnnouncements.map((announcement: any) => (
                <View key={announcement.announcement_id} style={[styles.redditStylePost, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                  {/* Post header with org avatar and info */}
                  <View style={styles.redditStylePostHeader}>
                    <View style={styles.redditStyleOrgAvatar}>
                      {(() => {
                        const profileImageUrl = organization.orgPic || 
                                              organization.org_pic || 
                                              organization.profilePhoto || 
                                              organization.logo || 
                                              organization.image;
                        
                        return profileImageUrl ? (
                          <Image 
                            source={{ uri: profileImageUrl }} 
                            style={styles.redditStyleOrgAvatarImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <ThemedText style={styles.redditStyleOrgAvatarText}>
                            {organization.shortName?.charAt(0) || organization.name?.charAt(0) || 'O'}
                          </ThemedText>
                        );
                      })()}
                    </View>
                    <View style={styles.redditHeaderInfo}>
                      <View style={styles.redditInlineHeader}>
                        <ThemedText style={[styles.redditOrgNameHeader, { color: colors.text }]}>
                          {organization.shortName || organization.name || 'Organization'}
                        </ThemedText>
                        <View style={styles.announcementTag}>
                          <ThemedText style={styles.announcementTagText}>ANNOUNCEMENT</ThemedText>
                        </View>
                        <ThemedText style={[styles.redditPostTimeInline, { color: colors.tabIconDefault }]}>
                          • {new Date(announcement.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </ThemedText>
                      </View>
                    </View>
                    
                    {/* Edit/Delete Menu for Officers/Advisers */}
                    {canAccessOrgManagement() && (
                      <TouchableOpacity 
                        style={styles.redditMenuButton}
                        onPress={() => {
                          Alert.alert(
                            'Announcement Options',
                            `"${announcement.title}"`,
                            [
                              { 
                                text: 'Edit', 
                                onPress: () => handleEditAnnouncement(announcement) 
                              },
                              { 
                                text: 'Delete', 
                                style: 'destructive',
                                onPress: () => handleDeleteAnnouncement(announcement) 
                              },
                              { text: 'Cancel', style: 'cancel' }
                            ]
                          );
                        }}
                      >
                        <IconSymbol name="ellipsis" size={16} color={colors.tabIconDefault} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Announcement title */}
                  <ThemedText style={[styles.redditPostTitleMain, { color: colors.text }]}>
                    {announcement.title}
                  </ThemedText>

                  {/* Announcement content with 2-line limit */}
                  <ExpandablePostText 
                    content={announcement.content}
                    colors={colors}
                  />

                  {/* Image if available */}
                  {(() => {
                    // Debug: Log full announcement object and available fields
                    console.log('=== ORG PAGE ANNOUNCEMENT DEBUG ===');
                    console.log('Full announcement object:', announcement);
                    console.log('Available fields:', Object.keys(announcement));
                    console.log('Image field:', announcement.image);
                    console.log('Media URL field:', announcement.media_url);
                    
                    const imageUrl = announcement.image || 
                                    announcement.media_url || 
                                    announcement.imageUrl || 
                                    announcement.picture ||
                                    announcement.img;
                    
                    return imageUrl ? (
                      <View style={styles.redditPostImageWrapper}>
                        <Image 
                          source={{ uri: imageUrl }} 
                          style={styles.redditPostImageMain}
                          resizeMode="cover"
                        />
                      </View>
                    ) : null;
                  })()}

                  {/* Text-based action bar */}
                  <View style={styles.redditStyleActionBar}>
                    <TouchableOpacity style={styles.redditStyleActionButton}>
                      <ThemedText style={[styles.redditStyleActionText, { color: colors.tabIconDefault }]}>
                        Share
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <ThemedText style={styles.emptyStateText}>
                {announcements.length === 0 ? 'No announcements yet.' : 'No announcements found for the selected time period.'}
              </ThemedText>
            )}
          </View>
        );
      
      case 'events':
        return (
          <View style={styles.tabContent}>
            <ThemedText style={[styles.sectionSubtitle, { color: colors.tabIconDefault }]}>
              Stay updated with the organization's planned activities.
            </ThemedText>
            
            {events.length > 0 ? (
              events.map((event: any) => (
                <View key={event.id} style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.eventHeader}>
                    <View style={styles.eventTitleContainer}>
                      <ThemedText style={[styles.eventTitle, { color: colors.text }]}>{event.title}</ThemedText>
                      <View style={[
                        styles.eventStatus,
                        { 
                          backgroundColor: event.status === 'Open' ? '#10B981' : 
                                         event.status === 'Registration Soon' ? '#F59E0B' : '#EF4444'
                        }
                      ]}>
                        <ThemedText style={styles.eventStatusText}>{event.status}</ThemedText>
                      </View>
                    </View>
                    {event.description && (
                      <ThemedText style={[styles.eventDescription, { color: colors.tabIconDefault }]} numberOfLines={2}>
                        {event.description}
                      </ThemedText>
                    )}
                  </View>
                  
                  <View style={styles.eventDetails}>
                    <View style={styles.eventDetailRow}>
                      <IconSymbol name="calendar" size={16} color={colors.tabIconDefault} />
                      <ThemedText style={[styles.eventDetailText, { color: colors.text }]}>{event.date}</ThemedText>
                    </View>
                    <View style={styles.eventDetailRow}>
                      <IconSymbol name="location" size={16} color={colors.tabIconDefault} />
                      <ThemedText style={[styles.eventDetailText, { color: colors.text }]}>{event.location}</ThemedText>
                    </View>
                  </View>

                  {/* Event Actions */}
                  <View style={styles.eventActions}>
                    <TouchableOpacity 
                      style={[styles.eventActionButton, { borderColor: colors.border }]}
                      onPress={() => {
                        // TODO: Implement event details view
                        Alert.alert('Event Details', `View details for ${event.title}`);
                      }}
                    >
                      <IconSymbol name="eye" size={14} color={colors.tabIconDefault} />
                      <ThemedText style={[styles.eventActionText, { color: colors.tabIconDefault }]}>View</ThemedText>
                    </TouchableOpacity>
                    
                    {event.status === 'Open' && (
                      <TouchableOpacity 
                        style={[styles.eventActionButton, styles.primaryActionButton]}
                        onPress={() => {
                          // TODO: Implement registration
                          Alert.alert('Register', `Register for ${event.title}`);
                        }}
                      >
                        <IconSymbol name="plus.circle" size={14} color="white" />
                        <ThemedText style={[styles.eventActionText, { color: 'white' }]}>Register</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyEventState}>
                <IconSymbol name="calendar" size={48} color={colors.tabIconDefault} />
                <ThemedText style={[styles.emptyStateTitle, { color: colors.text }]}>
                  No Upcoming Events
                </ThemedText>
                <ThemedText style={[styles.emptyStateText, { color: colors.tabIconDefault }]}>
                  This organization doesn't have any upcoming events scheduled at the moment.
                </ThemedText>
              </View>
            )}
          </View>
        );

      case 'about':
        const totalMembers = getLeadershipMembers().length + getRegularMembers().length;
        
        return (
          <View style={styles.tabContent}>
            <ThemedText style={styles.aboutTitle}>About Us</ThemedText>
            <ThemedText style={styles.aboutCategory}>
              {organization.category || 'Category'}
            </ThemedText>
            <ThemedText style={styles.aboutDescription}>
              {organization.description || 'No description available.'}
            </ThemedText>
            
            {/* Organization Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{totalMembers}</ThemedText>
                <ThemedText style={styles.statLabel}>Total</ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{organization.advisers?.length || 0}</ThemedText>
                <ThemedText style={styles.statLabel}>Advisers</ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{organization.officers?.length || 0}</ThemedText>
                <ThemedText style={styles.statLabel}>Officers</ThemedText>
              </View>
            </View>
          </View>
        );

      case 'members':
        const filteredLeadership = getFilteredLeadership();
        const paginatedMembersData = getFilteredAndPaginatedMembers();
        
        return (
          <View style={styles.tabContent}>
            <ThemedText style={styles.membersTitle}>Members</ThemedText>
            
            {/* Member Statistics */}
            <View style={styles.memberStatsContainer}>
              <View style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{(filteredLeadership.length + paginatedMembersData.totalMembers)}</ThemedText>
                <ThemedText style={styles.statLabel}>Total</ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{organization.advisers?.length || 0}</ThemedText>
                <ThemedText style={styles.statLabel}>Advisers</ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{organization.officers?.length || 0}</ThemedText>
                <ThemedText style={styles.statLabel}>Officers</ThemedText>
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search members..."
                value={searchQuery || ''}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setCurrentMembersPage(1); // Reset to first page when searching
                }}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {loadingMembers ? (
              <View style={styles.loadingContainer}>
                <ThemedText style={styles.loadingText}>Loading members...</ThemedText>
              </View>
            ) : (
              <>
                {/* Leadership Section (Advisers & Officers) */}
                {filteredLeadership.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <ThemedText style={styles.sectionTitle}>LEADERSHIP</ThemedText>
                    <View style={styles.leadershipTableContainer}>
                      {/* Table Header */}
                      <View style={styles.leadershipTableHeader}>
                        <ThemedText style={styles.leadershipTableHeaderText}>Name</ThemedText>
                        <ThemedText style={styles.leadershipTableHeaderText}>Role</ThemedText>
                        <ThemedText style={styles.leadershipTableHeaderText}>Position</ThemedText>
                      </View>
                      
                      {/* Table Rows */}
                      {filteredLeadership.map((item) => (
                        <View key={item.id} style={styles.leadershipTableRow}>
                          <View style={styles.leadershipTableCell}>
                            <View style={styles.leadershipCompactAvatar}>
                              <ThemedText style={styles.leadershipCompactAvatarText}>
                                {item.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                              </ThemedText>
                            </View>
                            <ThemedText style={styles.leadershipCompactName} numberOfLines={1}>
                              {item.name}
                            </ThemedText>
                          </View>
                          
                          <View style={styles.leadershipTableCell}>
                            <View style={[
                              styles.leadershipRoleBadge,
                              item.type === 'adviser' && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
                              item.type === 'officer' && { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }
                            ]}>
                              {item.type === 'officer' && (
                                <IconSymbol name="crown" size={10} color="#3730A3" style={{ marginRight: 2 }} />
                              )}
                              <ThemedText style={[
                                styles.leadershipRoleBadgeText,
                                item.type === 'adviser' && { color: '#15803D' },
                                item.type === 'officer' && { color: '#3730A3' }
                              ]}>
                                {item.role}
                              </ThemedText>
                            </View>
                          </View>
                          
                          <View style={styles.leadershipTableCell}>
                            <ThemedText style={styles.leadershipPosition} numberOfLines={1}>
                              {item.position}
                            </ThemedText>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Regular Members Section */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderWithPagination}>
                    <ThemedText style={styles.sectionTitle}>
                      MEMBERS ({paginatedMembersData.totalMembers})
                    </ThemedText>
                    {paginatedMembersData.totalPages > 1 && (
                      <ThemedText style={styles.paginationInfo}>
                        Page {paginatedMembersData.currentPage} of {paginatedMembersData.totalPages}
                      </ThemedText>
                    )}
                  </View>

                  {paginatedMembersData.members.length === 0 ? (
                    <View style={styles.emptyState}>
                      <ThemedText style={styles.emptyStateText}>
                        {searchQuery ? 'No members found matching your search.' : 'No members found.'}
                      </ThemedText>
                    </View>
                  ) : (
                    <>
                      <View style={styles.membersTableContainer}>
                        {/* Table Header */}
                        <View style={styles.membersTableHeader}>
                          <ThemedText style={styles.membersTableHeaderText}>Name</ThemedText>
                          <ThemedText style={styles.membersTableHeaderText}>Role</ThemedText>
                          <ThemedText style={styles.membersTableHeaderText}>Course</ThemedText>
                        </View>
                        
                        {/* Table Rows */}
                        {paginatedMembersData.members.map((item) => (
                          <View key={item.id} style={styles.membersTableRow}>
                            <View style={styles.membersTableCell}>
                              <View style={styles.membersCompactAvatar}>
                                <ThemedText style={styles.membersCompactAvatarText}>
                                  {item.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                </ThemedText>
                              </View>
                              <ThemedText style={styles.membersCompactName} numberOfLines={1}>
                                {item.name}
                              </ThemedText>
                            </View>
                            
                            <View style={styles.membersTableCell}>
                              <View style={styles.membersRoleBadge}>
                                <ThemedText style={styles.membersRoleBadgeText}>
                                  {item.role}
                                </ThemedText>
                              </View>
                            </View>
                            
                            <View style={styles.membersTableCell}>
                              <ThemedText style={styles.membersCourse} numberOfLines={1}>
                                {item.position || 'N/A'}
                              </ThemedText>
                            </View>
                          </View>
                        ))}
                      </View>

                      {/* Pagination */}
                      {paginatedMembersData.totalPages > 1 && (
                        <View style={styles.paginationControls}>
                          <TouchableOpacity
                            style={[styles.paginationButton, paginatedMembersData.currentPage === 1 && styles.paginationButtonDisabled]}
                            onPress={() => setCurrentMembersPage(prev => Math.max(1, prev - 1))}
                            disabled={paginatedMembersData.currentPage === 1}
                          >
                            <IconSymbol name="chevron.left" size={16} color={paginatedMembersData.currentPage === 1 ? "#D1D5DB" : "#800020"} />
                          </TouchableOpacity>

                          <ThemedText style={styles.paginationText}>
                            {((paginatedMembersData.currentPage - 1) * MEMBERS_PER_PAGE) + 1} - {Math.min(paginatedMembersData.currentPage * MEMBERS_PER_PAGE, paginatedMembersData.totalMembers)} of {paginatedMembersData.totalMembers}
                          </ThemedText>

                          <TouchableOpacity
                            style={[styles.paginationButton, paginatedMembersData.currentPage === paginatedMembersData.totalPages && styles.paginationButtonDisabled]}
                            onPress={() => setCurrentMembersPage(prev => Math.min(paginatedMembersData.totalPages, prev + 1))}
                            disabled={paginatedMembersData.currentPage === paginatedMembersData.totalPages}
                          >
                            <IconSymbol name="chevron.right" size={16} color={paginatedMembersData.currentPage === paginatedMembersData.totalPages ? "#D1D5DB" : "#800020"} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Reddit-style Subreddit Header */}
        <View style={[styles.redditSubredditHeader, { backgroundColor: colors.card }]}>
          {/* Cover Banner */}
          <View style={styles.redditBanner}>
            {organization.orgCoverPic || organization.org_coverpic || organization.coverPhoto ? (
              <Image 
                source={{ uri: organization.orgCoverPic || organization.org_coverpic || organization.coverPhoto }} 
                style={styles.redditBannerImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.redditDefaultBanner, { backgroundColor: organization.color || '#800020' }]} />
            )}
          </View>
          
          {/* Subreddit Info Row */}
          <View style={styles.redditInfoRow}>
            <View style={styles.redditAvatarContainer}>
              {(() => {
                const profileImageUrl = organization.orgPic || 
                                      organization.org_pic || 
                                      organization.profilePhoto || 
                                      organization.logo || 
                                      organization.image ||
                                      organization.avatar;
                
                return profileImageUrl ? (
                  <Image 
                    source={{ uri: profileImageUrl }} 
                    style={styles.redditSubredditAvatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.redditSubredditAvatarFallback, { backgroundColor: organization.color || '#800020' }]}>
                    <ThemedText style={styles.redditSubredditAvatarText}>
                      {organization.shortName?.charAt(0) || organization.name?.charAt(0) || 'O'}
                    </ThemedText>
                  </View>
                );
              })()}
            </View>
            
            <View style={styles.redditSubredditInfo}>
              <View style={styles.redditTitleRow}>
                <ThemedText style={[styles.redditSubredditName, { color: colors.text }]}>
                  {organization.name || 'Organization Name'}
                </ThemedText>
                <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
              </View>
              <View style={styles.redditMetaRow}>
                <TouchableOpacity onPress={() => setActiveTab('members')}>
                  <ThemedText style={[styles.redditMemberCount, { color: colors.tabIconDefault }]}>
                    {members.length} members
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.redditJoinButton, { backgroundColor: isMember ? '#800020' : '#800020', opacity: isMember ? 0.7 : 1 }]}
                  onPress={isMember ? undefined : () => setShowJoinModal(true)}
                  disabled={isMember || isJoining || hasApplied}
                >
                  <ThemedText style={styles.redditJoinButtonText}>
                    {hasApplied ? 'Pending' : (isMember ? 'Joined' : 'Join')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          {/* Description */}
          {organization.description && (
            <View style={styles.redditDescriptionContainer}>
              <ExpandableOrgDescription 
                content={organization.description}
                colors={colors}
              />
            </View>
          )}
        </View>


        {/* Modern Reddit-style Navigation */}
        <View style={[styles.modernNavContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modernNavContent}
          >
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.modernNavButton,
                  activeTab === tab.id && [styles.activeNavButton, { backgroundColor: 'rgba(128, 0, 32, 0.1)' }]
                ]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
              >
                <View style={styles.navButtonContent}>
                  <ThemedText style={[
                    styles.navButtonText,
                    { color: colors.tabIconDefault },
                    activeTab === tab.id && { color: '#800020', fontWeight: '700' }
                  ]}>
                    {tab.title}
                  </ThemedText>
                  {activeTab === tab.id && (
                    <View style={styles.activeIndicator} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        <View style={styles.contentContainer}>
          {renderTabContent()}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Action Button for Organization Management */}
      {canAccessOrgManagement() && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowOrgMenu(true)}
          activeOpacity={0.8}
        >
          <IconSymbol name="gearshape.fill" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Organization Management Menu Overlay */}
      {showOrgMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity 
            style={styles.menuBackdrop} 
            onPress={() => setShowOrgMenu(false)}
            activeOpacity={1}
          />
          <View style={[styles.orgMenuContainer, { paddingBottom: Math.max(insets.bottom, 16) + 18 }]}>
            <View style={styles.orgMenuHeader}>
              <ThemedText style={styles.orgMenuTitle}>Org Menu</ThemedText>
              <TouchableOpacity 
                onPress={() => setShowOrgMenu(false)}
                style={styles.closeButton}
              >
                <IconSymbol name="xmark" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.orgMenuContent}
              showsVerticalScrollIndicator={false}
            >
              {orgManagementItems.map((item, index) => (
                <TouchableOpacity
                  key={item.title}
                  style={styles.orgMenuItem}
                  onPress={() => {
                    setShowOrgMenu(false);
                    router.push(item.route as any);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.orgMenuItemIcon}>
                    <IconSymbol name={item.icon as any} size={20} color="#800020" />
                  </View>
                  <View style={styles.orgMenuItemContent}>
                    <ThemedText style={styles.orgMenuItemTitle}>{item.title}</ThemedText>
                    <ThemedText style={styles.orgMenuItemDescription}>{item.description}</ThemedText>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Join Organization Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Join Organization</ThemedText>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowJoinModal(false)}
              >
                <IconSymbol name="xmark" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalDescription}>
                Tell us why you'd like to join {organization?.name}. This will help the administrators review your request.
              </ThemedText>
              
              <TextInput
                style={styles.reasonInput}
                placeholder="I would like to join this organization because..."
                value={joinReason || ''}
                onChangeText={setJoinReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowJoinModal(false)}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleJoinOrganization}
                  disabled={isJoining}
                >
                  <ThemedText style={styles.submitButtonText}>
                    {isJoining ? 'Submitting...' : 'Submit Request'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Announcement Modal */}
      <Modal
        visible={showAnnouncementModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnnouncementModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            height: '90%',
            paddingBottom: 20,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
            }}>
              <ThemedText style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
                Create Announcement
              </ThemedText>
              <TouchableOpacity onPress={() => setShowAnnouncementModal(false)}>
                <IconSymbol name="xmark" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText style={{
                fontSize: 14,
                color: '#6B7280',
                marginBottom: 16,
                lineHeight: 20,
              }}>
                Share important updates and information with your organization members.
              </ThemedText>
              
              <View style={{ marginBottom: 16 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                  Title
                </ThemedText>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: '#111827',
                  }}
                  placeholder="Enter announcement title..."
                  value={announcementForm.title || ''}
                  onChangeText={(text) => setAnnouncementForm(prev => ({ ...prev, title: text }))}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                  Content
                </ThemedText>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    minHeight: 100,
                    color: '#111827',
                  }}
                  placeholder="Write your announcement content here..."
                  value={announcementForm.content || ''}
                  onChangeText={(text) => setAnnouncementForm(prev => ({ ...prev, content: text }))}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                  Media URL (Optional)
                </ThemedText>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: '#111827',
                  }}
                  placeholder="https://example.com/image.jpg"
                  value={announcementForm.image || ''}
                  onChangeText={(text) => setAnnouncementForm(prev => ({ ...prev, image: text }))}
                />
              </View>
              
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: 20,
                paddingHorizontal: 20,
                paddingBottom: 20,
              }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    alignItems: 'center',
                  }}
                  onPress={() => setShowAnnouncementModal(false)}
                  disabled={isCreatingAnnouncement}
                >
                  <ThemedText style={{ fontSize: 14, fontWeight: '500', color: '#6B7280' }}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor: '#800020',
                    alignItems: 'center',
                    opacity: (isCreatingAnnouncement || !(announcementForm.title || '').trim() || !(announcementForm.content || '').trim()) ? 0.5 : 1,
                  }}
                  onPress={handleCreateAnnouncement}
                  disabled={isCreatingAnnouncement || !(announcementForm.title || '').trim() || !(announcementForm.content || '').trim()}
                >
                  <ThemedText style={{ fontSize: 14, fontWeight: '500', color: 'white' }}>
                    {isCreatingAnnouncement ? 'Creating...' : 'Create Announcement'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Announcement Modal */}
      <Modal
        visible={showEditAnnouncementModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditAnnouncementModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            height: '90%',
            paddingBottom: 20,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
            }}>
              <ThemedText style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
                Edit Announcement
              </ThemedText>
              <TouchableOpacity onPress={() => setShowEditAnnouncementModal(false)}>
                <IconSymbol name="xmark" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ marginBottom: 16 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                  Title
                </ThemedText>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: '#111827',
                  }}
                  placeholder="Enter announcement title..."
                  value={announcementForm.title || ''}
                  onChangeText={(text) => setAnnouncementForm(prev => ({ ...prev, title: text }))}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                  Content
                </ThemedText>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    minHeight: 100,
                    color: '#111827',
                  }}
                  placeholder="Write your announcement content here..."
                  value={announcementForm.content || ''}
                  onChangeText={(text) => setAnnouncementForm(prev => ({ ...prev, content: text }))}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                  Media URL (Optional)
                </ThemedText>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: '#111827',
                  }}
                  placeholder="https://example.com/image.jpg"
                  value={announcementForm.image || ''}
                  onChangeText={(text) => setAnnouncementForm(prev => ({ ...prev, image: text }))}
                />
              </View>
              
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: 20,
                paddingHorizontal: 20,
                paddingBottom: 20,
              }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    alignItems: 'center',
                  }}
                  onPress={() => setShowEditAnnouncementModal(false)}
                  disabled={isUpdatingAnnouncement}
                >
                  <ThemedText style={{ fontSize: 14, fontWeight: '500', color: '#6B7280' }}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor: '#800020',
                    alignItems: 'center',
                    opacity: (isUpdatingAnnouncement || !(announcementForm.title || '').trim() || !(announcementForm.content || '').trim()) ? 0.5 : 1,
                  }}
                  onPress={handleUpdateAnnouncement}
                  disabled={isUpdatingAnnouncement || !(announcementForm.title || '').trim() || !(announcementForm.content || '').trim()}
                >
                  <ThemedText style={{ fontSize: 14, fontWeight: '500', color: 'white' }}>
                    {isUpdatingAnnouncement ? 'Updating...' : 'Update Announcement'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Post Modal */}
      <Modal
        visible={showPostModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPostModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            height: '90%',
            paddingBottom: 20,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
              <ThemedText style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>
                Create Post
              </ThemedText>
              <TouchableOpacity onPress={() => setShowPostModal(false)}>
                <IconSymbol name="xmark" size={20} color={colors.tabIconDefault} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText style={{
                fontSize: 14,
                color: colors.tabIconDefault,
                marginBottom: 16,
                lineHeight: 20,
              }}>
                Share news, achievements, and stories with your organization members.
              </ThemedText>
              
              <View style={{ marginBottom: 16 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>
                  Title
                </ThemedText>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: colors.text,
                    backgroundColor: colors.card,
                  }}
                  placeholder="Enter post title..."
                  placeholderTextColor={colors.tabIconDefault}
                  value={postForm.title || ''}
                  onChangeText={(text) => setPostForm(prev => ({ ...prev, title: text }))}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>
                  Content
                </ThemedText>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    minHeight: 100,
                    color: colors.text,
                    backgroundColor: colors.card,
                  }}
                  placeholder="Write your post content here..."
                  placeholderTextColor={colors.tabIconDefault}
                  value={postForm.content || ''}
                  onChangeText={(text) => setPostForm(prev => ({ ...prev, content: text }))}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>
                  Media URL (Optional)
                </ThemedText>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: colors.text,
                    backgroundColor: colors.card,
                  }}
                  placeholder="https://example.com/image.jpg"
                  placeholderTextColor={colors.tabIconDefault}
                  value={postForm.media_url || ''}
                  onChangeText={(text) => setPostForm(prev => ({ ...prev, media_url: text }))}
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 }}>
                  Visibility
                </ThemedText>
                <TouchableOpacity 
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    padding: 12,
                    backgroundColor: colors.card,
                  }}
                  onPress={() => {
                    Alert.alert(
                      'Post Visibility',
                      'Choose who can see this post',
                      [
                        { text: 'Public', onPress: () => setPostForm(prev => ({ ...prev, visibility: 'public' })) },
                        { text: 'Members Only', onPress: () => setPostForm(prev => ({ ...prev, visibility: 'members_only' })) },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <ThemedText style={{ fontSize: 14, color: colors.text }}>
                    {(postForm.visibility || 'members_only') === 'public' ? 'Public' : 'Members Only'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
              
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: 20,
                paddingHorizontal: 20,
                paddingBottom: 20,
              }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    backgroundColor: colors.card,
                  }}
                  onPress={() => setShowPostModal(false)}
                  disabled={isCreatingPost}
                >
                  <ThemedText style={{ fontSize: 14, fontWeight: '500', color: colors.tabIconDefault }}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor: '#800020',
                    alignItems: 'center',
                    opacity: (isCreatingPost || !postForm.title.trim() || !postForm.content.trim()) ? 0.5 : 1,
                  }}
                  onPress={handleCreatePost}
                  disabled={isCreatingPost || !postForm.title.trim() || !postForm.content.trim()}
                >
                  <ThemedText style={{ fontSize: 14, fontWeight: '500', color: 'white' }}>
                    {isCreatingPost ? 'Creating...' : 'Create Post'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Post Modal */}
      <Modal
        visible={showEditPostModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditPostModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Edit Post</ThemedText>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowEditPostModal(false)}
              >
                <IconSymbol name="xmark" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Title</ThemedText>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter post title..."
                  value={postForm.title || ''}
                  onChangeText={(text) => setPostForm(prev => ({ ...prev, title: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Content</ThemedText>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Write your post content here..."
                  value={postForm.content || ''}
                  onChangeText={(text) => setPostForm(prev => ({ ...prev, content: text }))}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Media URL (Optional)</ThemedText>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://example.com/image.jpg"
                  value={postForm.media_url || ''}
                  onChangeText={(text) => setPostForm(prev => ({ ...prev, media_url: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Visibility</ThemedText>
                <TouchableOpacity 
                  style={styles.textInput}
                  onPress={() => {
                    Alert.alert(
                      'Post Visibility',
                      'Choose who can see this post',
                      [
                        { text: 'Public', onPress: () => setPostForm(prev => ({ ...prev, visibility: 'public' })) },
                        { text: 'Members Only', onPress: () => setPostForm(prev => ({ ...prev, visibility: 'members_only' })) },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <ThemedText style={styles.selectText}>
                    {(postForm.visibility || 'members_only') === 'public' ? 'Public' : 'Members Only'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowEditPostModal(false)}
                  disabled={isUpdatingPost}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleUpdatePost}
                  disabled={isUpdatingPost || !postForm.title.trim() || !postForm.content.trim()}
                >
                  <ThemedText style={styles.submitButtonText}>
                    {isUpdatingPost ? 'Updating...' : 'Update Post'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Reddit-style Header
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 1000,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  // Reddit-style Organization Header
  redditOrgHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  orgHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgAvatarContainer: {
    width: 48,
    height: 48,
  },
  redditOrgAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  redditOrgAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redditOrgAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  orgInfoContent: {
    flex: 1,
  },
  redditOrgName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  orgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  redditOrgCategory: {
    fontSize: 12,
    fontWeight: '500',
  },
  orgMetaSeparator: {
    fontSize: 12,
  },
  redditStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  redditStatusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  orgDescription: {
    fontSize: 13,
    lineHeight: 16,
  },
  // Compact Organization Header
  compactOrgHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  compactHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactAvatarContainer: {
    width: 40,
    height: 40,
  },
  compactOrgAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  compactOrgAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactOrgAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  compactOrgInfo: {
    flex: 1,
  },
  compactOrgName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  compactOrgCategory: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactStatusContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Compact Member Status
  compactMemberStatus: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  compactMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  compactMemberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Beautiful Minimalist Design
  miniCoverContainer: {
    height: 120,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  miniCoverImage: {
    width: '100%',
    height: '100%',
  },
  miniDefaultCover: {
    width: '100%',
    height: '100%',
  },
  miniCoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  beautifulOrgCard: {
    marginHorizontal: 16,
    marginTop: -30,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  orgCardContent: {
    padding: 20,
  },
  overlappingAvatar: {
    position: 'absolute',
    top: -30,
    left: 20,
    zIndex: 10,
  },
  beautifulOrgAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'white',
  },
  beautifulOrgAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  beautifulOrgAvatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  orgCardInfo: {
    marginTop: 35,
  },
  orgTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  beautifulOrgName: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
    lineHeight: 24,
  },
  statusBadgeContainer: {
    marginTop: 2,
  },
  beautifulOrgCategory: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  beautifulOrgDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Beautiful Member Status
  beautifulMemberStatus: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  beautifulMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignSelf: 'flex-start',
  },
  beautifulMemberText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Reddit Subreddit Style
  redditSubredditHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDEFF1',
  },
  redditBanner: {
    height: 80,
    width: '100%',
  },
  redditBannerImage: {
    width: '100%',
    height: '100%',
  },
  redditDefaultBanner: {
    width: '100%',
    height: '100%',
  },
  redditInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  redditAvatarContainer: {
    width: 48,
    height: 48,
  },
  redditSubredditAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'white',
  },
  redditSubredditAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  redditSubredditAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  redditSubredditInfo: {
    flex: 1,
  },
  redditTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  redditSubredditName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  redditMemberCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  redditMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  redditJoinButton: {
    backgroundColor: '#800020',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  redditJoinButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  redditDescriptionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  redditDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Modern Navigation Buttons
  modernNavContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  modernNavContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  modernNavButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeNavButton: {
    borderWidth: 1,
    borderColor: '#800020',
  },
  navButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -16,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 3,
    backgroundColor: '#800020',
    borderRadius: 2,
  },
  // Reddit-style Post Cards
  redditPostCard: {
    flexDirection: 'row',
    marginTop: 4,
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  postVotingColumn: {
    width: 40,
    alignItems: 'center',
    paddingTop: 4,
  },
  postVoteButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postVoteCount: {
    fontSize: 12,
    fontWeight: 'bold',
    marginVertical: 4,
    textAlign: 'center',
  },
  postMainContent: {
    flex: 1,
    paddingLeft: 8,
  },
  redditPostHeader: {
    marginBottom: 8,
  },
  postMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  postAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  postAuthor: {
    fontSize: 12,
    fontWeight: '500',
  },
  postTimestamp: {
    fontSize: 12,
    marginLeft: 4,
  },
  postHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redditVisibilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  redditVisibilityText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  postMenuButton: {
    padding: 4,
  },
  redditPostTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 20,
  },
  redditPostContent: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  redditPostMedia: {
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  redditPostImage: {
    width: '100%',
    height: 200,
  },
  redditActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  redditActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  redditActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Compact Post Header (prevents overflow)
  compactPostHeader: {
    marginBottom: 6,
  },
  compactPostMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  compactPostAuthor: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  compactPostActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  compactVisibilityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  compactVisibilityText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  compactMenuButton: {
    padding: 2,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Facebook + Reddit Hybrid Post Design
  hybridPostCard: {
    marginVertical: 6,
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  facebookPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  postAuthorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orgAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#800020',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orgAvatarSmallText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  postAuthorDetails: {
    flex: 1,
  },
  postOrgName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  postMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postTimeText: {
    fontSize: 12,
    fontWeight: '400',
  },
  hybridVisibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  hybridVisibilityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  facebookMenuButton: {
    padding: 8,
    borderRadius: 20,
  },
  hybridPostContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  hybridPostTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  hybridPostText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  hybridPostMedia: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  hybridPostImage: {
    width: '100%',
    height: 200,
  },
  hybridEngagementStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    fontSize: 12,
    fontWeight: '500',
  },
  facebookActionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  facebookActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  facebookActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  showMoreButton: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  redditPostTextCompact: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  showMoreInline: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Reddit-style icon-only action bar
  redditIconActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    gap: 24,
  },
  redditIconButton: {
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pure Reddit-style Post Layout
  pureRedditPost: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  redditVoteColumn: {
    width: 40,
    alignItems: 'center',
    paddingTop: 4,
  },
  redditVoteNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  redditMainContent: {
    flex: 1,
    paddingLeft: 12,
  },
  redditPostMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  redditPostOrgName: {
    fontSize: 12,
    fontWeight: '600',
  },
  redditPostTime: {
    fontSize: 12,
    marginLeft: 4,
  },
  redditPublicBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  redditPublicText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  redditPostImageContainer: {
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  redditEngagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  redditEngagementText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // New Reddit-style Post Layout (with org avatar)
  redditStylePost: {
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
  },
  redditStylePostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  redditStyleOrgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#800020',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  redditStyleOrgAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  redditStyleOrgAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  redditHeaderInfo: {
    flex: 1,
  },
  redditInlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redditOrgNameHeader: {
    fontSize: 12,
    fontWeight: '600',
  },
  redditPostTimeInline: {
    fontSize: 10,
    marginLeft: 4,
  },
  redditPostTitleMain: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 18,
  },
  redditPostImageWrapper: {
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  redditPostImageMain: {
    width: '100%',
    height: 200,
  },
  redditActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  redditActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  redditActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  redditStyleActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  redditStyleActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  redditStyleActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  announcementBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  announcementBadgeText: {
    fontSize: 10,
  },
  announcementTag: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#800020',
  },
  announcementTagText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 0.5,
  },
  redditMenuButton: {
    padding: 8,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  // Cover photo styles
  coverContainer: {
    height: 200,
    marginHorizontal: 0,
    marginTop: 0,
    overflow: 'hidden',
  },
  heroBanner: {
    height: 200,
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  defaultCover: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
  },
  heroLogo: {
    marginBottom: 20,
  },
  heroLogoText: {
    fontSize: 48,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -1,
    marginBottom: 8,
  },
  heroSubtext: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  heroIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  heroIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Facebook-style layout
  orgInfoContainer: {
    position: 'relative',
  },
  profilePictureContainer: {
    position: 'absolute',
    top: -80,
    left: 20,
    zIndex: 10,
  },
  orgInfo: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingTop: 100, // Space for overlapping profile picture
    marginTop: 0,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  orgAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'white',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    backgroundColor: 'white',
  },
  orgAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 56, // Slightly smaller than container to ensure proper clipping
  },
  orgAvatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgAvatarText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
  },
  orgDetails: {
    flex: 1,
  },
  orgName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  orgCategory: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  joinButtonContainer: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#800020',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  appliedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  appliedButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  memberStatusContainer: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  memberStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    gap: 8,
  },
  memberStatusText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  tabsContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginTop: 20,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#800020',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#800020',
    fontWeight: '600',
  },
  contentContainer: {
    backgroundColor: 'transparent',
  },
  tabContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    minHeight: 200,
  },
  bottomPadding: {
    height: 40,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#800020',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 9999,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  menuBackdrop: {
    flex: 1,
  },
  orgMenuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: '15%',
  },
  orgMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  orgMenuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  orgMenuContent: {
    flex: 1,
    paddingVertical: 8,
  },
  orgMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  orgMenuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  orgMenuItemContent: {
    flex: 1,
  },
  orgMenuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  orgMenuItemDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 20,
    color: '#111827',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Tab content styles
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 40,
  },
  postAnnouncementButton: {
    backgroundColor: '#800020',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  postAnnouncementText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  eventCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventHeader: {
    marginBottom: 12,
  },
  eventTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
    lineHeight: 24,
  },
  eventDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  eventStatus: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  eventStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  eventDetails: {
    gap: 12,
    marginBottom: 16,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventDetailText: {
    fontSize: 15,
    fontWeight: '500',
  },
  eventActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  eventActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  primaryActionButton: {
    backgroundColor: '#800020',
    borderColor: '#800020',
  },
  eventActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyEventState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  eventTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  eventActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  primaryActionButton: {
    backgroundColor: '#800020',
    borderColor: '#800020',
  },
  eventActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyEventState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#800020',
    marginBottom: 8,
  },
  aboutCategory: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  aboutDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#800020',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Members tab styles
  membersTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#800020',
    marginBottom: 8,
  },
  memberStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  sectionHeaderWithPagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  paginationInfo: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  // Leadership table styles
  leadershipTableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginTop: 8,
  },
  leadershipTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  leadershipTableHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  leadershipTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  leadershipTableCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadershipCompactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#800020',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  leadershipCompactAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  leadershipCompactName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
  },
  leadershipRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  leadershipRoleBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  leadershipPosition: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Members table styles
  membersTableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginTop: 8,
  },
  membersTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  membersTableHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  membersTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  membersTableCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersCompactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#800020',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  membersCompactAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  membersCompactName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
  },
  membersRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  membersRoleBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  membersCourse: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Pagination styles
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  
  // Announcement styles
  announcementHeader: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  announcementHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  dateFilterText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  createAnnouncementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#800020',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  createAnnouncementText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  announcementCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  announcementTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  announcementMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  announcementDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  announcementMenuButton: {
    padding: 4,
    borderRadius: 4,
  },
  announcementContent: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  announcementImageContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  announcementImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  
  // Modal input styles
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  
  // Post-specific styles
  postVisibilityBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  postVisibilityText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 12,
  },
  postActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  postActionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  selectText: {
    fontSize: 16,
    color: '#374151',
  },
});
