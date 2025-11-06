import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, Modal, Pressable, Image } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';

interface PollOption {
  option_id: string;
  option_text: string;
  vote_count: number;
}

interface Poll {
  poll_id: string;
  question: string;
  options: PollOption[];
  total_votes: number;
  expires_at: string;
  allow_multiple: boolean;
  visibility?: string;
  created_at: string;
  user_votes?: string[];
  is_expired?: boolean;
  organizations?: {
    org_name: string;
    org_pic: string | null;
  };
}

interface PollCardProps {
  poll: Poll;
  onVote?: (pollId: string, optionIds: string[]) => void;
  showActions?: boolean;
  onViewVoters?: (poll: Poll) => void;
  onEdit?: (poll: Poll) => void;
  onDelete?: (poll: Poll) => void;
}

export function PollCard({ poll, onVote, showActions, onViewVoters, onEdit, onDelete }: PollCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  
  const hasVoted = poll.user_votes && poll.user_votes.length > 0;
  const [selectedOptions, setSelectedOptions] = useState<string[]>(poll.user_votes || []);
  const [isVoting, setIsVoting] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showResults, setShowResults] = useState(hasVoted || poll.is_expired);

  // Update showResults when poll changes
  useEffect(() => {
    const shouldShowResults = (poll.user_votes && poll.user_votes.length > 0) || poll.is_expired;
    setShowResults(shouldShowResults);
  }, [poll.user_votes, poll.is_expired]);

  const timeRemaining = () => {
    const now = new Date();
    const expires = new Date(poll.expires_at);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Ended";
    
    const totalMinutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    if (minutes > 0) return `${minutes}m left`;
    return "Less than 1m";
  };

  const handleOptionClick = (optionId: string) => {
    if (poll.is_expired) return;

    if (poll.allow_multiple) {
      setSelectedOptions(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };

  const handleVote = async () => {
    if (selectedOptions.length === 0) {
      Alert.alert('Error', 'Please select at least one option');
      return;
    }

    setIsVoting(true);
    try {
      if (onVote) {
        await onVote(poll.poll_id, selectedOptions);
        setShowResults(true);
      }
    } finally {
      setIsVoting(false);
    }
  };

  const getPercentage = (voteCount: number) => {
    if (poll.total_votes === 0) return 0;
    return Math.round((voteCount / poll.total_votes) * 100);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.orgInfo}>
          {poll.organizations?.org_pic ? (
            <Image
              source={{ uri: poll.organizations.org_pic }}
              style={styles.orgAvatar}
            />
          ) : (
            <View style={[styles.orgAvatar, { backgroundColor: '#FEE2E2' }]}>
              <ThemedText style={styles.orgAvatarText}>
                {poll.organizations?.org_name?.charAt(0).toUpperCase() || 'O'}
              </ThemedText>
            </View>
          )}
          <View>
            <ThemedText style={[styles.orgName, { color: colors.text }]}>
              {poll.organizations?.org_name || 'Organization'}
            </ThemedText>
            <ThemedText style={[styles.timestamp, { color: colors.tabIconDefault }]}>
              {new Date(poll.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </ThemedText>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.badge, poll.is_expired ? styles.badgeEnded : styles.badgeActive]}>
            <IconSymbol 
              name={poll.is_expired ? "checkmark.circle" : "clock"} 
              size={12} 
              color="white" 
            />
            <ThemedText style={styles.badgeText}>
              {poll.is_expired ? 'Ended' : timeRemaining()}
            </ThemedText>
          </View>
          {showActions && (
            <TouchableOpacity
              style={styles.actionsButton}
              onPress={() => setShowActionsModal(true)}
              activeOpacity={0.7}
            >
              <IconSymbol name="ellipsis" size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Question */}
      <View style={styles.questionContainer}>
        <IconSymbol name="chart.bar" size={20} color="#800020" />
        <ThemedText style={[styles.question, { color: colors.text }]}>
          {poll.question}
        </ThemedText>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {poll.options.map((option) => {
          const percentage = getPercentage(option.vote_count);
          const isSelected = selectedOptions.includes(option.option_id);
          const isUserVote = poll.user_votes?.includes(option.option_id);

          return (
            <View key={option.option_id} style={styles.optionWrapper}>
              {showResults ? (
                // Results view
                <View style={styles.resultContainer}>
                  <View style={styles.resultHeader}>
                    <View style={styles.resultTextContainer}>
                      <ThemedText style={[
                        styles.optionText,
                        { color: colors.text },
                        isUserVote && styles.optionTextBold
                      ]}>
                        {option.option_text}
                      </ThemedText>
                      {isUserVote && (
                        <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
                      )}
                    </View>
                    <ThemedText style={[styles.percentage, { color: colors.tabIconDefault }]}>
                      {percentage}% ({option.vote_count})
                    </ThemedText>
                  </View>
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View 
                      style={[
                        styles.progressFill,
                        { width: `${percentage}%`, backgroundColor: isUserVote ? '#800020' : '#9CA3AF' }
                      ]} 
                    />
                  </View>
                </View>
              ) : poll.is_expired ? (
                // Results view for expired polls (not clickable)
                <View style={styles.resultContainer}>
                  <View style={styles.resultHeader}>
                    <View style={styles.resultTextContainer}>
                      <ThemedText style={[
                        styles.optionText,
                        { color: colors.text },
                        isUserVote && styles.optionTextBold
                      ]}>
                        {option.option_text}
                      </ThemedText>
                      {isUserVote && (
                        <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
                      )}
                    </View>
                    <ThemedText style={[styles.percentage, { color: colors.tabIconDefault }]}>
                      {percentage}% ({option.vote_count})
                    </ThemedText>
                  </View>
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View 
                      style={[
                        styles.progressFill,
                        { width: `${percentage}%`, backgroundColor: isUserVote ? '#800020' : '#9CA3AF' }
                      ]} 
                    />
                  </View>
                </View>
              ) : (
                // Voting view
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    { borderColor: colors.border },
                    isSelected && styles.optionButtonSelected
                  ]}
                  onPress={() => handleOptionClick(option.option_id)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.radioCircle,
                    { borderColor: isSelected ? 'white' : colors.tabIconDefault }
                  ]}>
                    {isSelected && <View style={styles.radioFill} />}
                  </View>
                  <ThemedText style={[
                    styles.optionButtonText,
                    { color: isSelected ? 'white' : colors.text }
                  ]}>
                    {option.option_text}
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Vote/Update Vote button */}
      {!poll.is_expired && !showResults && (
        <TouchableOpacity
          style={[
            styles.voteButton,
            (isVoting || selectedOptions.length === 0) && styles.voteButtonDisabled
          ]}
          onPress={handleVote}
          disabled={isVoting || selectedOptions.length === 0}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.voteButtonText}>
            {isVoting ? 'Submitting...' : hasVoted ? 'Update Vote' : 'Submit Vote'}
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.footerLeft}>
          <ThemedText style={[styles.footerText, { color: colors.tabIconDefault }]}>
            {poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}
          </ThemedText>
          {poll.allow_multiple && (
            <ThemedText style={styles.multipleChoice}>Multiple choice</ThemedText>
          )}
        </View>
        
        {/* Edit Vote button in footer when showing results */}
        {!poll.is_expired && hasVoted && showResults && (
          <TouchableOpacity
            style={styles.editVoteFooterButton}
            onPress={() => setShowResults(false)}
            activeOpacity={0.7}
          >
            <IconSymbol name="pencil" size={14} color="#3B82F6" />
            <ThemedText style={[styles.editVoteFooterText, { color: '#3B82F6' }]}>Edit Vote</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Actions Modal */}
      <Modal
        visible={showActionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowActionsModal(false)}
        >
          <View style={[styles.actionsModal, { backgroundColor: colors.card }]}>
            {onViewVoters && poll.total_votes > 0 && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setShowActionsModal(false);
                  onViewVoters(poll);
                }}
                activeOpacity={0.7}
              >
                <IconSymbol name="person.2.fill" size={20} color="#3B82F6" />
                <ThemedText style={[styles.actionButtonText, { color: colors.text }]}>
                  View Voters
                </ThemedText>
              </TouchableOpacity>
            )}
            
            {onEdit && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setShowActionsModal(false);
                  onEdit(poll);
                }}
                activeOpacity={0.7}
              >
                <IconSymbol name="pencil" size={20} color="#F59E0B" />
                <ThemedText style={[styles.actionButtonText, { color: colors.text }]}>
                  Edit Poll
                </ThemedText>
              </TouchableOpacity>
            )}
            
            {onDelete && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setShowActionsModal(false);
                  onDelete(poll);
                }}
                activeOpacity={0.7}
              >
                <IconSymbol name="trash" size={20} color="#EF4444" />
                <ThemedText style={[styles.actionButtonText, { color: colors.text }]}>
                  Delete Poll
                </ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setShowActionsModal(false)}
              activeOpacity={0.7}
            >
              <IconSymbol name="xmark.circle.fill" size={20} color="#6B7280" />
              <ThemedText style={[styles.actionButtonText, { color: colors.tabIconDefault }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  orgInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#991B1B',
  },
  orgName: {
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeActive: {
    backgroundColor: '#800020',
  },
  badgeEnded: {
    backgroundColor: '#6B7280',
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  optionWrapper: {
    marginBottom: 8,
  },
  resultContainer: {
    gap: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  optionText: {
    fontSize: 14,
  },
  optionTextBold: {
    fontWeight: '600',
  },
  percentage: {
    fontSize: 13,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionButtonSelected: {
    backgroundColor: '#800020',
    borderColor: '#800020',
  },
  optionButtonText: {
    fontSize: 14,
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'white',
  },
  voteButton: {
    backgroundColor: '#800020',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  voteButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  editVoteButton: {
    backgroundColor: '#3B82F6',
  },
  voteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    marginTop: 8,
    borderTopWidth: 1,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    fontSize: 12,
  },
  multipleChoice: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  editVoteFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  editVoteFooterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionsButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionsModal: {
    borderRadius: 16,
    padding: 8,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});
