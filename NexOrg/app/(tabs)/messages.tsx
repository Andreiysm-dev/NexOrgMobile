import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  fetchConversations,
  fetchConversationMessages,
  sendMessage,
  markConversationAsRead,
  searchUsersForMessaging,
  Conversation,
  Message,
} from '@/lib/api';

type ViewMode = 'list' | 'conversation' | 'compose';

export default function MessagesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');

  // Compose mode states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await fetchConversations();
      setConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMessages = async (partnerId: string) => {
    try {
      setLoading(true);
      const data = await fetchConversationMessages(partnerId);
      setMessages(data);
      
      // Mark conversation as read
      await markConversationAsRead(partnerId);
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleConversationPress = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setViewMode('conversation');
    loadMessages(conversation.partner.id);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    try {
      setSending(true);
      await sendMessage({
        recipientId: selectedConversation.partner.id,
        subject: 'Message',
        content: messageText.trim(),
      });

      setMessageText('');
      // Reload messages
      await loadMessages(selectedConversation.partner.id);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleComposePress = () => {
    setViewMode('compose');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedRecipient(null);
    setComposeSubject('');
    setComposeMessage('');
  };

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchUsersForMessaging(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleSelectRecipient = (user: any) => {
    setSelectedRecipient(user);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSendNewMessage = async () => {
    if (!selectedRecipient || !composeMessage.trim()) {
      Alert.alert('Error', 'Please select a recipient and enter a message');
      return;
    }

    try {
      setSending(true);
      await sendMessage({
        recipientId: selectedRecipient.user_id,
        subject: composeSubject || 'Message',
        content: composeMessage.trim(),
      });

      Alert.alert('Success', 'Message sent!');
      setViewMode('list');
      loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    if (viewMode === 'conversation') {
      setViewMode('list');
      setSelectedConversation(null);
      loadConversations();
    } else if (viewMode === 'compose') {
      setViewMode('list');
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conversation => {
    if (!conversationSearchQuery.trim()) return true;
    
    const query = conversationSearchQuery.toLowerCase();
    return (
      conversation.partner.name.toLowerCase().includes(query) ||
      conversation.partner.email.toLowerCase().includes(query) ||
      conversation.lastMessage.content.toLowerCase().includes(query)
    );
  });

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.conversationItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleConversationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        {item.partner.avatar ? (
          <Image source={{ uri: item.partner.avatar }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: '#800020' }]}>
            <ThemedText style={styles.avatarText}>
              {item.partner.name.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
        )}
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <ThemedText style={styles.conversationName} numberOfLines={1}>
            {item.partner.name}
          </ThemedText>
          <ThemedText style={[styles.conversationTime, { color: colors.tabIconDefault }]}>
            {formatTimeAgo(item.lastMessage.created_at)}
          </ThemedText>
        </View>
        <ThemedText
          style={[styles.conversationMessage, { color: colors.tabIconDefault }]}
          numberOfLines={1}
        >
          {item.lastMessage.content}
        </ThemedText>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <ThemedText style={styles.unreadText}>{item.unreadCount}</ThemedText>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === selectedConversation?.partner.id ? false : true;
    
    return (
      <View
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessage : styles.partnerMessage,
        ]}
      >
        <View
          style={[
            styles.messageContent,
            { backgroundColor: isOwnMessage ? '#800020' : colors.card },
          ]}
        >
          <ThemedText
            style={[
              styles.messageText,
              { color: isOwnMessage ? '#fff' : colors.text },
            ]}
          >
            {item.text}
          </ThemedText>
          <ThemedText
            style={[
              styles.messageTime,
              { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.tabIconDefault },
            ]}
          >
            {formatTimeAgo(item.created_at)}
          </ThemedText>
        </View>
      </View>
    );
  };

  if (loading && viewMode === 'list') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Messages</ThemedText>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#800020" />
        </View>
      </ThemedView>
    );
  }

  // Conversation View
  if (viewMode === 'conversation' && selectedConversation) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.conversationHeaderInfo}>
            <ThemedText style={styles.conversationHeaderName}>
              {selectedConversation.partner.name}
            </ThemedText>
            <ThemedText style={[styles.conversationHeaderEmail, { color: colors.tabIconDefault }]}>
              {selectedConversation.partner.email}
            </ThemedText>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          />

          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.tabIconDefault}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={sending || !messageText.trim()}
            >
              <IconSymbol name="paperplane.fill" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ThemedView>
    );
  }

  // Compose View
  if (viewMode === 'compose') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>New Message</ThemedText>
        </View>

        <View style={styles.composeContainer}>
          {!selectedRecipient ? (
            <>
              <TextInput
                style={[styles.searchInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder="Search users..."
                placeholderTextColor={colors.tabIconDefault}
                value={searchQuery}
                onChangeText={handleSearchUsers}
              />
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.user_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.userItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => handleSelectRecipient(item)}
                  >
                    <ThemedText style={styles.userName}>{item.full_name}</ThemedText>
                    <ThemedText style={[styles.userEmail, { color: colors.tabIconDefault }]}>
                      {item.institutional_email}
                    </ThemedText>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.searchResults}
              />
            </>
          ) : (
            <>
              <View style={[styles.selectedRecipient, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ThemedText style={styles.selectedRecipientName}>{selectedRecipient.full_name}</ThemedText>
                <TouchableOpacity onPress={() => setSelectedRecipient(null)}>
                  <IconSymbol name="xmark.circle.fill" size={20} color={colors.tabIconDefault} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.subjectInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder="Subject (optional)"
                placeholderTextColor={colors.tabIconDefault}
                value={composeSubject}
                onChangeText={setComposeSubject}
              />

              <TextInput
                style={[styles.messageInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder="Type your message..."
                placeholderTextColor={colors.tabIconDefault}
                value={composeMessage}
                onChangeText={setComposeMessage}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.sendNewButton, sending && styles.sendButtonDisabled]}
                onPress={handleSendNewMessage}
                disabled={sending}
              >
                <ThemedText style={styles.sendNewButtonText}>
                  {sending ? 'Sending...' : 'Send Message'}
                </ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ThemedView>
    );
  }

  // Conversation List View
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Messages</ThemedText>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => {
              setSearchVisible(!searchVisible);
              if (searchVisible) {
                setConversationSearchQuery('');
              }
            }} 
            style={styles.headerButton}
          >
            <IconSymbol name="magnifyingglass" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleComposePress} style={styles.headerButton}>
            <IconSymbol name="square.and.pencil" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {searchVisible && (
        <View style={styles.searchContainer}>
          <View style={[styles.searchInputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <IconSymbol name="magnifyingglass" size={18} color={colors.tabIconDefault} />
            <TextInput
              style={[styles.searchInputField, { color: colors.text }]}
              placeholder="Search conversations..."
              placeholderTextColor={colors.tabIconDefault}
              value={conversationSearchQuery}
              onChangeText={setConversationSearchQuery}
              autoFocus
            />
            {conversationSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setConversationSearchQuery('')}>
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.tabIconDefault} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.partner.id}
        renderItem={renderConversationItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadConversations();
            }}
            tintColor="#800020"
            colors={['#800020']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="message" size={60} color={colors.tabIconDefault} />
            <ThemedText style={styles.emptyText}>
              {conversationSearchQuery ? 'No conversations found' : 'No messages yet'}
            </ThemedText>
            <ThemedText style={[styles.emptySubtext, { color: colors.tabIconDefault }]}>
              {conversationSearchQuery 
                ? 'Try a different search term'
                : 'Start a conversation by tapping the compose button'
              }
            </ThemedText>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 4,
  },
  composeButton: {
    padding: 4,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchInputField: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    marginLeft: 8,
  },
  conversationMessage: {
    fontSize: 14,
  },
  unreadBadge: {
    backgroundColor: '#800020',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  conversationHeaderInfo: {
    flex: 1,
  },
  conversationHeaderName: {
    fontSize: 18,
    fontWeight: '600',
  },
  conversationHeaderEmail: {
    fontSize: 12,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageBubble: {
    marginVertical: 4,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  partnerMessage: {
    alignItems: 'flex-start',
  },
  messageContent: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#800020',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  composeContainer: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    marginBottom: 16,
  },
  searchResults: {
    paddingBottom: 16,
  },
  userItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
  },
  selectedRecipient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  selectedRecipientName: {
    fontSize: 16,
    fontWeight: '600',
  },
  subjectInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    marginBottom: 16,
  },
  messageInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 150,
    marginBottom: 16,
  },
  sendNewButton: {
    backgroundColor: '#800020',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendNewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
