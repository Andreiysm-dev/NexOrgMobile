import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, Image, RefreshControl, Alert, TextInput } from 'react-native';
import { fetchAllPosts, fetchAllAnnouncements, fetchUserAnnouncements, fetchUserAnnouncementsRaw } from '@/lib/api';
import { fetchUserOrganizations } from '@/lib/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SideMenu } from '@/components/SideMenu';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/feed/PostCard';
import { AnnouncementCard } from '@/components/feed/AnnouncementCard';
import { PollCard } from '@/components/feed/PollCard';
import { PostModal } from '@/components/feed/PostModal';

// Expandable Text Component for Posts (2 lines max) - Same as homepage
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

interface FeedPost {
  id: string;
  title?: string;
  content: string;
  organization: string;
  organizationId: string;
  organizationColor: string;
  organizationLogo?: string;
  timestamp: string;
  created_at: string; // Raw timestamp for sorting
  likes: number;
  comments: number;
  media_url?: string;
  media_urls?: string[];
  visibility?: string;
  type: 'post' | 'announcement' | 'poll';
  category?: string;
  user_has_liked?: boolean;
  like_count?: number;
  comment_count?: number;
  // Poll-specific fields
  poll_id?: string;
  question?: string;
  options?: any[];
  total_votes?: number;
  expires_at?: string;
  allow_multiple?: boolean;
  user_votes?: string[];
  is_expired?: boolean;
}

interface RawPost {
  post_id: string;
  org_id: string;
  title: string;
  content: string;
  created_at: string;
  media_url?: string;
  visibility: string;
  organizations: {
    id: string;
    title: string;
    org_pic?: string;
    orgPic?: string;
    color?: string;
    category?: string;
  };
}

interface RawAnnouncement {
  announcement_id: string;
  org_id: string;
  title: string;
  content: string;
  created_at: string;
  image?: string;
  organizations: {
    id: string;
    title: string;
    org_pic?: string;
    orgPic?: string;
    color?: string;
    category?: string;
  };
}

// Helper function to format timestamps
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return date.toLocaleDateString();
};

// Transform raw API data to feed format
const transformPostToFeed = (post: any): FeedPost => {
  // Handle media URLs - support both single and multiple images
  let mediaUrls: string[] = [];
  if (post.media_urls && Array.isArray(post.media_urls)) {
    mediaUrls = post.media_urls.filter((url: string) => url && url.trim() !== '');
  } else if (post.media_url && post.media_url.trim() !== '') {
    mediaUrls = [post.media_url];
  }
  
  return {
    id: post.post_id,
    title: post.title,
    content: post.content,
    organization: post.organizations?.org_name || `Organization ${post.org_id}`,
    organizationId: post.org_id,
    organizationColor: '#800020', // Default maroon color since color field doesn't exist
    organizationLogo: post.organizations?.org_pic,
    timestamp: formatTimeAgo(post.created_at),
    created_at: post.created_at, // Raw timestamp for sorting
    likes: post.like_count || 0,
    comments: post.comment_count || 0,
    media_url: mediaUrls[0], // Keep for backwards compatibility
    media_urls: mediaUrls,
    visibility: post.visibility,
    type: 'post',
    category: undefined, // Category field doesn't exist in database
    user_has_liked: false, // Will be fetched separately
    like_count: post.like_count || 0,
    comment_count: post.comment_count || 0
  };
};

const transformAnnouncementToFeed = (announcement: any): FeedPost => {
  const announcementId = announcement.id || announcement.announcement_id;
  return {
    id: announcementId,
    title: announcement.title,
    content: announcement.content,
    organization: announcement.organizations?.org_name || `Organization ${announcement.org_id}`,
    organizationId: announcement.org_id,
    organizationColor: '#800020', // Default maroon color since color field doesn't exist
    organizationLogo: announcement.organizations?.org_pic,
    timestamp: formatTimeAgo(announcement.created_at),
    created_at: announcement.created_at, // Raw timestamp for sorting
    likes: 0, // TODO: Implement likes system
    comments: 0, // TODO: Implement comments system
    media_url: announcement.image,
    type: 'announcement',
    category: undefined // Category field doesn't exist in database
  };
};

