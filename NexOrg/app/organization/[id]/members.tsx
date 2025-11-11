import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { logMemberJoin, logMemberKick } from '@/lib/auditLog';

const { width } = Dimensions.get('window');

interface Member {
  user_id: string;
  base_role: string;
  joined_at: string;
  profiles: {
    full_name: string;
    institutional_email: string;
    department: string;
    course: string;
  };
}

interface JoinRequest {
  member_request_id: string;
  user_id: string;
  org_id: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requested_at: string;
  reason?: string;
  profiles: {
    full_name: string;
    institutional_email: string;
    department: string;
    course: string;
  };
}

export default function MembersManagement() {
  const { id } = useLocalSearchParams();
  const { user, email } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeMenuMember, setActiveMenuMember] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  
  const MEMBERS_PER_PAGE = 10;

  useEffect(() => {
    if (id) {
      fetchMembersAndRequests();
    }
  }, [id]);

  const fetchMembersAndRequests = async (page = 1) => {
    try {
      setLoading(true);
      
      // Fetch members from database
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
        Alert.alert('Error', 'Failed to load members');
        return;
      }

      // Transform data to match expected format (profiles is array from Supabase)
      const transformedMembers = (membersData || []).map(member => ({
        ...member,
        profiles: Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
      }));

      // Apply filters
      let filteredMembers = transformedMembers;
      
      if (searchQuery) {
        filteredMembers = filteredMembers.filter(member =>
          member.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.profiles?.institutional_email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      if (filterDepartment !== 'all') {
        filteredMembers = filteredMembers.filter(member =>
          member.profiles?.department === filterDepartment
        );
      }
      
      if (filterRole !== 'all') {
        filteredMembers = filteredMembers.filter(member =>
          member.base_role === filterRole
        );
      }

      // Apply pagination
      const startIndex = (page - 1) * MEMBERS_PER_PAGE;
      const endIndex = startIndex + MEMBERS_PER_PAGE;
      const pageMembers = filteredMembers.slice(startIndex, endIndex);
      
      setMembers(pageMembers);
      setTotalMembers(filteredMembers.length);
      setCurrentPage(page);
      
      // Fetch join requests (only on first load)
      if (page === 1) {
        const { data: requestsData, error: requestsError } = await supabase
          .from('organization_member_requests')
          .select(`
            member_request_id,
            user_id,
            org_id,
            status,
            requested_at,
            reason,
            profiles (
              full_name,
              institutional_email,
              department,
              course
            )
          `)
          .eq('org_id', id)
          .eq('status', 'Pending')
          .order('requested_at', { ascending: false });

        if (requestsError) {
          console.error('Error fetching join requests:', requestsError);
        } else {
          // Transform join requests data to match expected format
          const transformedRequests = (requestsData || []).map(request => ({
            ...request,
            profiles: Array.isArray(request.profiles) ? request.profiles[0] : request.profiles
          }));
          setJoinRequests(transformedRequests);
        }
      }
      
    } catch (error) {
      console.error('Failed to fetch members:', error);
      Alert.alert('Error', 'Failed to load member data');
    } finally {
      setLoading(false);
    }
  };

  // Refetch when filters change
  useEffect(() => {
    if (id) {
      fetchMembersAndRequests(1);
    }
  }, [searchQuery, filterDepartment, filterRole]);

  const handleJoinRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingRequest(requestId);
    
    try {
      if (action === 'approve') {
        // Get the request details first
        const request = joinRequests.find(req => req.member_request_id === requestId);
        if (!request) {
          Alert.alert('Error', 'Request not found');
          return;
        }

        // Add member to organization_members table
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({
            user_id: request.user_id,
            org_id: id,
            base_role: 'member',
            joined_at: new Date().toISOString()
          });

        if (memberError) {
          console.error('Error adding member:', memberError);
          Alert.alert('Error', 'Failed to add member to organization');
          return;
        }
      }

      // Update the request status
      const { error: updateError } = await supabase
        .from('organization_member_requests')
        .update({ 
          status: action === 'approve' ? 'Approved' : 'Rejected',
          processed_at: new Date().toISOString()
        })
        .eq('member_request_id', requestId);

      if (updateError) {
        console.error('Error updating request:', updateError);
        Alert.alert('Error', `Failed to ${action} request`);
        return;
      }

      // Create audit log for approved members
      if (action === 'approve' && user?.supabaseUser) {
        const request = joinRequests.find(req => req.member_request_id === requestId);
        if (request) {
          // Get current user's profile for actor name
          const { data: actorProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', user.supabaseUser.id)
            .single();
          
          await logMemberJoin(
            id as string,
            user.supabaseUser.id,
            actorProfile?.full_name || 'Officer',
            request.user_id,
            request.profiles.full_name
          );
        }
      }

      // Refresh the data
      await fetchMembersAndRequests();
      
      Alert.alert('Success', `Join request ${action}d successfully`);
      
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      Alert.alert('Error', `Failed to ${action} request`);
    } finally {
      setProcessingRequest(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembersAndRequests();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'officer':
        return [styles.roleBadge, styles.officerBadge];
      case 'adviser':
        return [styles.roleBadge, styles.adviserBadge];
      case 'member':
        return [styles.roleBadge, styles.memberBadge];
      default:
        return [styles.roleBadge];
    }
  };

  const getRoleBadgeTextStyle = (role: string) => {
    switch (role) {
      case 'officer':
        return [styles.roleBadgeText, styles.officerBadgeText];
      case 'adviser':
        return [styles.roleBadgeText, styles.adviserBadgeText];
      case 'member':
        return [styles.roleBadgeText, styles.memberBadgeText];
      default:
        return [styles.roleBadgeText];
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from the organization? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            setRemovingMember(userId);
            
            try {
              // Remove member from organization_members table
              const { error } = await supabase
                .from('organization_members')
                .delete()
                .eq('user_id', userId)
                .eq('org_id', id);

              if (error) {
                console.error('Error removing member:', error);
                Alert.alert('Error', 'Failed to remove member');
                return;
              }

              // Create audit log for member removal
              if (user?.supabaseUser) {
                const { data: actorProfile } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('user_id', user.supabaseUser.id)
                  .single();
                
                await logMemberKick(
                  id as string,
                  user.supabaseUser.id,
                  actorProfile?.full_name || 'Officer',
                  userId,
                  memberName,
                  'Removed by officer'
                );
              }
              
              // Refetch to get updated data
              await fetchMembersAndRequests();
              
              Alert.alert('Success', `${memberName} has been removed from the organization`);
              
            } catch (error) {
              console.error('Failed to remove member:', error);
              Alert.alert('Error', 'Failed to remove member');
            } finally {
              setRemovingMember(null);
            }
          }
        }
      ]
    );
  };

  // Helper functions for role badges (copied from Red Book)
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

  const pendingRequests = joinRequests.filter(req => req.status === 'Pending');

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      <View style={styles.container}>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <ThemedText style={styles.statNumber}>{members.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Total</ThemedText>
            <IconSymbol name="person.2" size={16} color="#6B7280" />
          </View>
          
          <View style={styles.statCard}>
            <ThemedText style={styles.statNumber}>
              {members.filter(m => m.base_role === 'officer').length}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Officers</ThemedText>
            <IconSymbol name="crown" size={16} color="#6B7280" />
          </View>
          
          <View style={styles.statCard}>
            <ThemedText style={styles.statNumber}>{pendingRequests.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Pending</ThemedText>
            <IconSymbol name="clock" size={16} color="#6B7280" />
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'members' && styles.activeTab]}
            onPress={() => setActiveTab('members')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>
              Current Members
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
            onPress={() => setActiveTab('requests')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
              Join Requests
            </ThemedText>
            {pendingRequests.length > 0 && (
              <View style={styles.tabBadge}>
                <ThemedText style={styles.tabBadgeText}>{pendingRequests.length}</ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search and Filters */}
        <View style={styles.filtersContainer}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <IconSymbol name="magnifyingglass" size={16} color="#6B7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search members..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(!showFilters)}
            >
              <IconSymbol name="line.3.horizontal.decrease" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          {showFilters && (
            <View style={styles.filterRow}>
              <View style={styles.filterGroup}>
                <ThemedText style={styles.filterLabel}>Department:</ThemedText>
                <TouchableOpacity style={styles.filterSelect}>
                  <ThemedText style={styles.filterSelectText}>
                    {filterDepartment === 'all' ? 'All' : filterDepartment}
                  </ThemedText>
                  <IconSymbol name="chevron.down" size={12} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.filterGroup}>
                <ThemedText style={styles.filterLabel}>Role:</ThemedText>
                <TouchableOpacity style={styles.filterSelect}>
                  <ThemedText style={styles.filterSelectText}>
                    {filterRole === 'all' ? 'All' : filterRole}
                  </ThemedText>
                  <IconSymbol name="chevron.down" size={12} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'members' && (
            <View style={styles.tabContent}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ThemedText style={styles.loadingText}>Loading members...</ThemedText>
                </View>
              ) : members.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No members found</ThemedText>
                </View>
              ) : (
                <>
                  {/* Compact Member Table */}
                  <View style={styles.memberTableContainer}>
                    {/* Table Header */}
                    <View style={styles.compactTableHeader}>
                      <ThemedText style={styles.compactTableHeaderText}>Name</ThemedText>
                      <ThemedText style={styles.compactTableHeaderText}>Role</ThemedText>
                      <ThemedText style={styles.compactTableHeaderText}>Actions</ThemedText>
                    </View>
                    
                    {/* Table Rows */}
                    {members.map((member, index) => (
                      <View key={member.user_id} style={styles.compactTableRow}>
                        <View style={styles.tableCell}>
                          <View style={styles.memberCompactAvatar}>
                            <ThemedText style={styles.memberCompactAvatarText}>
                              {member.profiles.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                            </ThemedText>
                          </View>
                          <View style={styles.memberCompactInfo}>
                            <ThemedText style={styles.memberCompactName} numberOfLines={1}>
                              {member.profiles.full_name}
                            </ThemedText>
                            <ThemedText style={styles.memberCompactEmail} numberOfLines={1}>
                              {member.profiles.institutional_email}
                            </ThemedText>
                          </View>
                        </View>
                        
                        <View style={styles.tableCell}>
                          <View style={[styles.compactRoleBadge, getRoleBadgeColor(member.base_role)]}>
                            {member.base_role === 'officer' && (
                              <IconSymbol name="crown" size={10} color="#3730A3" style={{ marginRight: 2 }} />
                            )}
                            <ThemedText style={[styles.compactRoleBadgeText, getRoleBadgeTextColor(member.base_role)]}>
                              {member.base_role}
                            </ThemedText>
                          </View>
                        </View>
                        
                        <View style={styles.tableCell}>
                          <View style={styles.memberTableActions}>
                            <TouchableOpacity
                              style={styles.compactActionButton}
                              onPress={() => {
                                setSelectedMember(member);
                                setShowMemberModal(true);
                              }}
                            >
                              <IconSymbol name="eye" size={14} color="#6B7280" />
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                              style={[styles.compactActionButton, styles.removeButton]}
                              onPress={() => handleRemoveMember(member.user_id, member.profiles.full_name)}
                              disabled={removingMember === member.user_id}
                            >
                              <IconSymbol 
                                name={removingMember === member.user_id ? "clock" : "trash"} 
                                size={14} 
                                color="#DC2626" 
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                  
                  {/* Pagination */}
                  <View style={styles.paginationContainer}>
                    <View style={styles.paginationInfo}>
                      <ThemedText style={styles.paginationText}>
                        Showing {((currentPage - 1) * MEMBERS_PER_PAGE) + 1}-{Math.min(currentPage * MEMBERS_PER_PAGE, totalMembers)} of {totalMembers}
                      </ThemedText>
                    </View>
                    
                    <View style={styles.paginationControls}>
                      <TouchableOpacity
                        style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                        onPress={() => currentPage > 1 && fetchMembersAndRequests(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <IconSymbol name="chevron.left" size={16} color={currentPage === 1 ? "#D1D5DB" : "#800020"} />
                      </TouchableOpacity>
                      
                      <ThemedText style={styles.pageNumber}>{currentPage}</ThemedText>
                      
                      <TouchableOpacity
                        style={[styles.paginationButton, currentPage * MEMBERS_PER_PAGE >= totalMembers && styles.paginationButtonDisabled]}
                        onPress={() => currentPage * MEMBERS_PER_PAGE < totalMembers && fetchMembersAndRequests(currentPage + 1)}
                        disabled={currentPage * MEMBERS_PER_PAGE >= totalMembers}
                      >
                        <IconSymbol name="chevron.right" size={16} color={currentPage * MEMBERS_PER_PAGE >= totalMembers ? "#D1D5DB" : "#800020"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {activeTab === 'requests' && (
            <View style={styles.tabContent}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ThemedText style={styles.loadingText}>Loading requests...</ThemedText>
                </View>
              ) : pendingRequests.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No pending join requests</ThemedText>
                </View>
              ) : (
                <>
                  {/* Join Requests List */}
                  <View style={styles.membersList}>
                    {pendingRequests.map((request, index) => (
                      <TouchableOpacity
                        key={request.member_request_id}
                        style={[styles.requestListItem, index % 2 === 0 && styles.memberListItemEven]}
                        onPress={() => {
                          setSelectedRequest(request);
                          setShowRequestModal(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.memberAvatarSmall}>
                          <ThemedText style={styles.memberAvatarSmallText}>
                            {request.profiles.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </ThemedText>
                        </View>
                        
                        <View style={styles.memberNameInfo}>
                          <ThemedText style={styles.memberListName} numberOfLines={1}>
                            {request.profiles.full_name}
                          </ThemedText>
                          <ThemedText style={styles.memberListEmail} numberOfLines={1}>
                            {request.profiles.institutional_email}
                          </ThemedText>
                          <ThemedText style={styles.requestDate}>
                            Requested {formatDate(request.requested_at)}
                          </ThemedText>
                        </View>
                        
                        <View style={styles.requestActions}>
                          <TouchableOpacity
                            style={styles.approveButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleJoinRequest(request.member_request_id, 'approve');
                            }}
                            disabled={processingRequest === request.member_request_id}
                          >
                            <IconSymbol 
                              name={processingRequest === request.member_request_id ? "clock" : "checkmark.circle"} 
                              size={16} 
                              color="#FFFFFF" 
                            />
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={styles.rejectButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleJoinRequest(request.member_request_id, 'reject');
                            }}
                            disabled={processingRequest === request.member_request_id}
                          >
                            <IconSymbol 
                              name={processingRequest === request.member_request_id ? "clock" : "xmark.circle"} 
                              size={16} 
                              color="#FFFFFF" 
                            />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
          
          <View style={[styles.bottomPadding, { paddingBottom: insets.bottom + 20 }]} />
        </ScrollView>

        {/* Dropdown Menu Modal */}
        <Modal
          visible={!!activeMenuMember}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveMenuMember(null)}
        >
          <TouchableOpacity 
            style={styles.menuModalOverlay}
            onPress={() => setActiveMenuMember(null)}
            activeOpacity={1}
          >
            <View 
              style={[
                styles.menuModalContent,
                {
                  position: 'absolute',
                  top: menuPosition.y,
                  left: Math.max(10, menuPosition.x - 150), // Ensure it doesn't go off-screen
                }
              ]}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  const member = members.find(m => m.user_id === activeMenuMember);
                  if (member) {
                    setActiveMenuMember(null);
                    setSelectedMember(member);
                    setShowMemberModal(true);
                  }
                }}
              >
                <IconSymbol name="eye" size={16} color="#6B7280" />
                <ThemedText style={styles.menuItemText}>View Details</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.menuItem, styles.dangerMenuItem]}
                onPress={() => {
                  const member = members.find(m => m.user_id === activeMenuMember);
                  if (member) {
                    setActiveMenuMember(null);
                    handleRemoveMember(member.user_id, member.profiles.full_name);
                  }
                }}
                disabled={removingMember === activeMenuMember}
              >
                <IconSymbol 
                  name={removingMember === activeMenuMember ? "clock" : "trash"} 
                  size={16} 
                  color="#DC2626" 
                />
                <ThemedText style={styles.dangerMenuItemText}>
                  {removingMember === activeMenuMember ? 'Removing...' : 'Remove Member'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Member Details Modal */}
        <Modal
          visible={showMemberModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMemberModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Member Details</ThemedText>
                <TouchableOpacity 
                  onPress={() => setShowMemberModal(false)}
                  style={styles.closeButton}
                >
                  <IconSymbol name="xmark" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              {selectedMember && (
                <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                  <View style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Personal Information</ThemedText>
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Name:</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedMember.profiles.full_name}</ThemedText>
                    </View>
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Email:</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedMember.profiles.institutional_email}</ThemedText>
                    </View>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Academic Information</ThemedText>
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Department:</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedMember.profiles.department}</ThemedText>
                    </View>
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Course:</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedMember.profiles.course}</ThemedText>
                    </View>
                  </View>
                  
                  <View style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Membership Information</ThemedText>
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Role:</ThemedText>
                      <View style={getRoleBadgeStyle(selectedMember.base_role)}>
                        {selectedMember.base_role === 'officer' && (
                          <IconSymbol name="crown" size={12} color="#3730A3" style={{ marginRight: 4 }} />
                        )}
                        <ThemedText style={getRoleBadgeTextStyle(selectedMember.base_role)}>
                          {selectedMember.base_role}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Joined on:</ThemedText>
                      <ThemedText style={styles.detailValue}>{formatDate(selectedMember.joined_at)}</ThemedText>
                    </View>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  tabBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  membersList: {
    backgroundColor: '#FFFFFF',
  },
  memberListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  memberListItemEven: {
    backgroundColor: '#FAFAFA',
  },
  memberListName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  memberListEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  memberListActions: {
    position: 'relative',
    alignItems: 'center',
  },
  menuButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
    minWidth: 180,
    maxWidth: 250,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
    minWidth: 150,
    zIndex: 2000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#111827',
  },
  dangerMenuItem: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dangerMenuItemText: {
    fontSize: 14,
    color: '#DC2626',
  },
  viewButton: {
    backgroundColor: '#800020',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#800020',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  memberEmail: {
    fontSize: 13,
    color: '#6B7280',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Join Request styles
  requestListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  requestDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  rejectButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  officerBadge: {
    backgroundColor: '#DBEAFE',
  },
  officerBadgeText: {
    color: '#3730A3',
  },
  adviserBadge: {
    backgroundColor: '#FEF3C7',
  },
  adviserBadgeText: {
    color: '#92400E',
  },
  memberBadge: {
    backgroundColor: '#D1FAE5',
  },
  memberBadgeText: {
    color: '#065F46',
  },
  joinDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalMemberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  removeButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  bottomPadding: {
    height: 20,
  },
  loadMoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#6B7280',
  },
  endOfListContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 16,
  },
  endOfListText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  // Search and Filter styles
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    marginLeft: 8,
  },
  filterButton: {
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  filterSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterSelectText: {
    fontSize: 12,
    color: '#111827',
  },
  // Table styles
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  tableBody: {
    backgroundColor: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#FAFAFA',
  },
  // Column styles
  nameColumn: {
    flex: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleColumn: {
    flex: 2,
    alignItems: 'center',
  },
  deptColumn: {
    flex: 3,
  },
  actionsColumn: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  // Table-specific member styles
  memberAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#800020',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  memberAvatarSmallText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  memberNameInfo: {
    flex: 1,
  },
  tableMemberName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  tableMemberEmail: {
    fontSize: 11,
    color: '#6B7280',
  },
  tableDeptText: {
    fontSize: 11,
    color: '#111827',
    fontWeight: '500',
  },
  tableCourseText: {
    fontSize: 10,
    color: '#6B7280',
  },
  tableActionButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  removeActionButton: {
    backgroundColor: '#FEE2E2',
  },
  // Pagination styles
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paginationInfo: {
    flex: 1,
  },
  paginationText: {
    fontSize: 12,
    color: '#6B7280',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paginationButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  pageNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    minWidth: 24,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },

  // Compact table styles (copied from Red Book)
  memberTableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  compactTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  compactTableHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  compactTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#800020',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberCompactAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  memberCompactInfo: {
    alignItems: 'center',
  },
  memberCompactName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 2,
  },
  memberCompactEmail: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  compactRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  compactRoleBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  memberTableActions: {
    flexDirection: 'row',
    gap: 8,
  },
  compactActionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
