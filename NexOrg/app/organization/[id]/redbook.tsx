import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { fetchOrganizationById, fetchOrganizationMembers } from '@/lib/api';

// Helper functions for role badges
const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'officer':
      return { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' };
    case 'adviser':
      return { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' };
    default:
      return { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' };
  }
};

const getRoleBadgeTextColor = (role: string) => {
  switch (role) {
    case 'officer':
      return { color: '#3730A3' };
    case 'adviser':
      return { color: '#15803D' };
    default:
      return { color: '#6B7280' };
  }
};

export default function RedBookScreen() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();

  const [organization, setOrganization] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  const MEMBERS_PER_PAGE = 10;

  const loadRedBookData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);

      // Load organization data
      const orgData = await fetchOrganizationById(id as string);
      
      // Load members data directly from Supabase (same as members page)
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          base_role,
          joined_at,
          profiles!inner (
            full_name,
            institutional_email,
            department,
            course
          )
        `)
        .eq('org_id', id)
        .order('joined_at', { ascending: false });

      if (membersError) {
        console.error('Error fetching members:', membersError);
      }

      // Transform data to match expected format (profiles is array from Supabase)
      const transformedMembers = (membersData || []).map(member => ({
        ...member,
        profiles: Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
      }));
      
      if (!orgData) {
        Alert.alert('Error', 'Failed to load organization data.');
        return;
      }

      setOrganization(orgData);
      setMembers(transformedMembers || []);
      
      // Debug: Log the member data structure
      console.log('Members data:', JSON.stringify(transformedMembers, null, 2));

    } catch (error) {
      console.error('Error loading Red Book data:', error);
      Alert.alert('Error', 'Failed to load Red Book data.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRedBookData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadRedBookData();
  }, [id]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ThemedText style={styles.loadingText}>Loading Red Book...</ThemedText>
      </View>
    );
  }

  if (!organization) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ThemedText style={styles.loadingText}>Organization not found</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {/* Red Book Sections */}
          <View style={styles.redbookSections}>
            
            {/* Organization Information */}
            <View style={styles.redbookSection}>
              <View style={styles.redbookSectionHeader}>
                <IconSymbol name="building.2" size={20} color="#800020" />
                <ThemedText style={styles.redbookSectionTitle}>Organization Information</ThemedText>
              </View>
              <View style={styles.redbookSectionContent}>
                <View style={styles.redbookInfoRow}>
                  <ThemedText style={styles.redbookLabel}>Full Name:</ThemedText>
                  <ThemedText style={styles.redbookValue}>{organization.name}</ThemedText>
                </View>
                <View style={styles.redbookInfoRow}>
                  <ThemedText style={styles.redbookLabel}>Status:</ThemedText>
                  <ThemedText style={styles.redbookValue}>{organization.status}</ThemedText>
                </View>
                <View style={styles.redbookInfoRow}>
                  <ThemedText style={styles.redbookLabel}>Department:</ThemedText>
                  <ThemedText style={styles.redbookValue}>{organization.department || organization.category}</ThemedText>
                </View>
                <View style={styles.redbookInfoRow}>
                  <ThemedText style={styles.redbookLabel}>Description:</ThemedText>
                  <ThemedText style={styles.redbookValue}>{organization.description}</ThemedText>
                </View>
              </View>
            </View>

            {/* Officers Section */}
            <View style={styles.redbookSection}>
              <View style={styles.redbookSectionHeader}>
                <IconSymbol name="crown" size={20} color="#800020" />
                <ThemedText style={styles.redbookSectionTitle}>Officers</ThemedText>
              </View>
              <View style={styles.redbookSectionContent}>
                {organization.officers && organization.officers.length > 0 ? (
                  organization.officers.map((officer: any, index: number) => (
                    <View key={index} style={styles.redbookMemberCard}>
                      <View style={styles.redbookMemberAvatar}>
                        <ThemedText style={styles.redbookMemberAvatarText}>
                          {officer.full_name?.charAt(0) || 'O'}
                        </ThemedText>
                      </View>
                      <View style={styles.redbookMemberInfo}>
                        <ThemedText style={styles.redbookMemberName}>{officer.full_name}</ThemedText>
                        <ThemedText style={styles.redbookMemberPosition}>{officer.position || 'Officer'}</ThemedText>
                        <ThemedText style={styles.redbookMemberEmail}>{officer.email}</ThemedText>
                      </View>
                    </View>
                  ))
                ) : (
                  <ThemedText style={styles.emptyStateText}>No officers listed</ThemedText>
                )}
              </View>
            </View>

            {/* Advisers Section */}
            <View style={styles.redbookSection}>
              <View style={styles.redbookSectionHeader}>
                <IconSymbol name="person.badge.shield.checkmark" size={20} color="#800020" />
                <ThemedText style={styles.redbookSectionTitle}>Advisers</ThemedText>
              </View>
              <View style={styles.redbookSectionContent}>
                {organization.advisers && organization.advisers.length > 0 ? (
                  organization.advisers.map((adviser: any, index: number) => (
                    <View key={index} style={styles.redbookMemberCard}>
                      <View style={styles.redbookMemberAvatar}>
                        <ThemedText style={styles.redbookMemberAvatarText}>
                          {adviser.full_name?.charAt(0) || 'A'}
                        </ThemedText>
                      </View>
                      <View style={styles.redbookMemberInfo}>
                        <ThemedText style={styles.redbookMemberName}>{adviser.full_name}</ThemedText>
                        <ThemedText style={styles.redbookMemberPosition}>Adviser</ThemedText>
                        <ThemedText style={styles.redbookMemberEmail}>{adviser.email}</ThemedText>
                      </View>
                    </View>
                  ))
                ) : (
                  <ThemedText style={styles.emptyStateText}>No advisers listed</ThemedText>
                )}
              </View>
            </View>

            {/* Members Section */}
            <View style={styles.redbookSection}>
              <View style={styles.redbookSectionHeader}>
                <IconSymbol name="person.2" size={20} color="#800020" />
                <ThemedText style={styles.redbookSectionTitle}>Members ({members.length})</ThemedText>
              </View>
              <View style={styles.redbookSectionContent}>
                {members.length > 0 ? (
                  <>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                      <ThemedText style={styles.tableHeaderText}>Name</ThemedText>
                      <ThemedText style={styles.tableHeaderText}>Role</ThemedText>
                      <ThemedText style={styles.tableHeaderText}>Email</ThemedText>
                    </View>
                    
                    {/* Table Rows */}
                    {members
                      .slice((currentPage - 1) * MEMBERS_PER_PAGE, currentPage * MEMBERS_PER_PAGE)
                      .map((member: any, index: number) => {
                        // Access nested profile data correctly
                        const memberName = member.profiles?.full_name || member.full_name || 'Unknown Member';
                        const memberEmail = member.profiles?.institutional_email || member.institutional_email || 'No email';
                        const memberRole = member.base_role || 'member';
                        
                        return (
                          <View key={member.user_id || index} style={styles.tableRow}>
                            <View style={styles.tableCell}>
                              <View style={styles.memberCompactAvatar}>
                                <ThemedText style={styles.memberCompactAvatarText}>
                                  {memberName !== 'Unknown Member' ? 
                                    memberName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() 
                                    : 'M'}
                                </ThemedText>
                              </View>
                              <ThemedText style={styles.memberCompactName} numberOfLines={1}>
                                {memberName}
                              </ThemedText>
                            </View>
                            
                            <View style={styles.tableCell}>
                              <View style={[styles.compactRoleBadge, getRoleBadgeColor(memberRole)]}>
                                <ThemedText style={[styles.compactRoleBadgeText, getRoleBadgeTextColor(memberRole)]}>
                                  {memberRole}
                                </ThemedText>
                              </View>
                            </View>
                            
                            <View style={styles.tableCell}>
                              <ThemedText style={styles.memberCompactEmail} numberOfLines={1}>
                                {memberEmail}
                              </ThemedText>
                            </View>
                          </View>
                        );
                      })}
                    
                    {/* Pagination */}
                    {members.length > MEMBERS_PER_PAGE && (
                      <View style={styles.pagination}>
                        <TouchableOpacity
                          style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                          onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <IconSymbol name="chevron.left" size={16} color={currentPage === 1 ? '#9CA3AF' : '#6B7280'} />
                        </TouchableOpacity>
                        
                        <ThemedText style={styles.paginationText}>
                          Page {currentPage} of {Math.ceil(members.length / MEMBERS_PER_PAGE)}
                        </ThemedText>
                        
                        <TouchableOpacity
                          style={[styles.paginationButton, currentPage === Math.ceil(members.length / MEMBERS_PER_PAGE) && styles.paginationButtonDisabled]}
                          onPress={() => setCurrentPage(prev => Math.min(Math.ceil(members.length / MEMBERS_PER_PAGE), prev + 1))}
                          disabled={currentPage === Math.ceil(members.length / MEMBERS_PER_PAGE)}
                        >
                          <IconSymbol name="chevron.right" size={16} color={currentPage === Math.ceil(members.length / MEMBERS_PER_PAGE) ? '#9CA3AF' : '#6B7280'} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : (
                  <ThemedText style={styles.emptyStateText}>No members listed</ThemedText>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  redbookSections: {
    gap: 20,
  },
  redbookSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  redbookSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  redbookSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#800020',
  },
  redbookSectionContent: {
    gap: 12,
  },
  redbookInfoRow: {
    marginBottom: 12,
  },
  redbookLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  redbookValue: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 22,
  },
  redbookMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  redbookMemberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#800020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  redbookMemberAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  redbookMemberInfo: {
    flex: 1,
  },
  redbookMemberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  redbookMemberPosition: {
    fontSize: 14,
    color: '#800020',
    fontWeight: '500',
    marginBottom: 2,
  },
  redbookMemberEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  redbookMemberDepartment: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },

  // Member table styles
  memberTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    padding: 12,
  },
  memberTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberTableAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#800020',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberTableAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  memberTableInfo: {
    flex: 1,
  },
  memberTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  memberTableName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  memberTableEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  memberTableCourse: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Compact table styles
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCompactAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#800020',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberCompactAvatarText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  memberCompactName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
  },
  compactRoleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  compactRoleBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  memberCompactEmail: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  
  // Pagination styles
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 16,
  },
  paginationButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  paginationButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  paginationText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});
