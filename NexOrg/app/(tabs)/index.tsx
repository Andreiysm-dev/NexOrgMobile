import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, Image, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchUserOrganizations, fetchUserAnnouncements, fetchAllPosts } from '@/lib/api';
import { useRouter } from 'expo-router';
import { SideMenu } from '@/components/SideMenu';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/feed/PostCard';
import { AnnouncementCard } from '@/components/feed/AnnouncementCard';
import { PollCard } from '@/components/feed/PollCard';
import { PostModal } from '@/components/feed/PostModal';

// Expandable Text Component for Posts (2 lines max) - Same as organization page
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

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [showOrgSection, setShowOrgSection] = useState(true);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [isPostModalVisible, setIsPostModalVisible] = useState(false);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());

  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const textColor = Colors[colorScheme ?? 'light'].text;
  const cardBackground = Colors[colorScheme ?? 'light'].card;
  const borderColor = Colors[colorScheme ?? 'light'].border;
  const metaColor = Colors[colorScheme ?? 'light'].tabIconDefault;

  // Navigation functions
  const handleNotifications = () => {
    router.push('/(tabs)/notifications');
  };

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

  const handleOrganizationPress = (orgId: string, orgName?: string) => {
    router.push({
      pathname: '/organization/[id]',
      params: { 
        id: orgId, 
        orgName: orgName || 'Organization'
      }
    });
  };

  const handleViewAllOrganizations = () => {
    router.push('/explore');
  };

  // Post modal handlers
  const handlePostPress = (post: any) => {
    setSelectedPost(post);
    setIsPostModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsPostModalVisible(false);
    setSelectedPost(null);
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

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load organizations
      const orgsResponse = await fetchUserOrganizations();
      
      if (orgsResponse && Array.isArray(orgsResponse) && orgsResponse.length > 0) {
        setOrganizations(orgsResponse);
      } else if (orgsResponse && (orgsResponse as any).success && (orgsResponse as any).organizations) {
        setOrganizations((orgsResponse as any).organizations);
      } else {
        setOrganizations([]);
      }
      
      // Load announcements
      const announcementsResponse = await fetchUserAnnouncements();
      
      if (announcementsResponse && Array.isArray(announcementsResponse)) {
        setAnnouncements(announcementsResponse);
      } else if (announcementsResponse && (announcementsResponse as any).success && (announcementsResponse as any).announcements) {
        setAnnouncements((announcementsResponse as any).announcements);
      } else {
        setAnnouncements([]);
      }
      
      // Load posts
      const postsResponse = await fetchAllPosts();
      
      if (postsResponse && Array.isArray(postsResponse)) {
        setPosts(postsResponse);
      } else if (postsResponse && (postsResponse as any).success && (postsResponse as any).posts) {
        setPosts((postsResponse as any).posts);
      } else {
        setPosts([]);
      }

      // Load polls from user's organizations only
      const { data: { user } } = await supabase.auth.getUser();
      if (user && orgsResponse && Array.isArray(orgsResponse)) {
        const userOrgIds = orgsResponse.map((org: any) => org.organizations?.org_id || org.org_id || org.id);
        
        if (userOrgIds.length > 0) {
          const { data: userPolls } = await supabase
            .from('polls')
            .select(`
              *,
              organizations!inner(org_id, org_name, org_pic)
            `)
            .in('org_id', userOrgIds)
            .order('created_at', { ascending: false });

          if (userPolls) {
            const pollIds = userPolls.map((p: any) => p.poll_id);
            
            const { data: options } = await supabase
              .from('poll_options')
              .select('*')
              .in('poll_id', pollIds);

            const { data: userVotes } = await supabase
              .from('poll_votes')
              .select('poll_id, option_id')
              .eq('user_id', user.id)
              .in('poll_id', pollIds);

            const optionsByPoll = (options || []).reduce((acc: any, option: any) => {
              if (!acc[option.poll_id]) acc[option.poll_id] = [];
              acc[option.poll_id].push(option);
              return acc;
            }, {});

            const votesByPoll = (userVotes || []).reduce((acc: any, vote: any) => {
              if (!acc[vote.poll_id]) acc[vote.poll_id] = [];
              acc[vote.poll_id].push(vote.option_id);
              return acc;
            }, {});

            const formattedPolls = userPolls.map((poll: any) => {
              const pollOptions = optionsByPoll[poll.poll_id] || [];
              const totalVotes = pollOptions.reduce((sum: number, opt: any) => sum + (opt.vote_count || 0), 0);
              const now = new Date();
              const expiresAt = new Date(poll.expires_at);
              const isExpired = now > expiresAt;

              return {
                ...poll,
                options: pollOptions,
                total_votes: totalVotes,
                user_votes: votesByPoll[poll.poll_id] || [],
                is_expired: isExpired
              };
            });

            setPolls(formattedPolls);
          }
        }
      }
      
    } catch (error) {
      console.error('Error loading homepage data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDirection = currentScrollY > scrollY ? 'down' : 'up';
    
    // Show org section when scrolling up or at the top
    if (scrollDirection === 'up' || currentScrollY < 50) {
      setShowOrgSection(true);
    } else if (scrollDirection === 'down' && currentScrollY > 100) {
      // Hide org section when scrolling down past 100px
      setShowOrgSection(false);
    }
    
    setScrollY(currentScrollY);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Reddit-style Header */}
      <View style={[styles.header, { backgroundColor: cardBackground, borderBottomColor: borderColor, paddingTop: insets.top + 10 }]}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <TouchableOpacity style={styles.menuButton} onPress={handleMenuPress}>
              <IconSymbol name="line.3.horizontal" size={22} color={metaColor} />
            </TouchableOpacity>
            <ThemedText style={[styles.logo, { color: textColor }]}>NexOrg</ThemedText>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <IconSymbol name="magnifyingglass" size={22} color={metaColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNotifications} style={styles.headerButton}>
              <IconSymbol name="bell" size={22} color={metaColor} />
              {/* Remove hardcoded notification count - will be dynamic when notifications are implemented */}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.feedScrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Organizations Stories Section - Inside ScrollView */}
        <View style={[styles.storiesSection, { borderBottomColor: borderColor }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesContainer}>
            {organizations.length > 5 && (
              <TouchableOpacity style={styles.storyItem} onPress={handleViewAllOrganizations}>
                <View style={[styles.viewAllStory, { borderColor }]}>
                  <View style={[styles.storyImageContainer, { borderColor: '#800020' }]}>
                    <View style={[styles.storyPlaceholder, { backgroundColor: '#800020' }]}>
                      <ThemedText style={styles.storyPlaceholderText}>+</ThemedText>
                    </View>
                  </View>
                </View>
                <ThemedText style={[styles.storyLabel, { color: textColor }]}>View All</ThemedText>
              </TouchableOpacity>
            )}
            
            {organizations.slice(0, 5).map((org) => (
              <TouchableOpacity key={org.id} style={styles.storyItem} onPress={() => handleOrganizationPress(org.id, org.name)}>
                <View style={[styles.storyImageContainer, { borderColor: org.color || '#800020' }]}>
                  {org.org_pic ? (
                    <Image
                      source={{ uri: org.org_pic }}
                      style={styles.storyImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.storyPlaceholder, { backgroundColor: org.color || '#800020' }]}>
                      <ThemedText style={styles.storyPlaceholderText}>
                        {org.name.charAt(0)}
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText style={[styles.storyLabel, { color: textColor }]}>{org.name}</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {/* Reddit-style Feed Cards */}
        {(() => {
          // Combine posts, announcements, and polls with type indicators
          const combinedFeed = [
            ...posts.map((post, index) => ({
              ...post,
              type: 'post',
              timestamp: post.created_at,
              key: `post-${post.post_id || post.id || `fallback-${index}`}`,
            })),
            ...announcements.map((announcement) => ({
              ...announcement,
              type: 'announcement',
              timestamp: announcement.createdAt,
              key: `announcement-${announcement.id}`,
            })),
            ...polls.map((poll) => ({
              ...poll,
              type: 'poll',
              timestamp: poll.created_at,
              key: `poll-${poll.poll_id}`,
            }))
          ];

          // Sort by timestamp (newest first)
          combinedFeed.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA; // Newest first
          });

          return combinedFeed.length > 0 ? (
            <View style={styles.feedContainer}>
              {combinedFeed.map((item) => {
                if (item.type === 'post') {
                  return (
                    <PostCard 
                      key={item.key}
                      post={item}
                      onPress={() => handlePostPress(item)}
                      onLikeUpdate={(postId, liked, newCount) => {
                        // Update posts state with new like info
                        setPosts(prev => prev.map(p => 
                          p.post_id === postId ? { ...p, user_has_liked: liked, like_count: newCount, likes: newCount } : p
                        ));
                      }}
                    />
                  );
                } else if (item.type === 'announcement') {
                  return (
                    <AnnouncementCard 
                      key={item.key}
                      announcement={item}
                    />
                  );
                } else if (item.type === 'poll') {
                  return (
                    <PollCard
                      key={item.key}
                      poll={{
                        poll_id: item.poll_id,
                        question: item.question,
                        options: item.options,
                        total_votes: item.total_votes,
                        expires_at: item.expires_at,
                        allow_multiple: item.allow_multiple,
                        visibility: item.visibility,
                        created_at: item.created_at,
                        user_votes: item.user_votes,
                        is_expired: item.is_expired,
                        organizations: item.organizations
                      }}
                      onVote={async (pollId, optionIds) => {
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) {
                            Alert.alert('Error', 'You must be logged in to vote');
                            return;
                          }

                          const { data: existingVotes } = await supabase
                            .from('poll_votes')
                            .select('vote_id, option_id')
                            .eq('poll_id', pollId)
                            .eq('user_id', user.id);

                          const hasExistingVotes = existingVotes && existingVotes.length > 0;

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

                          const votesToInsert = optionIds.map(optionId => ({
                            poll_id: pollId,
                            user_id: user.id,
                            option_id: optionId
                          }));

                          const { error: voteError } = await supabase
                            .from('poll_votes')
                            .insert(votesToInsert);

                          if (voteError) throw new Error('Failed to record vote');

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
                          await loadData();
                        } catch (error) {
                          console.error('Failed to vote on poll:', error);
                          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit vote. Please try again.');
                        }
                      }}
                    />
                  );
                }
                return null;
              })}
            </View>
          ) : (
            <View style={styles.emptyFeed}>
              <IconSymbol name="newspaper" size={48} color={metaColor} />
              <ThemedText style={[styles.emptyFeedTitle, { color: textColor }]}>No posts yet</ThemedText>
              <ThemedText style={[styles.emptyFeedText, { color: metaColor }]}>
                Join some organizations to see their posts and announcements here!
              </ThemedText>
            </View>
          );
        })()}
      </ScrollView>

      {/* Floating Organizations Section - Shows on scroll up */}
      {showOrgSection && scrollY > 100 && (
        <View style={[styles.floatingOrgSection, { backgroundColor: cardBackground, borderBottomColor: borderColor }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesContainer}>
            {organizations.length > 5 && (
              <TouchableOpacity style={styles.storyItem} onPress={handleViewAllOrganizations}>
                <View style={[styles.viewAllStory, { borderColor }]}>
                  <View style={[styles.storyImageContainer, { borderColor: '#800020' }]}>
                    <View style={[styles.storyPlaceholder, { backgroundColor: '#800020' }]}>
                      <ThemedText style={styles.storyPlaceholderText}>+</ThemedText>
                    </View>
                  </View>
                </View>
                <ThemedText style={[styles.storyLabel, { color: textColor }]}>View All</ThemedText>
              </TouchableOpacity>
            )}
            
            {organizations.slice(0, 5).map((org) => (
              <TouchableOpacity key={org.id} style={styles.storyItem} onPress={() => handleOrganizationPress(org.id, org.name)}>
                <View style={[styles.storyImageContainer, { borderColor: org.color || '#800020' }]}>
                  {org.org_pic ? (
                    <Image
                      source={{ uri: org.org_pic }}
                      style={styles.storyImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.storyPlaceholder, { backgroundColor: org.color || '#800020' }]}>
                      <ThemedText style={styles.storyPlaceholderText}>
                        {org.name.charAt(0)}
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText style={[styles.storyLabel, { color: textColor }]}>{org.name}</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

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
        isBookmarked={selectedPost ? bookmarkedPosts.has(selectedPost.id || selectedPost.post_id) : false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Reddit-style Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 1000, // Ensure header stays on top
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#800020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIconText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
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
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#800020',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Stories Section
  storiesSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  storiesContainer: {
    paddingHorizontal: 16,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  viewAllStory: {
    alignItems: 'center',
  },
  storyImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    padding: 2,
    marginBottom: 8,
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  storyPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyPlaceholderText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  storyLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Floating Organizations Section
  floatingOrgSection: {
    position: 'absolute',
    top: 87, // Below the header (header height + padding)
    left: 0,
    right: 0,
    paddingVertical: 16,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100, // Lower than header but above content
  },
  // Feed
  feedScrollView: {
    flex: 1,
  },
  // Reddit-style Cards
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
  postContent: {
    flex: 1,
    paddingRight: 12,
    paddingLeft: 4,
    maxWidth: '100%',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
    flexWrap: 'wrap',
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
  postMeta: {
    fontSize: 12,
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  postText: {
    fontSize: 13,
    lineHeight: 16,
    marginBottom: 4,
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
  // Announcement specific
  announcementIndicator: {
    width: 40,
    alignItems: 'center',
    paddingTop: 8,
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
  // Empty state
  emptyFeed: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyFeedTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyFeedText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  feedContainer: {
    paddingHorizontal: 16,
  },
});
