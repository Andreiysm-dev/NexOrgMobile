import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, Image, RefreshControl, Alert } from 'react-native';
import { fetchUserOrganizations, fetchUserAnnouncements, fetchAllPosts } from '@/lib/api';
import { useRouter } from 'expo-router';

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
  const router = useRouter();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [showOrgSection, setShowOrgSection] = useState(true);

  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const textColor = Colors[colorScheme ?? 'light'].text;
  const cardBackground = Colors[colorScheme ?? 'light'].card;
  const borderColor = Colors[colorScheme ?? 'light'].border;
  const metaColor = Colors[colorScheme ?? 'light'].tabIconDefault;

  // Navigation functions
  const handleNotifications = () => {
    Alert.alert('Notifications', 'Notifications feature coming soon!');
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
      console.log('Loading home screen data...');

      const [orgsData, announcementsData, postsData] = await Promise.all([
        fetchUserOrganizations(),
        fetchUserAnnouncements(),
        fetchAllPosts()
      ]);

      setOrganizations(orgsData || []);
      setAnnouncements(announcementsData || []);
      setPosts(postsData || []);

      console.log('Home screen data loaded successfully');
    } catch (error) {
      console.error('Error loading home screen data:', error);
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
      <View style={[styles.header, { backgroundColor: cardBackground, borderBottomColor: borderColor }]}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
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
          // Combine posts and announcements with type indicators
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
                  const post = item;
                  const colors = Colors[colorScheme ?? 'light'];
                  return (
                    <View key={post.key} style={[styles.redditStylePost, { backgroundColor: cardBackground, borderBottomColor: borderColor }]}>
                      {/* Post header with org avatar and info */}
                      <View style={styles.redditStylePostHeader}>
                        <TouchableOpacity 
                          style={styles.communityInfo}
                          onPress={() => handleOrganizationPress(post.org_id, post.organizations?.org_name)}
                        >
                          <View style={[styles.redditStyleOrgAvatar, { backgroundColor: '#800020' }]}>
                            {post.organizations?.org_pic ? (
                              <Image 
                                source={{ uri: post.organizations.org_pic }} 
                                style={styles.redditStyleOrgAvatarImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <ThemedText style={styles.redditStyleOrgAvatarText}>
                                {post.organizations?.org_name?.charAt(0) || 'O'}
                              </ThemedText>
                            )}
                          </View>
                          <View style={styles.redditHeaderInfo}>
                            <View style={styles.redditInlineHeader}>
                              <ThemedText style={[styles.redditOrgNameHeader, { color: textColor }]}>
                                {post.organizations?.org_name || 'Organization'}
                              </ThemedText>
                              <ThemedText style={[styles.redditPostTimeInline, { color: metaColor }]}>
                                • {getTimeAgo(post.created_at)}
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
                            {post.comment_count || 0} comments
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
                } else if (item.type === 'announcement') {
                  const announcement = item;
                  const colors = Colors[colorScheme ?? 'light'];
                  return (
                    <View key={announcement.key} style={[styles.redditStylePost, { backgroundColor: cardBackground, borderBottomColor: borderColor }]}>
                      {/* Post header with org avatar and info */}
                      <View style={styles.redditStylePostHeader}>
                        <TouchableOpacity 
                          style={styles.communityInfo}
                          onPress={() => handleOrganizationPress(announcement.orgId, announcement.orgName)}
                        >
                          <View style={[styles.redditStyleOrgAvatar, { backgroundColor: '#800020' }]}>
                            {announcement.orgPic ? (
                              <Image 
                                source={{ uri: announcement.orgPic }} 
                                style={styles.redditStyleOrgAvatarImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <ThemedText style={styles.redditStyleOrgAvatarText}>
                                {announcement.orgName?.charAt(0) || 'O'}
                              </ThemedText>
                            )}
                          </View>
                          <View style={styles.redditHeaderInfo}>
                            <View style={styles.redditInlineHeader}>
                              <ThemedText style={[styles.redditOrgNameHeader, { color: textColor }]}>
                                {announcement.orgName}
                              </ThemedText>
                              <View style={styles.announcementTag}>
                                <ThemedText style={styles.announcementTagText}>ANNOUNCEMENT</ThemedText>
                              </View>
                              <ThemedText style={[styles.redditPostTimeInline, { color: metaColor }]}>
                                • {getTimeAgo(announcement.createdAt)}
                              </ThemedText>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </View>

                      {/* Announcement title */}
                      <ThemedText style={[styles.redditPostTitleMain, { color: textColor }]}>
                        {announcement.title}
                      </ThemedText>

                      {/* Announcement content with 2-line limit */}
                      <ExpandablePostText 
                        content={announcement.subtitle || announcement.content}
                        colors={colors}
                      />

                      {/* Image if available */}
                      {(() => {
                        // Debug: Log full announcement object and available fields
                        console.log('=== HOME PAGE ANNOUNCEMENT DEBUG ===');
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
                          <ThemedText style={[styles.redditStyleActionText, { color: metaColor }]}>
                            Share
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
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
    gap: 8,
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
  // Reddit-style Post Layout (same as organization page)
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
  feedContainer: {
    paddingHorizontal: 16,
  },
});
