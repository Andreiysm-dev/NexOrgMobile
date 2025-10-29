// This file contains the corrected LEADERSHIP and MEMBERS sections for the organization index.tsx
// Copy the sections below to replace the corresponding sections in your organization/[id]/index.tsx

// LEADERSHIP SECTION (replace lines ~589-661)
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

// MEMBERS SECTION (replace lines ~686-750)
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
                {item.course || 'N/A'}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      {/* Pagination remains the same */}
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

// ADD THESE STYLES TO THE STYLESHEET AT THE END:

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