const transformPollToFeed = (poll: any): FeedPost => {
  const now = new Date();
  const expiresAt = new Date(poll.expires_at);
  const isExpired = now > expiresAt;

  return {
    id: poll.poll_id,
    poll_id: poll.poll_id,
    title: poll.question,
    content: poll.question,
    question: poll.question,
    organization: poll.organizations?.org_name || `Organization ${poll.org_id}`,
    organizationId: poll.org_id,
    organizationColor: '#800020',
    organizationLogo: poll.organizations?.org_pic,
    timestamp: formatTimeAgo(poll.created_at),
    created_at: poll.created_at,
    likes: 0,
    comments: 0,
    type: 'poll',
    options: poll.options || [],
    total_votes: poll.total_votes || 0,
    expires_at: poll.expires_at,
    allow_multiple: poll.allow_multiple,
    visibility: poll.visibility,
    user_votes: poll.user_votes || [],
    is_expired: isExpired
  };
};

// Fetch all polls from all organizations
const fetchAllPolls = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    // Get user's organization memberships
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id);

    const userOrgIds = new Set((memberships || []).map((m: any) => m.org_id));

    // Fetch all polls
    const { data: polls, error: pollsError } = await supabase
      .from('polls')
      .select(`
        *,
        organizations!inner(org_id, org_name, org_pic)
      `)
      .order('created_at', { ascending: false });

    if (pollsError || !polls) {
      console.error('Error fetching polls:', pollsError);
      return [];
    }

    // Filter polls by visibility
    const filteredPolls = polls.filter((poll: any) => {
      if (poll.visibility === 'public') return true;
      if (poll.visibility === 'members_only' && userOrgIds.has(poll.org_id)) return true;
      return false;
    });

    // Fetch poll options for all polls
    const pollIds = filteredPolls.map((p: any) => p.poll_id);
    if (pollIds.length === 0) return [];

    const { data: options } = await supabase
      .from('poll_options')
      .select('*')
      .in('poll_id', pollIds);

    // Fetch user votes
    const { data: userVotes } = await supabase
      .from('poll_votes')
      .select('poll_id, option_id')
      .eq('user_id', user.id)
      .in('poll_id', pollIds);

    // Group options by poll_id
    const optionsByPoll = (options || []).reduce((acc: any, option: any) => {
      if (!acc[option.poll_id]) acc[option.poll_id] = [];
      acc[option.poll_id].push(option);
      return acc;
    }, {});

    // Group user votes by poll_id
    const votesByPoll = (userVotes || []).reduce((acc: any, vote: any) => {
      if (!acc[vote.poll_id]) acc[vote.poll_id] = [];
      acc[vote.poll_id].push(vote.option_id);
      return acc;
    }, {});

    // Format polls with options and user votes
    return filteredPolls.map((poll: any) => {
      const pollOptions = optionsByPoll[poll.poll_id] || [];
      const totalVotes = pollOptions.reduce((sum: number, opt: any) => sum + (opt.vote_count || 0), 0);

      return {
        ...poll,
        options: pollOptions,
        total_votes: totalVotes,
        user_votes: votesByPoll[poll.poll_id] || []
      };
    });
  } catch (error) {
    console.error('Error in fetchAllPolls:', error);
    return [];
  }
};

