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
  visibility?: string;
  type: 'post' | 'announcement';
  category?: string;
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
  console.log('Transforming post:', post.post_id, 'Org data:', post.organizations);
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
    likes: 0, // TODO: Implement likes system
    comments: 0, // TODO: Implement comments system
    media_url: post.media_url,
    visibility: post.visibility,
    type: 'post',
    category: undefined // Category field doesn't exist in database
  };
};

const transformAnnouncementToFeed = (announcement: any): FeedPost => {
  const announcementId = announcement.id || announcement.announcement_id;
  console.log('Transforming announcement:', announcementId, 'Org data:', announcement.organizations);
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

function PostCard({ post }: { post: FeedPost }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  // Dynamic colors for PostCard
  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const textColor = Colors[colorScheme ?? 'light'].text;
  const cardBackground = Colors[colorScheme ?? 'light'].card;
  const borderColor = Colors[colorScheme ?? 'light'].border;
  const metaColor = Colors[colorScheme ?? 'light'].tabIconDefault;

  const handleOrganizationPress = () => {
    router.push({
      pathname: '/organization/[id]',
      params: { 
        id: post.organizationId, 
        orgName: post.organization 
      }
    });
  };

  return (
    <View style={[styles.redditStylePost, { backgroundColor: cardBackground, borderBottomColor: borderColor }]}>
      {/* Post header with org avatar and info */}
      <View style={styles.redditStylePostHeader}>
        <TouchableOpacity 
          style={styles.communityInfo}
          onPress={handleOrganizationPress}
        >
          <View style={[styles.redditStyleOrgAvatar, { backgroundColor: post.organizationColor }]}>
            {post.organizationLogo ? (
              <Image 
                source={{ uri: post.organizationLogo }} 
                style={styles.redditStyleOrgAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <ThemedText style={styles.redditStyleOrgAvatarText}>
                {post.organization.charAt(0)}
              </ThemedText>
            )}
          </View>
          <View style={styles.redditHeaderInfo}>
            <View style={styles.redditInlineHeader}>
              <ThemedText style={[styles.redditOrgNameHeader, { color: textColor }]}>
                {post.organization}
              </ThemedText>
              {post.type === 'announcement' && (
                <View style={styles.announcementTag}>
                  <ThemedText style={styles.announcementTagText}>ANNOUNCEMENT</ThemedText>
                </View>
              )}
              <ThemedText style={[styles.redditPostTimeInline, { color: metaColor }]}>
                • {post.timestamp}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Post title */}
      {post.title && (
        <ThemedText style={[styles.redditPostTitleMain, { color: textColor }]}>
          {post.title}
        </ThemedText>
      )}

      {/* Post content with 2-line limit */}
      <ExpandablePostText 
        content={post.content}
        colors={colors}
      />

      {/* Media if present */}
      {post.media_url && (
        <View style={styles.redditPostImageWrapper}>
          <Image 
            source={{ uri: post.media_url }} 
            style={styles.redditPostImageMain}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Text-based action bar */}
      <View style={styles.redditStyleActionBar}>
        <TouchableOpacity style={styles.redditStyleActionButton}>
          <ThemedText style={[styles.redditStyleActionText, { color: metaColor }]}>
            {post.likes || 0} likes
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.redditStyleActionButton}>
          <ThemedText style={[styles.redditStyleActionText, { color: metaColor }]}>
            {post.comments || 0} comments
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.redditStyleActionButton}>
          <ThemedText style={[styles.redditStyleActionText, { color: metaColor }]}>
            Share
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}


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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'announcements' | 'posts'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
      console.log('Loading feed data...');
      
      // Try to fetch user organizations, fallback to empty array if it fails
      let userOrgsData: any[] = [];
      let postsData: any[] = [];
      let announcementsData: any[] = [];
      
      try {
        [postsData, announcementsData, userOrgsData] = await Promise.all([
          fetchAllPosts(),
          fetchUserAnnouncementsRaw(),
          fetchUserOrganizations()
        ]);
      } catch (fetchError) {
        console.warn('Error fetching user organizations, falling back to public posts only:', fetchError);
        [postsData, announcementsData] = await Promise.all([
          fetchAllPosts(),
          fetchUserAnnouncementsRaw()
        ]);
        userOrgsData = [];
      }
      
      console.log('Raw posts data:', postsData?.length || 0, 'posts');
      console.log('Raw announcements data:', announcementsData?.length || 0, 'announcements');
      console.log('User organizations:', userOrgsData?.length || 0, 'orgs');
      
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
      
      console.log('Filtered posts:', filteredPosts?.length || 0, 'posts after visibility filtering');
      
      const transformedPosts = filteredPosts.map(transformPostToFeed);
      const transformedAnnouncements = (announcementsData || []).map(transformAnnouncementToFeed);
      
      console.log('Transformed posts:', transformedPosts?.length || 0);
      console.log('Transformed announcements:', transformedAnnouncements?.length || 0);
      
      const allFeedItems = [...transformedPosts, ...transformedAnnouncements]
        .sort((a, b) => {
          // Sort by raw created_at timestamps (newest first)
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          return timeB - timeA;
        });
      
      console.log('Final feed items:', allFeedItems?.length || 0);
      console.log('Sample feed item:', allFeedItems?.[0]);
      
      setFeedData(allFeedItems);
      setFilteredFeed(allFeedItems);
      
      if (allFeedItems.length === 0) {
        console.log('No feed items found. Check if there are posts/announcements in the database.');
      }
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

  // Filter feed data
  useEffect(() => {
    let filtered = [...feedData];
    
    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(item => item.type === activeTab.slice(0, -1)); // Remove 's' from 'posts'/'announcements'
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.content.toLowerCase().includes(query) ||
        item.organization.toLowerCase().includes(query) ||
        (item.title && item.title.toLowerCase().includes(query))
      );
    }
    
    setFilteredFeed(filtered);
  }, [feedData, activeTab, searchQuery]);

  // Load data on mount
  useEffect(() => {
    loadFeedData();
  }, []);

  return (
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
            <ThemedText style={[styles.logo, { color: textColor }]}>NexOrg</ThemedText>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <IconSymbol name="magnifyingglass" size={22} color={placeholderColor} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <IconSymbol name="bell" size={22} color={placeholderColor} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Reddit-style Search Bar */}
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
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={18} color={placeholderColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Reddit-style Tab Container */}
      <View style={[styles.tabContainer, { backgroundColor: headerBackground, borderBottomColor: borderColor }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <ThemedText style={[
              { color: placeholderColor, fontSize: 14, fontWeight: '500' }, 
              activeTab === 'all' && { color: '#800020', fontWeight: '700' }
            ]}>
              All
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'announcements' && styles.activeTab]}
            onPress={() => setActiveTab('announcements')}
          >
            <ThemedText style={[
              { color: placeholderColor, fontSize: 14, fontWeight: '500' }, 
              activeTab === 'announcements' && { color: '#800020', fontWeight: '700' }
            ]}>
              Announcements
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <ThemedText style={[
              { color: placeholderColor, fontSize: 14, fontWeight: '500' }, 
              activeTab === 'posts' && { color: '#800020', fontWeight: '700' }
            ]}>
              Posts
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </View>


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
          filteredFeed.map((item) => (
            <PostCard key={`${item.type}-${item.id}`} post={item} />
          ))
        )}
      </View>

    </ScrollView>
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
    gap: 8,
  },
  // Reddit-style Post Layout (same as homepage)
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
  redditPostTextCompact: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  showMoreInline: {
    fontSize: 14,
    fontWeight: '600',
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
});
