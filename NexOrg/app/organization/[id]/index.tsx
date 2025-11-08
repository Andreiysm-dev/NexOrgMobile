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
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/hooks/useAuth';
import { canPostAnnouncements, canManageMembers } from '@/lib/mockRoles';
import { fetchOrganizationById, fetchOrganizationMembers, fetchOrganizationEvents, createPost, createAnnouncement, updatePost, updateAnnouncement, deleteAnnouncement } from '@/lib/api';
import { deletePost } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/feed/PostCard';
import { AnnouncementCard } from '@/components/feed/AnnouncementCard';
import { PollCard } from '@/components/feed/PollCard';
import { PostModal } from '@/components/feed/PostModal';
// Image picker - requires native rebuild for remote users
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('ImagePicker not available - native module not installed');
}

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

    return announcements || [];
  } catch (error) {
    console.error('Error in fetchOrganizationAnnouncements:', error);
    return [];
  }
};

const fetchOrganizationPosts = async (orgId: string) => {
  try {
    // Fetch posts for this organization with organization info
    const { data: posts, error: postsError } = await supabase
      .from('organization_posts')
      .select(`
        *,
        organizations!inner(org_id, org_name, org_pic)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      return [];
    }

    if (!posts || posts.length === 0) {
      return [];
    }

    // For each post, get like and comment counts
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        if (!post || !post.post_id) {
          console.warn('Invalid post object:', post);
          return null;
        }

        // Get like count
        const { count: likeCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.post_id);

        // Get comment count
        const { count: commentCount } = await supabase
          .from('post_comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.post_id);

        return {
          ...post,
          like_count: likeCount || 0,
          comment_count: commentCount || 0,
          created_at: post.created_at || new Date().toISOString(),
        };
      })
    );

    // Filter out any null values
    return postsWithCounts.filter(post => post !== null);
  } catch (error) {
    console.error('Error in fetchOrganizationPosts:', error);
    return [];
  }
};

const fetchOrganizationPolls = async (orgId: string) => {
  try {
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user for polls');
      return [];
    }

    // Check if user is a member of the organization
    const { data: memberCheck } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    const isMember = !!memberCheck;

    // Fetch polls from Supabase - if not a member, only fetch public polls
    let pollsQuery = supabase
      .from('polls')
      .select('*')
      .eq('org_id', orgId);

    if (!isMember) {
      pollsQuery = pollsQuery.eq('visibility', 'public');
    }

    const { data: polls, error: pollsError } = await pollsQuery.order('created_at', { ascending: false });

    if (pollsError) {
      console.error('Error fetching polls:', pollsError);
      return [];
    }

    if (!polls || polls.length === 0) {
      return [];
    }

    // Fetch poll options for all polls
    const pollIds = polls.map((p: any) => p.poll_id);
    const { data: options, error: optionsError } = await supabase
      .from('poll_options')
      .select('*')
      .in('poll_id', pollIds);

    if (optionsError) {
      console.error('Error fetching poll options:', optionsError);
      return [];
    }

    // Fetch user votes
    const { data: userVotes, error: votesError } = await supabase
      .from('poll_votes')
      .select('poll_id, option_id')
      .eq('user_id', user.id)
      .in('poll_id', pollIds);

    if (votesError) {
      console.error('Error fetching user votes:', votesError);
    }

    // Group options by poll_id
    const optionsByPoll = (options || []).reduce((acc: any, option: any) => {
      if (!acc[option.poll_id]) {
        acc[option.poll_id] = [];
      }
      acc[option.poll_id].push(option);
      return acc;
    }, {});

    // Group user votes by poll_id
    const votesByPoll = (userVotes || []).reduce((acc: any, vote: any) => {
      if (!acc[vote.poll_id]) {
        acc[vote.poll_id] = [];
      }
      acc[vote.poll_id].push(vote.option_id);
      return acc;
    }, {});

    // Format polls with options and user votes
    const formattedPolls = polls.map((poll: any) => {
      const pollOptions = optionsByPoll[poll.poll_id] || [];
      const totalVotes = pollOptions.reduce((sum: number, opt: any) => sum + (opt.vote_count || 0), 0);
      const now = new Date();
      const expiresAt = new Date(poll.expires_at);
      const isExpired = now > expiresAt;

      return {
        poll_id: poll.poll_id,
        question: poll.question,
        options: pollOptions.map((opt: any) => ({
          option_id: opt.option_id,
          option_text: opt.option_text,
          vote_count: opt.vote_count || 0
        })),
        total_votes: totalVotes,
        expires_at: poll.expires_at,
        allow_multiple: poll.allow_multiple,
        visibility: poll.visibility || 'members_only',
        created_at: poll.created_at,
        user_votes: votesByPoll[poll.poll_id] || [],
        is_expired: isExpired
      };
    });

    return formattedPolls;
  } catch (error) {
    console.error('Error in fetchOrganizationPolls:', error);
    return [];
  }
};

// Old local API functions removed - now using imports from @/lib/api

const createJoinRequest = async (orgId: string, userId: string) => {
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
  const [activeTab, setActiveTab] = useState('feed'); // Changed from 'posts' to 'feed'
  const [feedFilter, setFeedFilter] = useState('all'); // New: filter for feed items (all, posts, announcements, events, polls)
  const [showCreateModal, setShowCreateModal] = useState(false); // New: modal for create options
  const [showFeedFilterDropdown, setShowFeedFilterDropdown] = useState(false); // New: show feed filter dropdown
  const [showDateFilterDropdown, setShowDateFilterDropdown] = useState(false); // New: show date filter dropdown
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, email, role } = useAuth();
  const insets = useSafeAreaInsets();
  
  // State for real data
  const [organization, setOrganization] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
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
  const [selectedAnnouncementImage, setSelectedAnnouncementImage] = useState<string | null>(null);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [isUpdatingAnnouncement, setIsUpdatingAnnouncement] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  
  // Posts functionality states
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedPostForModal, setSelectedPostForModal] = useState<any>(null);
  const [isPostModalVisible, setIsPostModalVisible] = useState(false);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());
  const [showPostModal, setShowPostModal] = useState(false);
  const [showEditPostModal, setShowEditPostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [postForm, setPostForm] = useState({
    title: '',
    content: '',
    media_url: '',
    visibility: 'public'
  });
  const [selectedPostImages, setSelectedPostImages] = useState<string[]>([]);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);
  
  // Poll functionality states
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollForm, setPollForm] = useState({
    question: '',
    options: ['', ''],
    duration_hours: 24,
    allow_multiple: false,
    visibility: 'members_only' as 'public' | 'members_only'
  });
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  
  // Reactions functionality states
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [reactions, setReactions] = useState<any[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [reactionsSearchQuery, setReactionsSearchQuery] = useState('');
  
  // Poll voters functionality states
  const [showVotersModal, setShowVotersModal] = useState(false);
  const [voters, setVoters] = useState<any[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [votersSearchQuery, setVotersSearchQuery] = useState('');
  const [selectedOptionFilter, setSelectedOptionFilter] = useState('all');
  const [selectedPollForVoters, setSelectedPollForVoters] = useState<any>(null);
  
  // Actions menu state for members
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  
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

      // Load organization details
      const orgData = await fetchOrganizationById(id as string);
      
      setOrganization(orgData);

      // Load events, announcements, posts, polls, and members in parallel
      const [eventsData, announcementsData, postsData, pollsData, membersData] = await Promise.all([
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
        fetchOrganizationPolls(id as string).catch(error => {
          console.error('Failed to load polls:', error);
          return [];
        }),
        fetchOrganizationMembers(id as string).catch(error => {
          console.error('Failed to load members:', error);
          return [];
        })
      ]);

      setEvents(eventsData);
      setAnnouncements(announcementsData);
      setPosts(postsData);
      setPolls(pollsData);
      setMembers(membersData);

      // Check membership status and join request status
      await checkMembershipStatus();
      await checkJoinRequestStatus();

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

      const membersData = await fetchOrganizationMembers(id as string);
      setMembers(membersData);

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

  // Handle leave organization
  const handleLeaveOrganization = async () => {
    if (!user?.supabaseUser?.id || isLeaving) return;

    Alert.alert(
      'Leave Organization',
      `Are you sure you want to leave ${organization?.name}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setIsLeaving(true);
            try {
              const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/organizations/${id}/leave`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to leave organization');
              }

              Alert.alert('Success', 'You have left the organization successfully.');
              setIsMember(false);
              setShowActionsMenu(false);
              router.back();
            } catch (error) {
              console.error('Error leaving organization:', error);
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to leave organization. Please try again.');
            } finally {
              setIsLeaving(false);
            }
          }
        }
      ]
    );
  };

  // Handle copy organization ID
  const handleCopyOrgId = () => {
    try {
      Clipboard.setString(id as string);
      Alert.alert('Success', 'Organization ID copied to clipboard!');
      setShowActionsMenu(false);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy organization ID');
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
      
      // Upload image to Supabase storage if there's a local image
      let imageUrl: string | null = null;
      if (selectedAnnouncementImage) {
        const uploadedUrls = await uploadImagesToStorage([selectedAnnouncementImage], 'announcement');
        if (uploadedUrls.length > 0) {
          imageUrl = uploadedUrls[0];
        } else {
          Alert.alert('Warning', 'Failed to upload image. Announcement will be created without image.');
        }
      } else if (announcementForm.image.trim()) {
        // Use URL input if provided
        imageUrl = announcementForm.image.trim();
      }
      
      // Call API to create announcement
      const data = await createAnnouncement(id as string, {
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        image: imageUrl,
        sendToTeams: announcementForm.sendToTeams
      });

      setAnnouncements(prev => [data.announcement, ...prev]);
      setShowAnnouncementModal(false);
      setAnnouncementForm({ title: '', content: '', image: '', sendToTeams: false });
      setSelectedAnnouncementImage(null);
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

  // Image picker for posts
  const pickPostImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Image Picker Unavailable', 'Please rebuild the app to use image picker');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const imageUris = result.assets.map(asset => asset.uri);
      setSelectedPostImages(prev => [...prev, ...imageUris]);
      setPostForm(prev => ({ ...prev, media_url: '' }));
    }
  };

  const removePostImage = (index: number) => {
    setSelectedPostImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllPostImages = () => {
    setSelectedPostImages([]);
  };

  // Image picker for announcements
  const pickAnnouncementImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Image Picker Unavailable', 'Please rebuild the app to use image picker');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedAnnouncementImage(result.assets[0].uri);
      setAnnouncementForm(prev => ({ ...prev, image: '' }));
    }
  };

  const removeAnnouncementImage = () => {
    setSelectedAnnouncementImage(null);
  };

  // Upload images directly to Supabase storage
  const uploadImagesToStorage = async (imageUris: string[], type: 'post' | 'announcement'): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const uri of imageUris) {
      try {
        // Get file extension
        const filename = uri.split('/').pop() || `${type}-${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1] : 'jpg';
        
        // Generate unique filename
        const uniqueFilename = `${type}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = type === 'post' 
          ? `org_posts/${id}/${uniqueFilename}`
          : `org_announcements/${id}/${uniqueFilename}`;
        
        // Read file and convert to ArrayBuffer
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        });
        
        // Upload to Supabase storage
        const { data, error } = await supabase.storage
          .from('post-images')
          .upload(filePath, arrayBuffer, {
            contentType: `image/${ext}`,
            upsert: false
          });
        
        if (error) {
          Alert.alert('Upload Error', `Failed to upload image: ${error.message}`);
          continue;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);
        
        uploadedUrls.push(publicUrl);
      } catch (error) {
        Alert.alert('Upload Error', `Failed to upload image: ${error}`);
      }
    }
    
    return uploadedUrls;
  };

  // Handle create post
  const handleCreatePost = async () => {
    if (!postForm.title.trim() || !postForm.content.trim()) {
      Alert.alert('Error', 'Title and content are required');
      return;
    }

    try {
      setIsCreatingPost(true);
      
      // Upload images to Supabase storage if there are local images
      let mediaUrls: string[] = [];
      if (selectedPostImages.length > 0) {
        mediaUrls = await uploadImagesToStorage(selectedPostImages, 'post');
        if (mediaUrls.length === 0 && selectedPostImages.length > 0) {
          Alert.alert('Warning', 'Failed to upload images. Post will be created without images.');
        }
      } else if (postForm.media_url.trim()) {
        // Use URL input if provided
        mediaUrls = [postForm.media_url.trim()];
      }
      
      const data = await createPost(id as string, {
        title: postForm.title.trim(),
        content: postForm.content.trim(),
        media_url: mediaUrls.length > 0 ? mediaUrls[0] : null, // First image for backward compatibility
        media_urls: mediaUrls.length > 0 ? mediaUrls : null, // Array of all images
        visibility: postForm.visibility
      });
      
      if (data.error) {
        Alert.alert('Error', data.error);
        return;
      }
      
      if (!data.post) {
        Alert.alert('Error', 'Failed to create post');
        return;
      }
      
      setPosts(prev => [data.post, ...prev]);
      setShowPostModal(false);
      setPostForm({ title: '', content: '', media_url: '', visibility: 'public' });
      setSelectedPostImages([]);
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
      
      // Update post directly in Supabase
      const { data: updatedPost, error } = await supabase
        .from('organization_posts')
        .update({
          title: postForm.title.trim(),
          content: postForm.content.trim(),
          media_url: postForm.media_url.trim() || null,
          visibility: postForm.visibility
        })
        .eq('post_id', selectedPost.post_id)
        .select()
        .single();

      if (error) throw error;

      // Update local state with the updated post
      setPosts(prev => prev.map(p => 
        p.post_id === selectedPost.post_id ? { ...p, ...updatedPost } : p
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

  // Handle view poll voters
  const handleViewVoters = async (poll: any) => {
    setLoadingVoters(true);
    setShowVotersModal(true);
    setSelectedPollForVoters(poll);
    try {
      // Fetch all votes with user information
      const { data: votes, error: votesError } = await supabase
        .from('poll_votes')
        .select(`
          vote_id,
          user_id,
          option_id,
          voted_at
        `)
        .eq('poll_id', poll.poll_id)
        .order('voted_at', { ascending: false });

      if (votesError) {
        console.error('Error fetching votes:', votesError);
        Alert.alert('Error', 'Failed to fetch voters');
        setShowVotersModal(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(votes?.map((v: any) => v.user_id) || [])];

      // Fetch user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, profile_image')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Create a map of user profiles
      const profileMap = (profiles || []).reduce((acc: any, profile: any) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {});

      // Get option text map
      const optionMap = poll.options.reduce((acc: any, opt: any) => {
        acc[opt.option_id] = opt.option_text;
        return acc;
      }, {});

      // Group votes by user
      const votersList = userIds.map((userId: any) => {
        const userVotes = votes?.filter((v: any) => v.user_id === userId) || [];
        const profile = profileMap[userId];
        
        return {
          user_id: userId,
          name: profile?.full_name || 'Unknown User',
          profile_pic: profile?.profile_image || null,
          voted_at: userVotes[0]?.voted_at,
          selected_options: userVotes.map((v: any) => ({
            option_id: v.option_id,
            option_text: optionMap[v.option_id] || 'Unknown'
          }))
        };
      });

      setVoters(votersList);
    } catch (error) {
      console.error('Error fetching voters:', error);
      Alert.alert('Error', 'Failed to load voters');
      setShowVotersModal(false);
    } finally {
      setLoadingVoters(false);
    }
  };

  // Handle view reactions
  const handleViewReactions = async (postId: string) => {
    setLoadingReactions(true);
    setShowReactionsModal(true);
    try {
      // Get all likes for the post with user details
      const { data: likes, error: likesError } = await supabase
        .from('post_likes')
        .select('like_id, user_id, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (likesError) {
        console.error('Error fetching likes:', likesError);
        Alert.alert('Error', 'Failed to fetch reactions');
        setShowReactionsModal(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(likes?.map((like: any) => like.user_id) || [])];

      // Fetch user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, profile_image')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Create a map of user profiles
      const profileMap = (profiles || []).reduce((acc: any, profile: any) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {});

      // Format the reactions with user info
      const formattedReactions = (likes || []).map((like: any) => {
        const profile = profileMap[like.user_id];
        return {
          like_id: like.like_id,
          user_id: like.user_id,
          name: profile?.full_name || 'Unknown User',
          profile_image: profile?.profile_image || null,
          created_at: like.created_at
        };
      });

      setReactions(formattedReactions);
    } catch (error) {
      console.error('Error fetching reactions:', error);
      Alert.alert('Error', 'Failed to load reactions');
      setShowReactionsModal(false);
    } finally {
      setLoadingReactions(false);
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

  // Post modal handlers
  const handlePostPress = (post: any) => {
    setSelectedPostForModal(post);
    setIsPostModalVisible(true);
  };

  const handleClosePostModal = () => {
    setIsPostModalVisible(false);
    setSelectedPostForModal(null);
  };

  const handleLike = async (postId: string) => {
    // Like is handled within PostModal component
    console.log('Post liked:', postId);
  };

  const handleShare = async (postId: string) => {
    // TODO: Implement share functionality
    console.log('Share post:', postId);
  };

  const handleBookmark = (postId: string) => {
    setBookmarkedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  // Show loading state if organization data is not loaded yet
  if (isLoading || !organization) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ThemedText style={styles.loadingText}>Loading organization...</ThemedText>
      </View>
    );
  }

  // Updated tabs array - matching web version
  const tabs = [
    { id: 'feed', title: 'Feed', icon: 'doc.text' },
    { id: 'photos', title: 'Photos', icon: 'photo' },
    { id: 'about', title: 'About', icon: 'info.circle' },
    { id: 'members', title: 'Members', icon: 'person.2' }
  ];

  // Combine all feed items (posts, announcements, events, polls)
  const getCombinedFeed = () => {
    const feedItems: any[] = [];

    // Add posts
    posts.forEach((post: any) => {
      if (post && post.created_at) {
        feedItems.push({
          ...post,
          type: 'post',
          sortDate: new Date(post.created_at).getTime()
        });
      }
    });

    // Add announcements
    announcements.forEach((announcement: any) => {
      if (announcement && announcement.created_at) {
        feedItems.push({
          ...announcement,
          type: 'announcement',
          sortDate: new Date(announcement.created_at).getTime()
        });
      }
    });

    // Add events
    events.forEach((event: any) => {
      if (event) {
        feedItems.push({
          ...event,
          type: 'event',
          sortDate: new Date(event.date || event.created_at || Date.now()).getTime()
        });
      }
    });

    // Add polls
    polls.forEach((poll: any) => {
      if (poll && poll.created_at) {
        feedItems.push({
          ...poll,
          type: 'poll',
          sortDate: new Date(poll.created_at).getTime()
        });
      }
    });

    // Sort: pinned posts first, then by date (newest first)
    feedItems.sort((a, b) => {
      const aPinned = (a.is_pinned || false);
      const bPinned = (b.is_pinned || false);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return b.sortDate - a.sortDate;
    });

    // Apply feed filter
    let filteredItems = feedItems;
    if (feedFilter !== 'all') {
      filteredItems = feedItems.filter(item => {
        if (feedFilter === 'posts') return item.type === 'post';
        if (feedFilter === 'announcements') return item.type === 'announcement';
        if (feedFilter === 'events') return item.type === 'event';
        if (feedFilter === 'polls') return item.type === 'poll';
        return false;
      });
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filteredItems = filteredItems.filter(item => {
        if (!item) return false;
        const itemDate = new Date(item.created_at || item.date || Date.now());
        
        if (dateFilter === 'today') {
          const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
          return itemDay.getTime() === today.getTime();
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return itemDate >= weekAgo;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return itemDate >= monthAgo;
        } else if (dateFilter === 'year') {
          const yearAgo = new Date(today);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          return itemDate >= yearAgo;
        }
        return true;
      });
    }

    return filteredItems;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'feed':
        const combinedFeed = getCombinedFeed();
        
        return (
          <View style={styles.tabContent}>
            {/* Feed Filter and Actions */}
            <View style={styles.feedFilterContainer}>
              <View style={styles.feedHeaderActions}>
                {/* Feed Type Dropdown */}
                <View style={styles.dropdownWrapper}>
                  <TouchableOpacity 
                    style={[styles.feedTypeDropdown, { borderColor: colors.border }]}
                    onPress={() => setShowFeedFilterDropdown(!showFeedFilterDropdown)}
                  >
                    <ThemedText style={[styles.feedTypeText, { color: colors.text }]}>
                      {feedFilter === 'all' ? 'All' :
                       feedFilter === 'posts' ? 'Posts' :
                       feedFilter === 'announcements' ? 'Announcements' :
                       feedFilter === 'events' ? 'Events' : 'Polls'}
                    </ThemedText>
                    <IconSymbol name="chevron.down" size={16} color={colors.tabIconDefault} />
                  </TouchableOpacity>
                  
                  {showFeedFilterDropdown && (
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {[
                        { value: 'all', label: 'All', icon: 'square.grid.2x2' as const },
                        { value: 'posts', label: 'Posts', icon: 'doc.text' as const },
                        { value: 'announcements', label: 'Announcements', icon: 'megaphone' as const },
                        { value: 'events', label: 'Events', icon: 'calendar' as const },
                        { value: 'polls', label: 'Polls', icon: 'chart.bar' as const },
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.dropdownOption,
                            { borderBottomColor: colors.border },
                            feedFilter === option.value && { backgroundColor: 'rgba(128, 0, 32, 0.05)' }
                          ]}
                          onPress={() => {
                            setFeedFilter(option.value);
                            setShowFeedFilterDropdown(false);
                          }}
                        >
                          <IconSymbol name={option.icon} size={18} color={feedFilter === option.value ? '#800020' : colors.tabIconDefault} />
                          <ThemedText style={[
                            styles.dropdownOptionText,
                            { color: feedFilter === option.value ? '#800020' : colors.text }
                          ]}>
                            {option.label}
                          </ThemedText>
                          {feedFilter === option.value && (
                            <IconSymbol name="checkmark" size={16} color="#800020" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Date Filter Dropdown */}
                <View style={styles.dropdownWrapper}>
                  <TouchableOpacity 
                    style={[styles.dateFilterButton, { borderColor: colors.border }]}
                    onPress={() => setShowDateFilterDropdown(!showDateFilterDropdown)}
                  >
                    <IconSymbol name="calendar" size={16} color={colors.tabIconDefault} />
                    <ThemedText style={[styles.dateFilterText, { color: colors.text }]}>
                      {dateFilter === 'all' ? 'All Time' : 
                       dateFilter === 'today' ? 'Today' :
                       dateFilter === 'week' ? 'This Week' :
                       dateFilter === 'month' ? 'This Month' : 'This Year'}
                    </ThemedText>
                    <IconSymbol name="chevron.down" size={14} color={colors.tabIconDefault} />
                  </TouchableOpacity>

                  {showDateFilterDropdown && (
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {[
                        { value: 'all', label: 'All Time' },
                        { value: 'today', label: 'Today' },
                        { value: 'week', label: 'This Week' },
                        { value: 'month', label: 'This Month' },
                        { value: 'year', label: 'This Year' },
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.dropdownOption,
                            { borderBottomColor: colors.border },
                            dateFilter === option.value && { backgroundColor: 'rgba(128, 0, 32, 0.05)' }
                          ]}
                          onPress={() => {
                            setDateFilter(option.value);
                            setShowDateFilterDropdown(false);
                          }}
                        >
                          <ThemedText style={[
                            styles.dropdownOptionText,
                            { color: dateFilter === option.value ? '#800020' : colors.text }
                          ]}>
                            {option.label}
                          </ThemedText>
                          {dateFilter === option.value && (
                            <IconSymbol name="checkmark" size={16} color="#800020" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Create Button */}
                {canAccessOrgManagement() && (
                  <TouchableOpacity 
                    style={styles.createButton}
                    onPress={() => setShowCreateModal(true)}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={{ color: 'white', fontSize: 24, fontWeight: '400' }}>+</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Combined Feed */}
            {combinedFeed.length > 0 ? (
              combinedFeed.map((item: any) => {
                if (item.type === 'post') {
                  return (
                    <PostCard
                      key={`post-${item.post_id}`}
                      post={{
                        ...item,
                        organizations: {
                          org_name: organization.shortName || organization.name,
                          org_pic: organization.orgPic || organization.org_pic
                        }
                      }}
                      onPress={() => handlePostPress(item)}
                      onLikeUpdate={(postId, liked, newCount) => {
                        setPosts(prev => prev.map(p => 
                          p.post_id === postId ? { ...p, user_has_liked: liked, like_count: newCount } : p
                        ));
                      }}
                      showActions={canAccessOrgManagement()}
                      onViewReactions={(postId) => handleViewReactions(postId)}
                      onPin={async (postId, currentPinStatus) => {
                        try {
                          // If pinning, unpin any other pinned posts first
                          if (!currentPinStatus) {
                            await supabase
                              .from('organization_posts')
                              .update({ is_pinned: false })
                              .eq('org_id', id)
                              .eq('is_pinned', true);
                          }

                          // Update the post's pin status
                          const { error } = await supabase
                            .from('organization_posts')
                            .update({ is_pinned: !currentPinStatus })
                            .eq('post_id', postId)
                            .eq('org_id', id);

                          if (error) throw error;

                          Alert.alert('Success', currentPinStatus ? 'Post unpinned' : 'Post pinned to top');
                          
                          // Reload posts
                          const updatedPosts = await fetchOrganizationPosts(id as string);
                          setPosts(updatedPosts);
                        } catch (error) {
                          console.error('Failed to toggle pin:', error);
                          Alert.alert('Error', 'Failed to update pin status');
                        }
                      }}
                      onEdit={(post) => {
                        setSelectedPost(post);
                        setPostForm({
                          title: post.title || '',
                          content: post.content || '',
                          media_url: post.media_url || '',
                          visibility: post.visibility || 'members'
                        });
                        setShowEditPostModal(true);
                      }}
                      onDelete={async (postId) => {
                        Alert.alert(
                          'Delete Post',
                          'Are you sure you want to delete this post?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  const { error } = await supabase
                                    .from('organization_posts')
                                    .delete()
                                    .eq('post_id', postId);

                                  if (error) throw error;

                                  Alert.alert('Success', 'Post deleted');
                                  setPosts(prev => prev.filter(p => p.post_id !== postId));
                                } catch (error) {
                                  console.error('Failed to delete post:', error);
                                  Alert.alert('Error', 'Failed to delete post');
                                }
                              }
                            }
                          ]
                        );
                      }}
                    />
                  );
                } else if (item.type === 'announcement') {
                  return (
                    <View key={`announcement-${item.announcement_id}`}>
                      <AnnouncementCard
                        announcement={{
                          ...item,
                          organizations: {
                            org_name: organization.shortName || organization.name,
                            org_pic: organization.orgPic || organization.org_pic
                          }
                        }}
                      />
                      {canAccessOrgManagement() && (
                        <TouchableOpacity 
                          style={styles.announcementMenuButton}
                          onPress={() => {
                            Alert.alert(
                              'Announcement Options',
                              `"${item.title}"`,
                              [
                                { text: 'Edit', onPress: () => handleEditAnnouncement(item) },
                                { text: 'Delete', style: 'destructive', onPress: () => handleDeleteAnnouncement(item) },
                                { text: 'Cancel', style: 'cancel' }
                              ]
                            );
                          }}
                        >
                          <IconSymbol name="ellipsis" size={16} color={colors.tabIconDefault} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                } else if (item.type === 'event') {
                  return (
                    <View key={`event-${item.id}`} style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.eventHeader}>
                        <View style={styles.eventTitleContainer}>
                          <ThemedText style={[styles.eventTitle, { color: colors.text }]}>{item.title}</ThemedText>
                          <View style={[
                            styles.eventStatus,
                            { 
                              backgroundColor: item.status === 'Open' ? '#10B981' : 
                                             item.status === 'Registration Soon' ? '#F59E0B' : '#EF4444'
                            }
                          ]}>
                            <ThemedText style={styles.eventStatusText}>{item.status}</ThemedText>
                          </View>
                        </View>
                        {item.description && (
                          <ThemedText style={[styles.eventDescription, { color: colors.tabIconDefault }]} numberOfLines={2}>
                            {item.description}
                          </ThemedText>
                        )}
                      </View>
                      
                      <View style={styles.eventDetails}>
                        <View style={styles.eventDetailRow}>
                          <IconSymbol name="calendar" size={16} color={colors.tabIconDefault} />
                          <ThemedText style={[styles.eventDetailText, { color: colors.text }]}>{item.date}</ThemedText>
                        </View>
                        <View style={styles.eventDetailRow}>
                          <IconSymbol name="location" size={16} color={colors.tabIconDefault} />
                          <ThemedText style={[styles.eventDetailText, { color: colors.text }]}>{item.location}</ThemedText>
                        </View>
                      </View>
                    </View>
                  );
                } else if (item.type === 'poll') {
                  return (
                    <PollCard
                      key={`poll-${item.poll_id}`}
                      poll={{
                        ...item,
                        organizations: {
                          org_name: organization.shortName || organization.name,
                          org_pic: organization.orgPic || organization.org_pic
                        }
                      }}
                      showActions={canAccessOrgManagement()}
                      onViewVoters={(poll) => handleViewVoters(poll)}
                      onEdit={(poll) => {
                        Alert.alert('Edit Poll', 'Poll editing feature coming soon!');
                      }}
                      onDelete={(poll) => {
                        Alert.alert(
                          'Delete Poll',
                          `Are you sure you want to delete "${poll.question}"?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  const { error } = await supabase
                                    .from('polls')
                                    .delete()
                                    .eq('poll_id', poll.poll_id);

                                  if (error) throw error;

                                  // Remove from local state
                                  setPolls(prev => prev.filter(p => p.poll_id !== poll.poll_id));
                                  Alert.alert('Success', 'Poll deleted successfully');
                                } catch (error) {
                                  console.error('Error deleting poll:', error);
                                  Alert.alert('Error', 'Failed to delete poll');
                                }
                              }
                            }
                          ]
                        );
                      }}
                      onVote={async (pollId, optionIds) => {
                        try {
                          // Get current user
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) {
                            Alert.alert('Error', 'You must be logged in to vote');
                            return;
                          }

                          // Get poll details to check visibility
                          const { data: pollData } = await supabase
                            .from('polls')
                            .select('visibility')
                            .eq('poll_id', pollId)
                            .single();

                          // Check if poll is members_only and user is a member
                          if (pollData?.visibility === 'members_only') {
                            const { data: memberCheck } = await supabase
                              .from('organization_members')
                              .select('user_id')
                              .eq('org_id', id)
                              .eq('user_id', user.id)
                              .single();

                            if (!memberCheck) {
                              Alert.alert('Error', 'Only organization members can vote on this poll');
                              return;
                            }
                          }

                          // Check if user has already voted - if so, we'll update their vote
                          const { data: existingVotes } = await supabase
                            .from('poll_votes')
                            .select('vote_id, option_id')
                            .eq('poll_id', pollId)
                            .eq('user_id', user.id);

                          const hasExistingVotes = existingVotes && existingVotes.length > 0;

                          // If user has existing votes, delete them and decrement counts
                          if (hasExistingVotes) {
                            const oldOptionIds = existingVotes.map((v: any) => v.option_id);
                            
                            // Delete old votes
                            const { error: deleteError } = await supabase
                              .from('poll_votes')
                              .delete()
                              .eq('poll_id', pollId)
                              .eq('user_id', user.id);

                            if (deleteError) {
                              throw new Error('Failed to update vote');
                            }

                            // Decrement vote counts for old options
                            for (const optionId of oldOptionIds) {
                              const { data: option } = await supabase
                                .from('poll_options')
                                .select('vote_count')
                                .eq('option_id', optionId)
                                .single();

                              if (option && option.vote_count > 0) {
                                await supabase
                                  .from('poll_options')
                                  .update({ vote_count: option.vote_count - 1 })
                                  .eq('option_id', optionId);
                              }
                            }
                          }

                          // Insert new votes
                          const votesToInsert = optionIds.map(optionId => ({
                            poll_id: pollId,
                            user_id: user.id,
                            option_id: optionId
                          }));

                          const { error: voteError } = await supabase
                            .from('poll_votes')
                            .insert(votesToInsert);

                          if (voteError) {
                            throw new Error('Failed to record vote');
                          }

                          // Update vote counts for each new option
                          for (const optionId of optionIds) {
                            // Get current vote count and increment
                            const { data: option } = await supabase
                              .from('poll_options')
                              .select('vote_count')
                              .eq('option_id', optionId)
                              .single();

                            if (option) {
                              const { error: updateError } = await supabase
                                .from('poll_options')
                                .update({ vote_count: (option.vote_count || 0) + 1 })
                                .eq('option_id', optionId);

                              if (updateError) {
                                console.error('Failed to update vote count:', updateError);
                              }
                            }
                          }

                          Alert.alert('Success', hasExistingVotes ? 'Your vote has been updated!' : 'Your vote has been recorded!');
                          // Reload polls to get updated counts
                          const updatedPolls = await fetchOrganizationPolls(id as string);
                          setPolls(updatedPolls);
                        } catch (error) {
                          console.error('Failed to vote on poll:', error);
                          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit vote. Please try again.');
                        }
                      }}
                    />
                  );
                }
                return null;
              })
            ) : (
              <ThemedText style={styles.emptyStateText}>
                No {feedFilter === 'all' ? 'feed items' : feedFilter} yet.
              </ThemedText>
            )}
          </View>
        );

      case 'photos':
        // Extract all images from posts and announcements
        const allPhotos: { url: string; source: string; id: string; title: string }[] = [];
        
        // Get images from posts
        posts.forEach((post: any) => {
          if (post.media_urls && Array.isArray(post.media_urls)) {
            post.media_urls.forEach((url: string) => {
              if (url && url.trim()) {
                allPhotos.push({
                  url,
                  source: 'post',
                  id: post.post_id,
                  title: post.title || 'Post'
                });
              }
            });
          } else if (post.media_url && post.media_url.trim()) {
            allPhotos.push({
              url: post.media_url,
              source: 'post',
              id: post.post_id,
              title: post.title || 'Post'
            });
          }
        });
        
        // Get images from announcements
        announcements.forEach((announcement: any) => {
          if (announcement.image && announcement.image.trim()) {
            allPhotos.push({
              url: announcement.image,
              source: 'announcement',
              id: announcement.announcement_id,
              title: announcement.title
            });
          }
        });

        return (
          <View style={styles.tabContent}>
            {allPhotos.length > 0 ? (
              <View style={styles.photosGrid}>
                {allPhotos.map((photo, index) => (
                  <TouchableOpacity
                    key={`${photo.id}-${index}`}
                    style={styles.photoItem}
                    onPress={() => {
                      // Open image in full screen or external viewer
                      Alert.alert(
                        photo.title,
                        `From ${photo.source}`,
                        [
                          { text: 'Close', style: 'cancel' },
                          { text: 'View Full Size', onPress: () => {
                            // TODO: Implement image viewer modal
                          }}
                        ]
                      );
                    }}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: photo.url }}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                    <View style={styles.photoOverlay}>
                      <View style={styles.photoInfo}>
                        <ThemedText style={styles.photoTitle} numberOfLines={1}>
                          {photo.title}
                        </ThemedText>
                        <ThemedText style={styles.photoSource}>
                          {photo.source === 'post' ? 'Post' : 'Announcement'}
                        </ThemedText>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyPhotosContainer}>
                <IconSymbol name="photo.on.rectangle" size={48} color={colors.tabIconDefault} />
                <ThemedText style={[styles.emptyPhotosText, { color: colors.tabIconDefault }]}>
                  No photos available yet.
                </ThemedText>
                <ThemedText style={[styles.emptyPhotosSubtext, { color: colors.tabIconDefault }]}>
                  Photos from posts and announcements will appear here.
                </ThemedText>
              </View>
            )}
          </View>
        );

      case 'posts':
        const filteredPosts = getFilteredPosts();
        
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
            
            {/* Posts using PostCard component */}
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post: any) => (
                <PostCard
                  key={post.post_id}
                  post={{
                    ...post,
                    organizations: {
                      org_name: organization.shortName || organization.name,
                      org_pic: organization.orgPic || organization.org_pic
                    }
                  }}
                  onPress={() => handlePostPress(post)}
                  onLikeUpdate={(postId, liked, newCount) => {
                    // Update posts state with new like info
                    setPosts(prev => prev.map(p => 
                      p.post_id === postId ? { ...p, user_has_liked: liked, like_count: newCount } : p
                    ));
                  }}
                />
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
            
            {/* Announcements using AnnouncementCard component */}
            {filteredAnnouncements.length > 0 ? (
              filteredAnnouncements.map((announcement: any) => (
                <View key={announcement.announcement_id}>
                  <AnnouncementCard
                    announcement={{
                      ...announcement,
                      organizations: {
                        org_name: organization.shortName || organization.name,
                        org_pic: organization.orgPic || organization.org_pic
                      }
                    }}
                  />
                  {/* Edit/Delete Menu for Officers/Advisers - Positioned absolutely */}
                  {canAccessOrgManagement() && (
                    <TouchableOpacity 
                      style={styles.announcementMenuButton}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity 
                    style={[styles.redditJoinButton, { backgroundColor: isMember ? '#800020' : '#800020', opacity: isMember ? 0.7 : 1 }]}
                    onPress={isMember ? undefined : () => setShowJoinModal(true)}
                    disabled={isMember || isJoining || hasApplied}
                  >
                    <ThemedText style={styles.redditJoinButtonText}>
                      {hasApplied ? 'Pending' : (isMember ? 'Joined' : 'Join')}
                    </ThemedText>
                  </TouchableOpacity>
                  {isMember && (
                    <TouchableOpacity
                      onPress={() => setShowActionsMenu(true)}
                      style={[styles.actionsButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <IconSymbol name="ellipsis" size={20} color={colors.text} />
                    </TouchableOpacity>
                  )}
                </View>
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

      {/* Reactions Modal */}
      <Modal
        visible={showReactionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReactionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.reactionsModal, { backgroundColor: colors.card }]}>
            <View style={styles.reactionsHeader}>
              <ThemedText style={[styles.reactionsTitle, { color: colors.text }]}>
                Reactions
              </ThemedText>
              <TouchableOpacity onPress={() => setShowReactionsModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.tabIconDefault} />
              </TouchableOpacity>
            </View>

            <ThemedText style={[styles.reactionsCount, { color: colors.tabIconDefault }]}>
              {reactions.length} {reactions.length === 1 ? 'person' : 'people'} reacted to this post
            </ThemedText>

            {/* Search Input */}
            {reactions.length > 10 && (
              <View style={[styles.reactionsSearchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <IconSymbol name="magnifyingglass" size={16} color={colors.tabIconDefault} />
                <TextInput
                  style={[styles.reactionsSearchInput, { color: colors.text }]}
                  placeholder="Search reactions..."
                  placeholderTextColor={colors.tabIconDefault}
                  value={reactionsSearchQuery}
                  onChangeText={setReactionsSearchQuery}
                />
                {reactionsSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setReactionsSearchQuery('')}>
                    <IconSymbol name="xmark.circle.fill" size={16} color={colors.tabIconDefault} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView style={styles.reactionsListContainer} showsVerticalScrollIndicator={true}>
              {loadingReactions ? (
                <View style={styles.reactionsLoading}>
                  <ThemedText style={[styles.reactionsLoadingText, { color: colors.tabIconDefault }]}>
                    Loading reactions...
                  </ThemedText>
                </View>
              ) : reactions.length === 0 ? (
                <View style={styles.reactionsEmpty}>
                  <ThemedText style={[styles.reactionsEmptyText, { color: colors.tabIconDefault }]}>
                    No reactions yet
                  </ThemedText>
                </View>
              ) : (() => {
                const filteredReactions = reactions.filter((reaction: any) => 
                  reactionsSearchQuery.length === 0 || 
                  reaction.name.toLowerCase().includes(reactionsSearchQuery.toLowerCase())
                );
                
                if (filteredReactions.length === 0) {
                  return (
                    <View style={styles.reactionsEmpty}>
                      <ThemedText style={[styles.reactionsEmptyText, { color: colors.tabIconDefault }]}>
                        No reactions found matching "{reactionsSearchQuery}"
                      </ThemedText>
                    </View>
                  );
                }
                
                return filteredReactions.map((reaction: any) => (
                  <View key={reaction.like_id} style={[styles.reactionItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.reactionAvatar}>
                      {reaction.profile_image ? (
                        <Image 
                          source={{ uri: reaction.profile_image }} 
                          style={styles.reactionAvatarImage}
                        />
                      ) : (
                        <View style={styles.reactionAvatarFallback}>
                          <ThemedText style={styles.reactionAvatarText}>
                            {reaction.name.charAt(0).toUpperCase()}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={styles.reactionInfo}>
                      <ThemedText style={[styles.reactionName, { color: colors.text }]}>
                        {reaction.name}
                      </ThemedText>
                      <ThemedText style={[styles.reactionDate, { color: colors.tabIconDefault }]}>
                        {new Date(reaction.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </ThemedText>
                    </View>
                    <IconSymbol name="heart.fill" size={20} color="#EF4444" />
                  </View>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Poll Voters Modal */}
      <Modal
        visible={showVotersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVotersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.reactionsModal, { backgroundColor: colors.card }]}>
            <View style={styles.reactionsHeader}>
              <ThemedText style={[styles.reactionsTitle, { color: colors.text }]}>
                Poll Voters
              </ThemedText>
              <TouchableOpacity onPress={() => setShowVotersModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.tabIconDefault} />
              </TouchableOpacity>
            </View>

            {(() => {
              const filteredCount = voters.filter((voter: any) => {
                const matchesSearch = votersSearchQuery.length === 0 || 
                  voter.name.toLowerCase().includes(votersSearchQuery.toLowerCase());
                const matchesOption = selectedOptionFilter === 'all' || 
                  voter.selected_options.some((opt: any) => opt.option_id === selectedOptionFilter);
                return matchesSearch && matchesOption;
              }).length;

              return (
                <ThemedText style={[styles.reactionsCount, { color: colors.tabIconDefault }]}>
                  {filteredCount !== voters.length 
                    ? `${filteredCount} of ${voters.length} ${voters.length === 1 ? 'voter' : 'voters'}`
                    : `${voters.length} ${voters.length === 1 ? 'voter' : 'voters'}`
                  }
                </ThemedText>
              );
            })()}

            {/* Search and Filter */}
            {voters.length > 0 && (
              <View style={styles.votersFilters}>
                <View style={[styles.reactionsSearchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <IconSymbol name="magnifyingglass" size={16} color={colors.tabIconDefault} />
                  <TextInput
                    style={[styles.reactionsSearchInput, { color: colors.text }]}
                    placeholder="Search voters..."
                    placeholderTextColor={colors.tabIconDefault}
                    value={votersSearchQuery}
                    onChangeText={setVotersSearchQuery}
                  />
                  {votersSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setVotersSearchQuery('')}>
                      <IconSymbol name="xmark.circle.fill" size={16} color={colors.tabIconDefault} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter by option - horizontal scroll for many options */}
                {selectedPollForVoters && selectedPollForVoters.options && (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScrollContainer}
                  >
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        { backgroundColor: selectedOptionFilter === 'all' ? '#800020' : colors.background, borderColor: colors.border }
                      ]}
                      onPress={() => setSelectedOptionFilter('all')}
                    >
                      <ThemedText style={[styles.filterChipText, { color: selectedOptionFilter === 'all' ? 'white' : colors.text }]}>
                        All Choices
                      </ThemedText>
                    </TouchableOpacity>
                    {selectedPollForVoters.options.map((option: any) => (
                      <TouchableOpacity
                        key={option.option_id}
                        style={[
                          styles.filterChip,
                          { backgroundColor: selectedOptionFilter === option.option_id ? '#800020' : colors.background, borderColor: colors.border }
                        ]}
                        onPress={() => setSelectedOptionFilter(option.option_id)}
                      >
                        <ThemedText style={[styles.filterChipText, { color: selectedOptionFilter === option.option_id ? 'white' : colors.text }]}>
                          {option.option_text} ({option.vote_count})
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            <ScrollView style={styles.reactionsListContainer} showsVerticalScrollIndicator={true}>
              {loadingVoters ? (
                <View style={styles.reactionsLoading}>
                  <ThemedText style={[styles.reactionsLoadingText, { color: colors.tabIconDefault }]}>
                    Loading voters...
                  </ThemedText>
                </View>
              ) : voters.length === 0 ? (
                <View style={styles.reactionsEmpty}>
                  <ThemedText style={[styles.reactionsEmptyText, { color: colors.tabIconDefault }]}>
                    No voters yet
                  </ThemedText>
                </View>
              ) : (() => {
                const filteredVoters = voters.filter((voter: any) => {
                  const matchesSearch = votersSearchQuery.length === 0 || 
                    voter.name.toLowerCase().includes(votersSearchQuery.toLowerCase());
                  const matchesOption = selectedOptionFilter === 'all' || 
                    voter.selected_options.some((opt: any) => opt.option_id === selectedOptionFilter);
                  return matchesSearch && matchesOption;
                });
                
                if (filteredVoters.length === 0) {
                  return (
                    <View style={styles.reactionsEmpty}>
                      <ThemedText style={[styles.reactionsEmptyText, { color: colors.tabIconDefault }]}>
                        No voters found
                      </ThemedText>
                    </View>
                  );
                }
                
                return filteredVoters.map((voter: any) => (
                  <View key={voter.user_id} style={[styles.voterItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.reactionAvatar}>
                      {voter.profile_pic ? (
                        <Image 
                          source={{ uri: voter.profile_pic }} 
                          style={styles.reactionAvatarImage}
                        />
                      ) : (
                        <View style={styles.reactionAvatarFallback}>
                          <ThemedText style={styles.reactionAvatarText}>
                            {voter.name.charAt(0).toUpperCase()}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={styles.voterInfo}>
                      <ThemedText style={[styles.reactionName, { color: colors.text }]}>
                        {voter.name}
                      </ThemedText>
                      <ThemedText style={[styles.reactionDate, { color: colors.tabIconDefault }]}>
                        {new Date(voter.voted_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </ThemedText>
                      <View style={styles.selectedOptionsContainer}>
                        {voter.selected_options.map((option: any) => (
                          <View key={option.option_id} style={[styles.optionBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <IconSymbol name="checkmark.circle.fill" size={12} color="#10B981" />
                            <ThemedText style={[styles.optionBadgeText, { color: colors.text }]}>
                              {option.option_text}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      {/* Actions Menu for Members */}
      {showActionsMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity 
            style={styles.menuBackdrop} 
            onPress={() => setShowActionsMenu(false)}
            activeOpacity={1}
          />
          <View style={[styles.actionsMenuContainer, { paddingBottom: Math.max(insets.bottom, 16) + 18, backgroundColor: colors.card }]}>
            <View style={styles.orgMenuHeader}>
              <ThemedText style={[styles.orgMenuTitle, { color: colors.text }]}>Actions</ThemedText>
              <TouchableOpacity 
                onPress={() => setShowActionsMenu(false)}
                style={styles.closeButton}
              >
                <IconSymbol name="xmark" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.actionsMenuContent}>
              <TouchableOpacity
                style={[styles.actionMenuItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setShowActionsMenu(false);
                  setActiveTab('members');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.actionMenuItemIcon}>
                  <IconSymbol name="person.2" size={20} color="#800020" />
                </View>
                <View style={styles.actionMenuItemContent}>
                  <ThemedText style={[styles.actionMenuItemTitle, { color: colors.text }]}>View Members</ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={16} color="#D1D5DB" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionMenuItem, { borderBottomColor: colors.border }]}
                onPress={handleCopyOrgId}
                activeOpacity={0.7}
              >
                <View style={styles.actionMenuItemIcon}>
                  <IconSymbol name="doc.on.doc" size={20} color="#800020" />
                </View>
                <View style={styles.actionMenuItemContent}>
                  <ThemedText style={[styles.actionMenuItemTitle, { color: colors.text }]}>Copy Organization ID</ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={16} color="#D1D5DB" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={handleLeaveOrganization}
                disabled={isLeaving}
                activeOpacity={0.7}
              >
                <View style={styles.actionMenuItemIcon}>
                  <IconSymbol name="person.badge.minus" size={20} color="#DC2626" />
                </View>
                <View style={styles.actionMenuItemContent}>
                  <ThemedText style={[styles.actionMenuItemTitle, { color: '#DC2626' }]}>
                    {isLeaving ? 'Leaving...' : 'Leave Organization'}
                  </ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={16} color="#D1D5DB" />
              </TouchableOpacity>
            </View>
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
                  Image (Optional)
                </ThemedText>
                
                {!selectedAnnouncementImage && (
                  <TouchableOpacity
                    style={{
                      borderWidth: 2,
                      borderColor: '#D1D5DB',
                      borderStyle: 'dashed',
                      borderRadius: 8,
                      padding: 20,
                      alignItems: 'center',
                      backgroundColor: '#F9FAFB',
                      marginBottom: 12,
                    }}
                    onPress={pickAnnouncementImage}
                  >
                    <IconSymbol name="photo" size={32} color="#6B7280" />
                    <ThemedText style={{ fontSize: 14, color: '#6B7280', marginTop: 8 }}>
                      Choose from gallery
                    </ThemedText>
                  </TouchableOpacity>
                )}

                {selectedAnnouncementImage && (
                  <View style={{ marginBottom: 12 }}>
                    <Image
                      source={{ uri: selectedAnnouncementImage }}
                      style={{
                        width: '100%',
                        height: 200,
                        borderRadius: 8,
                        marginBottom: 8,
                      }}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#ff4444',
                        padding: 8,
                        borderRadius: 6,
                        alignItems: 'center',
                      }}
                      onPress={removeAnnouncementImage}
                    >
                      <ThemedText style={{ color: 'white', fontSize: 14 }}>Remove Image</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}

                {!selectedAnnouncementImage && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#D1D5DB' }} />
                    <ThemedText style={{ marginHorizontal: 12, color: '#6B7280', fontSize: 12 }}>
                      OR
                    </ThemedText>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#D1D5DB' }} />
                  </View>
                )}

                {!selectedAnnouncementImage && (
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
                )}
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
                  Image (Optional)
                </ThemedText>
                
                {/* Image Picker Button */}
                <TouchableOpacity
                  style={{
                    borderWidth: 2,
                    borderColor: colors.border,
                    borderStyle: 'dashed',
                    borderRadius: 8,
                    padding: 20,
                    alignItems: 'center',
                    backgroundColor: colors.card,
                    marginBottom: 12,
                  }}
                  onPress={pickPostImage}
                >
                  <IconSymbol name="photo" size={32} color={colors.tabIconDefault} />
                  <ThemedText style={{ fontSize: 14, color: colors.tabIconDefault, marginTop: 8 }}>
                    {selectedPostImages.length > 0 ? 'Add more images' : 'Choose from gallery'}
                  </ThemedText>
                  {selectedPostImages.length > 0 && (
                    <ThemedText style={{ fontSize: 12, color: colors.tabIconDefault, marginTop: 4 }}>
                      {selectedPostImages.length} image{selectedPostImages.length !== 1 ? 's' : ''} selected
                    </ThemedText>
                  )}
                </TouchableOpacity>

                {/* Multiple Images Preview */}
                {selectedPostImages.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {selectedPostImages.map((uri, index) => (
                        <View key={index} style={{ position: 'relative', width: '48%' }}>
                          <Image
                            source={{ uri }}
                            style={{
                              width: '100%',
                              height: 120,
                              borderRadius: 8,
                            }}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              backgroundColor: '#ff4444',
                              borderRadius: 12,
                              width: 24,
                              height: 24,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                            onPress={() => removePostImage(index)}
                          >
                            <IconSymbol name="xmark" size={14} color="white" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#ff4444',
                        padding: 8,
                        borderRadius: 6,
                        alignItems: 'center',
                      }}
                      onPress={removeAllPostImages}
                    >
                      <ThemedText style={{ color: 'white', fontSize: 14 }}>Remove All Images</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}

                {/* OR Divider */}
                {selectedPostImages.length === 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    <ThemedText style={{ marginHorizontal: 12, color: colors.tabIconDefault, fontSize: 12 }}>
                      OR
                    </ThemedText>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  </View>
                )}

                {/* URL Input */}
                {selectedPostImages.length === 0 && (
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
                )}
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

      {/* Create Options Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCreateModal(false)}
        >
          <View style={[styles.createOptionsModal, { backgroundColor: colors.card }]}>
            <ThemedText style={[styles.createModalTitle, { color: colors.text }]}>
              Create New
            </ThemedText>
            
            <TouchableOpacity
              style={[styles.createOption, { borderBottomColor: colors.border }]}
              onPress={() => {
                setShowCreateModal(false);
                setShowPostModal(true);
              }}
            >
              <IconSymbol name="doc.text" size={24} color="#800020" />
              <View style={styles.createOptionText}>
                <ThemedText style={[styles.createOptionTitle, { color: colors.text }]}>Post</ThemedText>
                <ThemedText style={[styles.createOptionSubtitle, { color: colors.tabIconDefault }]}>
                  Share updates with members
                </ThemedText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.createOption, { borderBottomColor: colors.border }]}
              onPress={() => {
                setShowCreateModal(false);
                setShowAnnouncementModal(true);
              }}
            >
              <IconSymbol name="megaphone" size={24} color="#800020" />
              <View style={styles.createOptionText}>
                <ThemedText style={[styles.createOptionTitle, { color: colors.text }]}>Announcement</ThemedText>
                <ThemedText style={[styles.createOptionSubtitle, { color: colors.tabIconDefault }]}>
                  Important organization news
                </ThemedText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.createOption, { borderBottomColor: colors.border }]}
              onPress={() => {
                setShowCreateModal(false);
                Alert.alert('Coming Soon', 'Event creation will be available soon!');
              }}
            >
              <IconSymbol name="calendar" size={24} color="#800020" />
              <View style={styles.createOptionText}>
                <ThemedText style={[styles.createOptionTitle, { color: colors.text }]}>Event</ThemedText>
                <ThemedText style={[styles.createOptionSubtitle, { color: colors.tabIconDefault }]}>
                  Schedule an activity
                </ThemedText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.createOption}
              onPress={() => {
                setShowCreateModal(false);
                setShowPollModal(true);
              }}
            >
              <IconSymbol name="chart.bar" size={24} color="#800020" />
              <View style={styles.createOptionText}>
                <ThemedText style={[styles.createOptionTitle, { color: colors.text }]}>Poll</ThemedText>
                <ThemedText style={[styles.createOptionSubtitle, { color: colors.tabIconDefault }]}>
                  Ask members for their opinion
                </ThemedText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelCreateButton, { backgroundColor: colors.border }]}
              onPress={() => setShowCreateModal(false)}
            >
              <ThemedText style={[styles.cancelCreateText, { color: colors.text }]}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Poll Modal */}
      <Modal
        visible={showPollModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPollModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Create Poll</ThemedText>
              <TouchableOpacity onPress={() => setShowPollModal(false)} style={styles.modalCloseButton}>
                <IconSymbol name="xmark" size={20} color={colors.tabIconDefault} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Question */}
              <View style={styles.formGroup}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Question *</ThemedText>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="What's your question?"
                  placeholderTextColor={colors.tabIconDefault}
                  value={pollForm.question}
                  onChangeText={(text) => setPollForm(prev => ({ ...prev, question: text }))}
                  multiline
                />
              </View>

              {/* Options */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>Options *</ThemedText>
                  <ThemedText style={[styles.labelHint, { color: colors.tabIconDefault }]}>(2-6 options)</ThemedText>
                </View>
                {pollForm.options.map((option, index) => (
                  <View key={index} style={styles.optionInputRow}>
                    <TextInput
                      style={[styles.input, styles.optionInput, { color: colors.text, borderColor: colors.border }]}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor={colors.tabIconDefault}
                      value={option}
                      onChangeText={(text) => {
                        const newOptions = [...pollForm.options];
                        newOptions[index] = text;
                        setPollForm(prev => ({ ...prev, options: newOptions }));
                      }}
                    />
                    {pollForm.options.length > 2 && (
                      <TouchableOpacity
                        onPress={() => {
                          const newOptions = pollForm.options.filter((_, i) => i !== index);
                          setPollForm(prev => ({ ...prev, options: newOptions }));
                        }}
                        style={styles.removeOptionButton}
                      >
                        <IconSymbol name="minus.circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {pollForm.options.length < 6 && (
                  <TouchableOpacity
                    style={[styles.addOptionButton, { borderColor: colors.border }]}
                    onPress={() => setPollForm(prev => ({ ...prev, options: [...prev.options, ''] }))}
                  >
                    <IconSymbol name="plus.circle" size={20} color="#800020" />
                    <ThemedText style={[styles.addOptionText, { color: colors.text }]}>Add Option</ThemedText>
                  </TouchableOpacity>
                )}
              </View>

              {/* Duration */}
              <View style={styles.formGroup}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Poll Duration</ThemedText>
                <View style={styles.durationButtons}>
                  {[
                    { label: '1 hour', value: 1 },
                    { label: '6 hours', value: 6 },
                    { label: '12 hours', value: 12 },
                    { label: '1 day', value: 24 },
                    { label: '3 days', value: 72 },
                    { label: '1 week', value: 168 },
                  ].map((duration) => (
                    <TouchableOpacity
                      key={duration.value}
                      style={[
                        styles.durationButton,
                        { borderColor: colors.border },
                        pollForm.duration_hours === duration.value && styles.durationButtonActive
                      ]}
                      onPress={() => setPollForm(prev => ({ ...prev, duration_hours: duration.value }))}
                    >
                      <ThemedText style={[
                        styles.durationButtonText,
                        { color: colors.text },
                        pollForm.duration_hours === duration.value && styles.durationButtonTextActive
                      ]}>
                        {duration.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Allow Multiple */}
              <View style={[styles.formGroup, styles.switchRow]}>
                <View style={styles.switchLabelContainer}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>Allow Multiple Choices</ThemedText>
                  <ThemedText style={[styles.labelHint, { color: colors.tabIconDefault }]}>
                    Let people select more than one option
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={[
                    styles.switch,
                    pollForm.allow_multiple ? styles.switchActive : { backgroundColor: colors.border }
                  ]}
                  onPress={() => setPollForm(prev => ({ ...prev, allow_multiple: !prev.allow_multiple }))}
                >
                  <View style={[
                    styles.switchThumb,
                    pollForm.allow_multiple && styles.switchThumbActive
                  ]} />
                </TouchableOpacity>
              </View>

              {/* Poll Visibility */}
              <View style={styles.formGroup}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Poll Visibility</ThemedText>
                <View style={styles.visibilityButtons}>
                  <TouchableOpacity
                    style={[
                      styles.visibilityButton,
                      { borderColor: colors.border },
                      pollForm.visibility === 'members_only' && styles.visibilityButtonActive
                    ]}
                    onPress={() => setPollForm(prev => ({ ...prev, visibility: 'members_only' }))}
                  >
                    <View style={styles.visibilityButtonContent}>
                      <IconSymbol 
                        name="person.2.fill" 
                        size={20} 
                        color={pollForm.visibility === 'members_only' ? 'white' : colors.text} 
                      />
                      <ThemedText style={[
                        styles.visibilityButtonTitle,
                        { color: pollForm.visibility === 'members_only' ? 'white' : colors.text }
                      ]}>
                        Members Only
                      </ThemedText>
                      <ThemedText style={[
                        styles.visibilityButtonDesc,
                        { color: pollForm.visibility === 'members_only' ? 'rgba(255,255,255,0.8)' : colors.tabIconDefault }
                      ]}>
                        Only organization members can vote
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.visibilityButton,
                      { borderColor: colors.border },
                      pollForm.visibility === 'public' && styles.visibilityButtonActive
                    ]}
                    onPress={() => setPollForm(prev => ({ ...prev, visibility: 'public' }))}
                  >
                    <View style={styles.visibilityButtonContent}>
                      <IconSymbol 
                        name="globe" 
                        size={20} 
                        color={pollForm.visibility === 'public' ? 'white' : colors.text} 
                      />
                      <ThemedText style={[
                        styles.visibilityButtonTitle,
                        { color: pollForm.visibility === 'public' ? 'white' : colors.text }
                      ]}>
                        Public
                      </ThemedText>
                      <ThemedText style={[
                        styles.visibilityButtonDesc,
                        { color: pollForm.visibility === 'public' ? 'rgba(255,255,255,0.8)' : colors.tabIconDefault }
                      ]}>
                        Anyone can vote, even non-members
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowPollModal(false);
                  setPollForm({ question: '', options: ['', ''], duration_hours: 24, allow_multiple: false, visibility: 'members_only' });
                }}
              >
                <ThemedText style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (isCreatingPoll || !pollForm.question.trim() || pollForm.options.filter(o => o.trim()).length < 2) && styles.submitButtonDisabled
                ]}
                onPress={async () => {
                  if (!pollForm.question.trim()) {
                    Alert.alert('Error', 'Poll question is required');
                    return;
                  }
                  const validOptions = pollForm.options.filter(opt => opt.trim() !== '');
                  if (validOptions.length < 2) {
                    Alert.alert('Error', 'At least 2 options are required');
                    return;
                  }

                  setIsCreatingPoll(true);
                  try {
                    // Get current user
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                      Alert.alert('Error', 'You must be logged in to create a poll');
                      setIsCreatingPoll(false);
                      return;
                    }

                    // Calculate expiration time
                    const now = new Date();
                    const expiresAt = new Date(now.getTime() + pollForm.duration_hours * 60 * 60 * 1000);

                    // Create poll in Supabase
                    const { data: poll, error: pollError } = await supabase
                      .from('polls')
                      .insert({
                        org_id: id,
                        question: pollForm.question.trim(),
                        expires_at: expiresAt.toISOString(),
                        allow_multiple: pollForm.allow_multiple,
                        visibility: pollForm.visibility,
                        created_by: user.id
                      })
                      .select()
                      .single();

                    if (pollError) {
                      throw new Error('Failed to create poll');
                    }

                    // Create poll options
                    const optionsToInsert = validOptions.map((optionText: string) => ({
                      poll_id: poll.poll_id,
                      option_text: optionText,
                      vote_count: 0
                    }));

                    const { data: createdOptions, error: optionsError } = await supabase
                      .from('poll_options')
                      .insert(optionsToInsert)
                      .select();

                    if (optionsError) {
                      // Rollback poll creation
                      await supabase.from('polls').delete().eq('poll_id', poll.poll_id);
                      throw new Error('Failed to create poll options');
                    }

                    // Format the new poll
                    const newPoll = {
                      poll_id: poll.poll_id,
                      question: poll.question,
                      options: createdOptions.map((opt: any) => ({
                        option_id: opt.option_id,
                        option_text: opt.option_text,
                        vote_count: 0
                      })),
                      total_votes: 0,
                      expires_at: poll.expires_at,
                      allow_multiple: poll.allow_multiple,
                      visibility: poll.visibility,
                      created_at: poll.created_at,
                      user_votes: [],
                      is_expired: false
                    };

                    Alert.alert('Success', `"${pollForm.question}" is now live!`);
                    setPolls(prev => [newPoll, ...prev]);
                    setShowPollModal(false);
                    setPollForm({ question: '', options: ['', ''], duration_hours: 24, allow_multiple: false, visibility: 'members_only' });
                  } catch (error) {
                    console.error('Failed to create poll:', error);
                    Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create poll. Please try again.');
                  } finally {
                    setIsCreatingPoll(false);
                  }
                }}
                disabled={isCreatingPoll || !pollForm.question.trim() || pollForm.options.filter(o => o.trim()).length < 2}
              >
                <ThemedText style={styles.submitButtonText}>
                  {isCreatingPoll ? 'Creating...' : 'Create Poll'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Post Modal */}
      <PostModal
        visible={isPostModalVisible}
        post={selectedPostForModal}
        onClose={handleClosePostModal}
        onLike={handleLike}
        onShare={handleShare}
        onBookmark={handleBookmark}
        isBookmarked={selectedPostForModal ? bookmarkedPosts.has(selectedPostForModal.id || selectedPostForModal.post_id) : false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  announcementMenuButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 10,
  },
  // Feed Filter Styles
  feedFilterContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDEFF1',
  },
  feedHeaderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dropdownWrapper: {
    position: 'relative',
    zIndex: 1000,
  },
  feedTypeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'transparent',
    minWidth: 90,
    maxWidth: 140,
  },
  feedTypeText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1001,
    minWidth: 180,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  dropdownOptionText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#800020',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  createButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Photos Grid Styles
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  photoItem: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
  },
  photoInfo: {
    gap: 2,
  },
  photoTitle: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  photoSource: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    textTransform: 'capitalize',
  },
  emptyPhotosContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyPhotosText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyPhotosSubtext: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
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
  // Create Options Modal Styles
  createOptionsModal: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  createModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  createOptionText: {
    flex: 1,
  },
  createOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  createOptionSubtitle: {
    fontSize: 13,
  },
  cancelCreateButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelCreateText: {
    fontSize: 16,
    fontWeight: '600',
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
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
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
  
  // Poll Modal Styles
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelHint: {
    fontSize: 12,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
  },
  removeOptionButton: {
    padding: 4,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  durationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  durationButtonActive: {
    backgroundColor: 'rgba(128, 0, 32, 0.1)',
    borderColor: '#800020',
  },
  durationButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  durationButtonTextActive: {
    color: '#800020',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: '#800020',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  visibilityButtons: {
    gap: 12,
  },
  visibilityButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  visibilityButtonActive: {
    backgroundColor: '#800020',
    borderColor: '#800020',
  },
  visibilityButtonContent: {
    gap: 8,
  },
  visibilityButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  visibilityButtonDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    gap: 4,
    maxWidth: 120,
  },
  dateFilterText: {
    fontSize: 13,
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
  
  // Reactions Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  reactionsModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  reactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reactionsTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  reactionsCount: {
    fontSize: 14,
    marginBottom: 16,
  },
  reactionsListContainer: {
    maxHeight: 400,
  },
  reactionsLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  reactionsLoadingText: {
    fontSize: 14,
  },
  reactionsEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  reactionsEmptyText: {
    fontSize: 14,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  reactionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  reactionAvatarImage: {
    width: '100%',
    height: '100%',
  },
  reactionAvatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  reactionInfo: {
    flex: 1,
  },
  reactionName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  reactionDate: {
    fontSize: 12,
  },
  reactionsSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  reactionsSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  votersFilters: {
    gap: 12,
    marginBottom: 16,
  },
  filterScrollContainer: {
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  voterItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  voterInfo: {
    flex: 1,
  },
  selectedOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  optionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionBadgeText: {
    fontSize: 11,
    fontWeight: '500',
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
  input: {
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
  
  // Actions button and menu styles
  actionsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsMenuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '50%',
  },
  actionsMenuContent: {
    paddingTop: 12,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  actionMenuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionMenuItemContent: {
    flex: 1,
  },
  actionMenuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
});