export default function FeedScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const params = useLocalSearchParams();
  const router = useRouter();

  // Dynamic colors based on theme
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#1A1A1B' : '#DAE0E6';
  const cardBackground = isDark ? '#272729' : 'white';
  const headerBackground = isDark ? '#1A1A1B' : 'white';
  const textColor = isDark ? '#D7DADC' : '#1A1A1B';
  const borderColor = isDark ? '#343536' : '#EDEFF1';
  const searchBackground = isDark ? '#272729' : '#F6F7F8';
  const placeholderColor = isDark ? '#818384' : '#878A8C';

  const [feedData, setFeedData] = useState<FeedPost[]>([]);
  const [filteredFeed, setFilteredFeed] = useState<FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'announcements' | 'posts'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'likes'>('time');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contentDropdownVisible, setContentDropdownVisible] = useState(false);
  const [sortDropdownVisible, setSortDropdownVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [isPostModalVisible, setIsPostModalVisible] = useState(false);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());

  // Navigation function for organization press
  const handleOrganizationPress = (orgId: string, orgName: string) => {
    router.push({
      pathname: '/organization/[id]',
      params: { 
        id: orgId, 
        orgName: orgName 
      }
    });
  };

  // Side menu handlers
  const handleMenuPress = () => {
    setSideMenuVisible(true);
  };

  const handleSideMenuClose = () => {
    setSideMenuVisible(false);
  };

  const handleProfilePress = () => {
    setSideMenuVisible(false);
    Alert.alert('Profile', 'Profile feature coming soon!');
  };

  const handleSettingsPress = () => {
    setSideMenuVisible(false);
    Alert.alert('Settings', 'Settings feature coming soon!');
  };

  // Post modal handlers
  const handlePostPress = (post: FeedPost) => {
    setSelectedPost(post);
    setIsPostModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsPostModalVisible(false);
    setSelectedPost(null);
  };

  const handleLike = async (postId: string) => {
    // Like is handled within PostModal component
    // This callback is just for syncing state if needed
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

  // Handle URL parameters for initial tab
  useEffect(() => {
    if (params.tab && typeof params.tab === 'string') {
      const validTabs: ('all' | 'announcements' | 'posts')[] = ['all', 'announcements', 'posts'];
      if (validTabs.includes(params.tab as any)) {
        setActiveTab(params.tab as 'all' | 'announcements' | 'posts');
      }
    }
  }, [params.tab]);


  // Load feed data
  const loadFeedData = async () => {
    try {
      setLoading(true);
      
      // Try to fetch user organizations, fallback to empty array if it fails
      let userOrgsData: any[] = [];
      let postsData: any[] = [];
      let announcementsData: any[] = [];
      let pollsData: any[] = [];
      
      try {
        [postsData, announcementsData, pollsData, userOrgsData] = await Promise.all([
          fetchAllPosts(),
          fetchUserAnnouncementsRaw(),
          fetchAllPolls(),
          fetchUserOrganizations()
        ]);
      } catch (fetchError) {
        console.warn('Error fetching user organizations, falling back to public posts only:', fetchError);
        [postsData, announcementsData, pollsData] = await Promise.all([
          fetchAllPosts(),
          fetchUserAnnouncementsRaw(),
          fetchAllPolls()
        ]);
        userOrgsData = [];
      }
      
      // Set organizations for side menu
      if (userOrgsData && Array.isArray(userOrgsData)) {
        setOrganizations(userOrgsData);
      }
      
      // Get user's organization IDs for filtering
      const userOrgIds = new Set((userOrgsData || []).map((org: any) => org.organizations?.org_id || org.org_id || org.id));
      
      // Filter posts based on visibility
      const filteredPosts = (postsData || []).filter((post: any) => {
        // Show public posts to everyone
        if (post.visibility === 'public') {
          return true;
        }
        // Show member-only posts only to members of that organization
        if (post.visibility === 'members' && userOrgIds.has(post.org_id)) {
          return true;
        }
        // Hide all other posts
        return false;
      });
      
      const transformedPosts = filteredPosts.map(transformPostToFeed);
      const transformedAnnouncements = (announcementsData || []).map(transformAnnouncementToFeed);
      const transformedPolls = (pollsData || []).map(transformPollToFeed);
      
      const allFeedItems = [...transformedPosts, ...transformedAnnouncements, ...transformedPolls]
        .sort((a, b) => {
          // Sort by raw created_at timestamps (newest first)
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          return timeB - timeA;
        });
      
      setFeedData(allFeedItems);
      setFilteredFeed(allFeedItems);
    } catch (error) {
      console.error('Error loading feed data:', error);
      Alert.alert('Error', 'Failed to load feed data. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Refresh feed data
  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeedData();
    setRefreshing(false);
  };

  // Filter and sort feed based on active tab, search query, and sort preference
  useEffect(() => {
    let filtered = [...feedData];
    
    // Filter by tab
    if (activeTab === 'announcements') {
      filtered = filtered.filter(item => item.type === 'announcement');
    } else if (activeTab === 'posts') {
      filtered = filtered.filter(item => item.type === 'post' || item.type === 'poll');
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query) ||
        item.question?.toLowerCase().includes(query) ||
        item.organization?.toLowerCase().includes(query)
      );
    }
    
    // Sort by preference
    if (sortBy === 'time') {
      filtered = filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else if (sortBy === 'likes') {
      filtered = filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    
    setFilteredFeed(filtered);
  }, [feedData, activeTab, searchQuery, sortBy]);

  // Load data on mount
  useEffect(() => {
    loadFeedData();
  }, []);

  return (
    <>
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Reddit-style Header */}
      <View style={[styles.header, { backgroundColor: headerBackground, borderBottomColor: borderColor }]}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <TouchableOpacity style={styles.menuButton} onPress={handleMenuPress}>
              <IconSymbol name="line.3.horizontal" size={22} color={placeholderColor} />
            </TouchableOpacity>
            <ThemedText style={[styles.logo, { color: textColor }]}>NexOrg</ThemedText>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => {
                setSearchVisible(!searchVisible);
                setContentDropdownVisible(false);
                setSortDropdownVisible(false);
              }}
            >
              <IconSymbol name="magnifyingglass" size={22} color={searchVisible ? '#800020' : placeholderColor} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => router.push('/(tabs)/notifications')}
            >
              <IconSymbol name="bell" size={22} color={placeholderColor} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Collapsible Search Bar */}
      {searchVisible && (
        <View style={[styles.searchContainer, { backgroundColor: headerBackground }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: searchBackground, borderColor }]}>
            <IconSymbol name="magnifyingglass" size={18} color={placeholderColor} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search NexOrg"
              placeholderTextColor={placeholderColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol name="xmark.circle.fill" size={18} color={placeholderColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Filter Buttons Section - Compact on Right */}
      <View style={[styles.filterContainer, { backgroundColor: headerBackground }]}>
        <View style={styles.filterButtonsRow}>
          {/* Content Filter Button */}
          <TouchableOpacity 
            style={[styles.compactFilterButton, { backgroundColor: 'transparent', borderColor }, contentDropdownVisible && { backgroundColor: 'rgba(128, 0, 32, 0.1)', borderColor: '#800020' }]}
            onPress={() => {
              setContentDropdownVisible(!contentDropdownVisible);
              setSortDropdownVisible(false);
              setSearchVisible(false);
            }}
          >
            <IconSymbol 
              name={activeTab === 'all' ? 'doc.text' : 
                   activeTab === 'announcements' ? 'megaphone' : 'bubble.left.and.bubble.right'} 
              size={14} 
              color={contentDropdownVisible ? '#800020' : placeholderColor} 
            />
            <ThemedText style={[
              styles.compactFilterText, 
              { color: contentDropdownVisible ? '#800020' : placeholderColor }
            ]}>
              {activeTab === 'all' ? 'All' : 
               activeTab === 'announcements' ? 'Announce' : 'Posts'}
            </ThemedText>
            <IconSymbol 
              name={contentDropdownVisible ? "chevron.up" : "chevron.down"} 
              size={12} 
              color={contentDropdownVisible ? '#800020' : placeholderColor} 
            />
          </TouchableOpacity>

          {/* Sort Filter Button */}
          <TouchableOpacity 
            style={[styles.compactFilterButton, { backgroundColor: 'transparent', borderColor }, sortDropdownVisible && { backgroundColor: 'rgba(128, 0, 32, 0.1)', borderColor: '#800020' }]}
            onPress={() => {
              setSortDropdownVisible(!sortDropdownVisible);
              setContentDropdownVisible(false);
              setSearchVisible(false);
            }}
          >
            <IconSymbol 
              name={sortBy === 'time' ? 'clock' : 'heart'} 
              size={14} 
              color={sortDropdownVisible ? '#800020' : placeholderColor} 
            />
            <ThemedText style={[
              styles.compactFilterText, 
              { color: sortDropdownVisible ? '#800020' : placeholderColor }
            ]}>
              {sortBy === 'time' ? 'Latest' : 'Liked'}
            </ThemedText>
            <IconSymbol 
              name={sortDropdownVisible ? "chevron.up" : "chevron.down"} 
              size={12} 
              color={sortDropdownVisible ? '#800020' : placeholderColor} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Filter Dropdown */}
      {contentDropdownVisible && (
        <View style={[styles.compactDropdown, { backgroundColor: headerBackground, borderColor, right: 90 }]}>
          <TouchableOpacity 
            style={[styles.compactDropdownItem, activeTab === 'all' && styles.activeDropdownItem]}
            onPress={() => {
              setActiveTab('all');
              setContentDropdownVisible(false);
            }}
          >
            <IconSymbol name="doc.text" size={14} color={activeTab === 'all' ? '#800020' : placeholderColor} />
            <ThemedText style={[
              styles.compactDropdownText, 
              { color: activeTab === 'all' ? '#800020' : textColor }
            ]}>
              All
            </ThemedText>
            {activeTab === 'all' && <IconSymbol name="checkmark" size={12} color="#800020" />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.compactDropdownItem, activeTab === 'announcements' && styles.activeDropdownItem]}
            onPress={() => {
              setActiveTab('announcements');
              setContentDropdownVisible(false);
            }}
          >
            <IconSymbol name="megaphone" size={14} color={activeTab === 'announcements' ? '#800020' : placeholderColor} />
            <ThemedText style={[
              styles.compactDropdownText, 
              { color: activeTab === 'announcements' ? '#800020' : textColor }
            ]}>
              Announce
            </ThemedText>
            {activeTab === 'announcements' && <IconSymbol name="checkmark" size={12} color="#800020" />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.compactDropdownItem, activeTab === 'posts' && styles.activeDropdownItem]}
            onPress={() => {
              setActiveTab('posts');
              setContentDropdownVisible(false);
            }}
          >
            <IconSymbol name="bubble.left.and.bubble.right" size={14} color={activeTab === 'posts' ? '#800020' : placeholderColor} />
            <ThemedText style={[
              styles.compactDropdownText, 
              { color: activeTab === 'posts' ? '#800020' : textColor }
            ]}>
              Posts
            </ThemedText>
            {activeTab === 'posts' && <IconSymbol name="checkmark" size={12} color="#800020" />}
          </TouchableOpacity>
        </View>
      )}

      {/* Sort Filter Dropdown */}
      {sortDropdownVisible && (
        <View style={[styles.compactDropdown, { backgroundColor: headerBackground, borderColor, right: 16 }]}>
          <TouchableOpacity 
            style={[styles.compactDropdownItem, sortBy === 'time' && styles.activeDropdownItem]}
            onPress={() => {
              setSortBy('time');
              setSortDropdownVisible(false);
            }}
          >
            <IconSymbol name="clock" size={14} color={sortBy === 'time' ? '#800020' : placeholderColor} />
            <ThemedText style={[
              styles.compactDropdownText, 
              { color: sortBy === 'time' ? '#800020' : textColor }
            ]}>
              Latest
            </ThemedText>
            {sortBy === 'time' && <IconSymbol name="checkmark" size={12} color="#800020" />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.compactDropdownItem, sortBy === 'likes' && styles.activeDropdownItem]}
            onPress={() => {
              setSortBy('likes');
              setSortDropdownVisible(false);
            }}
          >
            <IconSymbol name="heart" size={14} color={sortBy === 'likes' ? '#800020' : placeholderColor} />
            <ThemedText style={[
              styles.compactDropdownText, 
              { color: sortBy === 'likes' ? '#800020' : textColor }
            ]}>
              Liked
            </ThemedText>
            {sortBy === 'likes' && <IconSymbol name="checkmark" size={12} color="#800020" />}
          </TouchableOpacity>
        </View>
      )}

      {/* Reddit-style Content */}
      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading feed...</ThemedText>
          </View>
        ) : filteredFeed.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              {feedData.length === 0 ? 'No posts available yet.' : 'No posts match your search.'}
            </ThemedText>
          </View>
        ) : (
          filteredFeed.map((item) => {
            if (item.type === 'poll') {
              return (
                <PollCard
                  key={`poll-${item.poll_id}`}
                  poll={{
                    poll_id: item.poll_id!,
                    question: item.question!,
                    options: item.options!,
                    total_votes: item.total_votes!,
                    expires_at: item.expires_at!,
                    allow_multiple: item.allow_multiple!,
                    visibility: item.visibility,
                    created_at: item.created_at,
                    user_votes: item.user_votes,
                    is_expired: item.is_expired,
                    organizations: {
                      org_name: item.organization,
                      org_pic: item.organizationLogo || null
                    }
                  }}
                  onVote={async (pollId, optionIds) => {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        Alert.alert('Error', 'You must be logged in to vote');
                        return;
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
                        
                        await supabase
                          .from('poll_votes')
                          .delete()
                          .eq('poll_id', pollId)
                          .eq('user_id', user.id);

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

                      if (voteError) throw new Error('Failed to record vote');

                      // Update vote counts for each new option
                      for (const optionId of optionIds) {
                        const { data: option } = await supabase
                          .from('poll_options')
                          .select('vote_count')
                          .eq('option_id', optionId)
                          .single();

                        if (option) {
                          await supabase
                            .from('poll_options')
                            .update({ vote_count: (option.vote_count || 0) + 1 })
                            .eq('option_id', optionId);
                        }
                      }

                      Alert.alert('Success', hasExistingVotes ? 'Your vote has been updated!' : 'Your vote has been recorded!');
                      await loadFeedData();
                    } catch (error) {
                      console.error('Failed to vote on poll:', error);
                      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit vote. Please try again.');
                    }
                  }}
                />
              );
            }
            
            return (
              <PostCard 
                key={`${item.type}-${item.id}`} 
                post={item}
                onPress={() => handlePostPress(item)}
                onLikeUpdate={(postId, liked, newCount) => {
                  setFeedData(prev => prev.map(p => 
                    p.id === postId ? { ...p, user_has_liked: liked, like_count: newCount, likes: newCount } : p
                  ));
                }}
              />
            );
          })
        )}
      </View>

    </ScrollView>

    {/* Side Menu */}
    <SideMenu
      visible={sideMenuVisible}
      onClose={handleSideMenuClose}
      organizations={organizations}
      onOrganizationPress={handleOrganizationPress}
      onProfilePress={handleProfilePress}
      onSettingsPress={handleSettingsPress}
    />

    {/* Post Modal */}
    <PostModal
      visible={isPostModalVisible}
      post={selectedPost}
      onClose={handleCloseModal}
      onLike={handleLike}
      onShare={handleShare}
      onBookmark={handleBookmark}
      isBookmarked={selectedPost ? bookmarkedPosts.has(selectedPost.id) : false}
    />
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDEFF1',
    zIndex: 1000,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1B',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    padding: 8,
  },
  feedCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F6F7F8',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1C',
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDEFF1',
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    gap: 0,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#800020',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#878A8C',
  },
  activeTabText: {
    color: '#800020',
    fontWeight: '700',
  },
  contentContainer: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  postCard: {
    marginHorizontal: 0,
    marginBottom: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EDEFF1',
  },
  postHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  orgInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orgInitial: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  orgDetails: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#6B7280',
  },
  metaSeparator: {
    fontSize: 12,
    color: '#6B7280',
  },
  category: {
    fontSize: 12,
    fontWeight: '500',
  },
  postContent: {
    flex: 1,
    paddingRight: 12,
    paddingLeft: 4,
    maxWidth: '100%',
  },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#800020',
    marginBottom: 8,
  },
  postImage: {
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFBFC',
    gap: 24,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  postActionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  eventDetails: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventText: {
    fontSize: 14,
    color: '#374151',
  },
  eventButton: {
    margin: 16,
    marginTop: 0,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  eventButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  trendingSection: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  trendingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#800020',
  },
  trendingList: {
    gap: 8,
  },
  trendingItem: {
    fontSize: 14,
    color: '#6B7280',
    paddingVertical: 4,
  },
  // New styles for updated functionality
  orgAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  visibility: {
    fontSize: 12,
    color: '#6B7280',
  },
  postImageContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7F8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#EDEFF1',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Reddit-style Card Components
  redditCard: {
    flexDirection: 'row',
    marginTop: 4,
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    maxWidth: '100%',
  },
  votingColumn: {
    width: 40,
    alignItems: 'center',
    paddingTop: 4,
  },
  voteButton: {
    padding: 4,
  },
  voteCount: {
    fontSize: 12,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  communityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  communityAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityAvatarImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  communityAvatarText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  communityName: {
    fontSize: 12,
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  mediaContainer: {
    marginVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: 150,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  announcementBadge: {
    backgroundColor: '#800020',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  announcementBadgeText: {
    color: 'white',
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
  },
  // Styles for ExpandablePostText component
  redditPostTextCompact: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  showMoreInline: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Dropdown Filter Styles
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    position: 'relative',
  },
  filterButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  compactFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  compactFilterText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dropdownMenuContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  dropdownContainer: {
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    paddingVertical: 8,
  },
  headerDropdown: {
    position: 'absolute',
    top: 60,
    minWidth: 150,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    paddingVertical: 8,
    zIndex: 1000,
  },
  filterDropdown: {
    position: 'absolute',
    top: 60,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    paddingVertical: 4,
    zIndex: 1000,
  },
  dropdownSection: {
    paddingVertical: 8,
  },
  dropdownSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  activeDropdownItem: {
    backgroundColor: 'rgba(128, 0, 32, 0.1)',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  compactDropdown: {
    position: 'absolute',
    top: 40,
    minWidth: 80,
    borderRadius: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    paddingVertical: 2,
    zIndex: 1000,
  },
  compactDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 28,
  },
  compactDropdownText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
    flex: 1,
  },
});
