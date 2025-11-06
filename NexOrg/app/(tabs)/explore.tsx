import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, TextInput, View, TouchableOpacity, RefreshControl, Alert, Text, Image } from 'react-native';
import { fetchAllOrganizations } from '@/lib/api';

interface Organization {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'Accredited' | 'Pending' | 'Active';
  type: 'Academic' | 'Interest' | 'Sports' | 'Cultural';
  color: string;
  org_pic?: string;
  memberCount?: number;
}

export default function OrgDirectoryScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // Use consistent colors with home page
  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const textColor = Colors[colorScheme ?? 'light'].text;
  const cardBackground = Colors[colorScheme ?? 'light'].card;
  const borderColor = Colors[colorScheme ?? 'light'].border;
  const metaColor = Colors[colorScheme ?? 'light'].tabIconDefault;

  // State for real data
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');

  const filterTypes = ['All', 'Academic', 'Interest', 'Sports', 'Cultural'];

  // Load data on component mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      console.log('Loading organizations directory...');

      const orgsData = await fetchAllOrganizations();
      setAllOrganizations(orgsData);

      console.log('Organizations directory loaded successfully');
      console.log('Total organizations:', orgsData.length);

    } catch (error) {
      console.error('Error loading organizations directory:', error);
      Alert.alert('Error', 'Failed to load organizations. Please try again.');
      
      // Keep empty array on error
      setAllOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrganizations();
    setRefreshing(false);
  };

  const filteredOrganizations = allOrganizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         org.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         org.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'All' || org.type === selectedType;
    
    return matchesSearch && matchesType;
  });

  const handleOrganizationPress = (orgId: string, orgName: string) => {
    router.push({
      pathname: '/organization/[id]',
      params: { 
        id: orgId, 
        orgName: orgName || 'Organization'
      }
    });
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Accredited': return '#10B981';
      case 'Pending': return '#F59E0B';
      case 'Active': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Academic': return Colors[colorScheme ?? 'light'].tint;
      case 'Interest': return '#8B5CF6';
      case 'Sports': return '#DC2626';
      case 'Cultural': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      {/* Header matching home page style */}
      <View style={[styles.header, { backgroundColor: cardBackground, borderBottomColor: borderColor }]}>
        <View style={styles.headerContent}>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>Organizations</ThemedText>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <IconSymbol name="bell" size={24} color={metaColor} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search Section */}
        <View style={[styles.searchSection, { backgroundColor: cardBackground }]}>
          <View style={[styles.searchInputContainer, { backgroundColor, borderColor }]}>
            <IconSymbol name="magnifyingglass" size={18} color={metaColor} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search organizations..."
              placeholderTextColor={metaColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol name="xmark.circle.fill" size={18} color={metaColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.filterSection, { backgroundColor: cardBackground, borderBottomColor: borderColor }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {filterTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterTab, 
                  selectedType === type && [styles.activeFilterTab, { borderBottomColor: Colors[colorScheme ?? 'light'].tint }]
                ]}
                onPress={() => setSelectedType(type)}
              >
                <ThemedText style={[
                  styles.filterTabText,
                  { color: metaColor }, 
                  selectedType === type && { color: Colors[colorScheme ?? 'light'].tint, fontWeight: '600' }
                ]}>
                  {type}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Results Count */}
        <View style={[styles.resultsHeader, { backgroundColor: cardBackground }]}>
          <ThemedText style={[styles.resultsCount, { color: metaColor }]}>
            {isLoading ? 'Loading organizations...' : `${filteredOrganizations.length} organizations found`}
          </ThemedText>
        </View>

        {/* Organizations List */}
        <View style={styles.contentContainer}>
          {isLoading ? (
            // Loading state
            <View style={styles.loadingContainer}>
              <ThemedText style={[styles.loadingText, { color: metaColor }]}>Loading organizations from database...</ThemedText>
            </View>
          ) : filteredOrganizations.length > 0 ? (
            // Display organizations
            filteredOrganizations.map((org) => (
              <TouchableOpacity
                key={org.id}
                style={[styles.orgCard, { backgroundColor: cardBackground, borderColor }]}
                onPress={() => handleOrganizationPress(org.id, org.name)}
              >
                {/* Organization Avatar */}
                <View style={[styles.orgAvatar, { backgroundColor: org.color || getTypeColor(org.type) }]}>
                  {org.org_pic ? (
                    <Image 
                      source={{ uri: org.org_pic }} 
                      style={styles.orgAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <ThemedText style={styles.orgInitial}>
                      {org.name.charAt(0).toUpperCase()}
                    </ThemedText>
                  )}
                </View>

                {/* Organization Info */}
                <View style={styles.orgInfo}>
                  <ThemedText style={[styles.orgName, { color: textColor }]} numberOfLines={2}>
                    {org.name}
                  </ThemedText>
                  <ThemedText style={[styles.orgCategory, { color: metaColor }]}>
                    {org.category}
                  </ThemedText>
                  <ThemedText style={[styles.orgDescription, { color: metaColor }]} numberOfLines={3}>
                    {org.description}
                  </ThemedText>

                  {/* Member Count */}
                  {org.memberCount && (
                    <View style={styles.memberInfo}>
                      <IconSymbol name="person.2" size={14} color={metaColor} />
                      <ThemedText style={[styles.memberCount, { color: metaColor }]}>
                        {org.memberCount} members
                      </ThemedText>
                    </View>
                  )}

                  {/* Status and Type Badges */}
                  <View style={styles.badgeContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(org.status) }]}>
                      <ThemedText style={styles.badgeText}>{org.status}</ThemedText>
                    </View>
                    <View style={[styles.typeBadge, { backgroundColor: getTypeColor(org.type) }]}>
                      <ThemedText style={styles.badgeText}>{org.type}</ThemedText>
                    </View>
                  </View>
                </View>

                {/* Arrow Icon for navigation */}
                <View style={styles.arrowContainer}>
                  <IconSymbol name="chevron.right" size={16} color={metaColor} />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            // Empty state when no organizations found
            <View style={styles.emptyState}>
              <IconSymbol name="building.2" size={48} color={metaColor} />
              <ThemedText style={[styles.emptyTitle, { color: textColor }]}>No organizations found</ThemedText>
              <ThemedText style={[styles.emptyDescription, { color: metaColor }]}>
                Try adjusting your search terms or filters
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  notificationButton: {
    padding: 8,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterSection: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 0,
  },
  filterTab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeFilterTab: {
    borderBottomWidth: 2,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resultsCount: {
    fontSize: 14,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  orgAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  orgAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  orgInitial: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  orgInfo: {
    flex: 1,
    gap: 4,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  orgCategory: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orgDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 4,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  memberCount: {
    fontSize: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  arrowContainer: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
