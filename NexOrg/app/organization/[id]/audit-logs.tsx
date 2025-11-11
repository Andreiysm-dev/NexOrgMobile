import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const { width } = Dimensions.get('window');

interface AuditLogEntry {
  id: string;
  action: string;
  actionType: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  target?: {
    id: string;
    name: string;
    type: string;
  };
  details?: any;
  timestamp: string;
  ipAddress?: string;
}

export default function AuditLogsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchAuditLogs();
  }, [id]);

  useEffect(() => {
    // Filter logs based on search query
    if (searchQuery.trim() === '') {
      setFilteredLogs(logs);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = logs.filter(log =>
        log.action.toLowerCase().includes(query) ||
        log.user.name.toLowerCase().includes(query) ||
        log.user.email.toLowerCase().includes(query) ||
        log.target?.name.toLowerCase().includes(query)
      );
      setFilteredLogs(filtered);
    }
  }, [searchQuery, logs]);

  const fetchAuditLogs = async (offset = 0) => {
    try {
      if (offset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const limit = 50;

      // Fetch audit logs from Supabase
      const { data: auditLogs, error: logsError, count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('org_id', id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (logsError) {
        throw logsError;
      }

      // Get unique user IDs from logs
      const userIds = [...new Set(auditLogs?.map((log: any) => log.user_id).filter(Boolean))];
      
      // Fetch user profiles
      const { data: users } = await supabase
        .from('profiles')
        .select('user_id, full_name, institutional_email, profile_image')
        .in('user_id', userIds);

      // Create user map
      const userMap = new Map(users?.map((u: any) => [u.user_id, u]) || []);

      // Format logs
      const formattedLogs = auditLogs?.map((log: any) => {
        const user: any = log.user_id ? userMap.get(log.user_id) : null;
        
        return {
          id: log.id,
          action: log.action_description,
          actionType: log.action_type,
          user: user ? {
            id: user.user_id,
            name: user.full_name || 'Unknown User',
            email: user.institutional_email || '',
            avatar: user.profile_image
          } : {
            id: 'system',
            name: 'System',
            email: 'system@nexorg.com',
            avatar: null
          },
          target: log.target_type ? {
            id: log.target_id || '',
            name: log.target_name || '',
            type: log.target_type
          } : undefined,
          details: log.details || {},
          timestamp: log.created_at,
          ipAddress: log.ip_address
        };
      }) || [];
      
      if (offset === 0) {
        setLogs(formattedLogs);
        setFilteredLogs(formattedLogs);
      } else {
        setLogs(prev => [...prev, ...formattedLogs]);
        setFilteredLogs(prev => [...prev, ...formattedLogs]);
      }
      
      setHasMore((offset + limit) < (count || 0));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAuditLogs(0);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchAuditLogs(logs.length);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`;
    } else if (diffInDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`;
    } else if (diffInDays < 7) {
      return `${date.toLocaleDateString('en-US', { weekday: 'long' })} at ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      }) + ` at ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'member_join':
        return 'person.badge.plus';
      case 'member_leave':
      case 'member_kick':
        return 'person.badge.minus';
      case 'member_ban':
        return 'hand.raised';
      case 'role_update':
        return 'person.crop.circle.badge.checkmark';
      case 'settings_change':
        return 'gearshape';
      case 'post_create':
      case 'post_delete':
        return 'doc.text';
      default:
        return 'clock';
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'member_join':
        return '#10B981';
      case 'member_leave':
      case 'member_kick':
        return '#EF4444';
      case 'member_ban':
        return '#DC2626';
      case 'role_update':
        return '#3B82F6';
      case 'settings_change':
        return '#6B7280';
      case 'post_create':
      case 'post_delete':
        return '#A855F7';
      default:
        return '#9CA3AF';
    }
  };

  const toggleExpanded = (logId: string) => {
    setExpandedId(expandedId === logId ? null : logId);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen 
          options={{
            title: 'Audit Logs',
            headerShown: true,
          }} 
        />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#800020" />
            <ThemedText style={styles.loadingText}>Loading audit logs...</ThemedText>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Audit Logs',
          headerShown: true,
        }} 
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.tabIconDefault} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search audit logs..."
            placeholderTextColor={colors.tabIconDefault}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.tabIconDefault} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
            if (isCloseToBottom && hasMore && !loadingMore) {
              loadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {filteredLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol name="clock" size={48} color={colors.tabIconDefault} />
              <ThemedText style={styles.emptyText}>
                {searchQuery ? 'No logs match your search' : 'No audit logs found'}
              </ThemedText>
            </View>
          ) : (
            <>
              {filteredLogs.map((log, index) => (
                <TouchableOpacity
                  key={log.id}
                  style={[
                    styles.logCard,
                    { 
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    }
                  ]}
                  onPress={() => toggleExpanded(log.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.logHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: getActionColor(log.actionType) + '20' }]}>
                      <IconSymbol 
                        name={getActionIcon(log.actionType)} 
                        size={20} 
                        color={getActionColor(log.actionType)} 
                      />
                    </View>
                    
                    <View style={styles.logInfo}>
                      <ThemedText style={styles.logAction} numberOfLines={2}>
                        {log.action}
                      </ThemedText>
                      <View style={styles.logMeta}>
                        <IconSymbol name="clock" size={12} color={colors.tabIconDefault} />
                        <ThemedText style={[styles.logTime, { color: colors.tabIconDefault }]}>
                          {formatTimestamp(log.timestamp)}
                        </ThemedText>
                      </View>
                    </View>

                    <IconSymbol 
                      name={expandedId === log.id ? 'chevron.up' : 'chevron.down'} 
                      size={16} 
                      color={colors.tabIconDefault} 
                    />
                  </View>

                  {expandedId === log.id && (
                    <View style={[styles.logDetails, { borderTopColor: colors.border }]}>
                      {/* User Info */}
                      <View style={styles.detailSection}>
                        <ThemedText style={styles.detailTitle}>User Information</ThemedText>
                        <View style={[styles.detailContent, { backgroundColor: colors.background }]}>
                          <View style={styles.detailRow}>
                            <ThemedText style={[styles.detailLabel, { color: colors.tabIconDefault }]}>
                              Name:
                            </ThemedText>
                            <ThemedText style={styles.detailValue}>{log.user.name}</ThemedText>
                          </View>
                          <View style={styles.detailRow}>
                            <ThemedText style={[styles.detailLabel, { color: colors.tabIconDefault }]}>
                              Email:
                            </ThemedText>
                            <ThemedText style={styles.detailValue}>{log.user.email}</ThemedText>
                          </View>
                          {log.ipAddress && (
                            <View style={styles.detailRow}>
                              <ThemedText style={[styles.detailLabel, { color: colors.tabIconDefault }]}>
                                IP:
                              </ThemedText>
                              <ThemedText style={[styles.detailValue, styles.monoText]}>
                                {log.ipAddress}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Target Info */}
                      {log.target && (
                        <View style={styles.detailSection}>
                          <ThemedText style={styles.detailTitle}>Target Information</ThemedText>
                          <View style={[styles.detailContent, { backgroundColor: colors.background }]}>
                            <View style={styles.detailRow}>
                              <ThemedText style={[styles.detailLabel, { color: colors.tabIconDefault }]}>
                                Name:
                              </ThemedText>
                              <ThemedText style={styles.detailValue}>{log.target.name}</ThemedText>
                            </View>
                            <View style={styles.detailRow}>
                              <ThemedText style={[styles.detailLabel, { color: colors.tabIconDefault }]}>
                                Type:
                              </ThemedText>
                              <ThemedText style={styles.detailValue}>{log.target.type}</ThemedText>
                            </View>
                          </View>
                        </View>
                      )}

                      {/* Details */}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <View style={styles.detailSection}>
                          <ThemedText style={styles.detailTitle}>Additional Details</ThemedText>
                          <View style={[styles.detailContent, { backgroundColor: colors.background }]}>
                            {log.details.reason && (
                              <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: colors.tabIconDefault }]}>
                                  Reason:
                                </ThemedText>
                                <ThemedText style={styles.detailValue}>{log.details.reason}</ThemedText>
                              </View>
                            )}
                            {log.details.before && (
                              <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: colors.tabIconDefault }]}>
                                  Before:
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, styles.monoText]} numberOfLines={3}>
                                  {JSON.stringify(log.details.before)}
                                </ThemedText>
                              </View>
                            )}
                            {log.details.after && (
                              <View style={styles.detailRow}>
                                <ThemedText style={[styles.detailLabel, { color: colors.tabIconDefault }]}>
                                  After:
                                </ThemedText>
                                <ThemedText style={[styles.detailValue, styles.monoText]} numberOfLines={3}>
                                  {JSON.stringify(log.details.after)}
                                </ThemedText>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {loadingMore && (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#800020" />
                  <ThemedText style={[styles.loadingMoreText, { color: colors.tabIconDefault }]}>
                    Loading more...
                  </ThemedText>
                </View>
              )}

              {!hasMore && filteredLogs.length > 0 && (
                <View style={styles.endContainer}>
                  <ThemedText style={[styles.endText, { color: colors.tabIconDefault }]}>
                    No more logs to load
                  </ThemedText>
                </View>
              )}
            </>
          )}

          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  logCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logInfo: {
    flex: 1,
    gap: 4,
  },
  logAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logTime: {
    fontSize: 12,
  },
  logDetails: {
    borderTopWidth: 1,
    padding: 16,
    gap: 16,
  },
  detailSection: {
    gap: 8,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailContent: {
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    minWidth: 60,
  },
  detailValue: {
    fontSize: 12,
    flex: 1,
  },
  monoText: {
    fontFamily: 'monospace',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
  },
  endContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  endText: {
    fontSize: 12,
  },
});
