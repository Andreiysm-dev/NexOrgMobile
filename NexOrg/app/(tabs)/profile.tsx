import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router } from 'expo-router';
import { fetchPublicProfile, PublicProfile } from '@/lib/api_profile';

const { width: screenWidth } = Dimensions.get('window');

export default function ProfileScreen() {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPublicProfile('me');
      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#800020" />
          <ThemedText style={styles.loadingText}>Loading profile...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error || !profile) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle" size={60} color={colors.tabIconDefault} />
          <ThemedText style={styles.errorText}>{error || 'Profile not found'}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#800020"
            colors={['#800020']}
          />
        }
      >
        {/* Cover Photo */}
        <View style={styles.coverPhotoContainer}>
          {profile.cover_photo ? (
            <Image source={{ uri: profile.cover_photo }} style={styles.coverPhoto} />
          ) : profile.profile_image ? (
            <Image source={{ uri: profile.profile_image }} style={styles.coverPhoto} />
          ) : (
            <View style={[styles.coverPhoto, styles.coverPhotoGradient]} />
          )}
        </View>

        {/* Profile Picture & Info */}
        <View style={[styles.profileSection, { backgroundColor: colors.card }]}>
          <View style={styles.profilePictureContainer}>
            {profile.profile_image ? (
              <Image source={{ uri: profile.profile_image }} style={styles.profilePicture} />
            ) : (
              <View style={[styles.profilePicture, styles.profilePicturePlaceholder]}>
                <ThemedText style={styles.profileInitials}>{getInitials(profile.full_name)}</ThemedText>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.profileName}>{profile.full_name}</ThemedText>
              {profile.is_verified && profile.role === 'student' && (
                <View style={styles.verifiedBadge}>
                  <IconSymbol name="checkmark.shield.fill" size={16} color="#fff" />
                  <ThemedText style={styles.verifiedText}>Verified</ThemedText>
                </View>
              )}
            </View>

            <View style={styles.roleBadge}>
              <ThemedText style={styles.roleText}>
                {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
              </ThemedText>
            </View>

            {profile.institutional_email && (
              <ThemedText style={[styles.profileEmail, { color: colors.tabIconDefault }]}>
                {profile.institutional_email}
              </ThemedText>
            )}

            {profile.role === 'student' && (
              <View style={styles.studentInfo}>
                {profile.id_number && (
                  <View style={styles.studentInfoItem}>
                    <IconSymbol name="graduationcap.fill" size={14} color={colors.tabIconDefault} />
                    <ThemedText style={[styles.studentInfoText, { color: colors.tabIconDefault }]}>
                      {profile.id_number}
                    </ThemedText>
                  </View>
                )}
                {profile.course && (
                  <ThemedText style={[styles.studentInfoText, { color: colors.tabIconDefault }]}>
                    {profile.course}
                  </ThemedText>
                )}
                {profile.year && (
                  <ThemedText style={[styles.studentInfoText, { color: colors.tabIconDefault }]}>
                    Year {profile.year}
                  </ThemedText>
                )}
                {profile.department && (
                  <ThemedText style={[styles.studentInfoText, { color: colors.tabIconDefault }]}>
                    {profile.department}
                  </ThemedText>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Organizations */}
        {profile.organizations.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <IconSymbol name="building.2.fill" size={20} color="#800020" />
              <ThemedText style={styles.sectionTitle}>Organizations</ThemedText>
            </View>
            <ThemedText style={[styles.sectionSubtitle, { color: colors.tabIconDefault }]}>
              Organizations {profile.full_name.split(' ')[0]} is part of
            </ThemedText>

            <View style={styles.organizationsGrid}>
              {profile.organizations.map((org) => (
                <TouchableOpacity
                  key={org.org_id}
                  style={[styles.organizationCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => router.push(`/organization/${org.org_id}`)}
                  activeOpacity={0.7}
                >
                  {org.org_pic ? (
                    <Image source={{ uri: org.org_pic }} style={styles.orgAvatar} />
                  ) : (
                    <View style={[styles.orgAvatar, styles.orgAvatarPlaceholder]}>
                      <IconSymbol name="building.2.fill" size={24} color="#800020" />
                    </View>
                  )}
                  <View style={styles.orgInfo}>
                    <ThemedText style={styles.orgName} numberOfLines={1}>
                      {org.org_full_name}
                    </ThemedText>
                    <ThemedText style={[styles.orgShortName, { color: colors.tabIconDefault }]} numberOfLines={1}>
                      {org.org_name}
                    </ThemedText>
                    <View style={styles.orgRoleBadge}>
                      <ThemedText style={styles.orgRoleText}>{org.role}</ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {profile.organizations.length === 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.emptyState}>
              <IconSymbol name="building.2" size={48} color={colors.tabIconDefault} />
              <ThemedText style={[styles.emptyStateText, { color: colors.tabIconDefault }]}>
                No organizations yet
              </ThemedText>
            </View>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </ThemedView>
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
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#800020',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  coverPhotoContainer: {
    height: 200,
    width: '100%',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
  },
  coverPhotoGradient: {
    backgroundColor: '#800020',
  },
  profileSection: {
    padding: 16,
    marginTop: -50,
  },
  profilePictureContainer: {
    marginBottom: 16,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
  },
  profilePicturePlaceholder: {
    backgroundColor: '#800020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
  },
  profileInfo: {
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#800020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(128, 0, 32, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    color: '#800020',
    fontSize: 13,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 14,
  },
  studentInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  studentInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  studentInfoText: {
    fontSize: 13,
  },
  section: {
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  organizationsGrid: {
    gap: 12,
  },
  organizationCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  orgAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  orgAvatarPlaceholder: {
    backgroundColor: 'rgba(128, 0, 32, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgInfo: {
    flex: 1,
    gap: 4,
  },
  orgName: {
    fontSize: 15,
    fontWeight: '600',
  },
  orgShortName: {
    fontSize: 13,
  },
  orgRoleBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(128, 0, 32, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  orgRoleText: {
    fontSize: 11,
    color: '#800020',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    marginTop: 12,
  },
  bottomPadding: {
    height: 32,
  },
});
