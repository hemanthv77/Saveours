import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import firestore from '@react-native-firebase/firestore';
import { sendNotificationToUser, NotificationTemplates } from '../services/notificationSender';

// ============================================================
// CONSTANTS
// ============================================================
const COLORS = {
  primary: '#FF6B4A',
  primaryLight: '#FFF0ED',
  background: '#F5F5F5',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  border: '#E0E0E0',
  error: '#FF3B30',
  success: '#34C759',
  messageSent: '#FF6B4A',
  messageReceived: '#F0F0F0',
  info: '#007AFF',
  infoLight: '#E3F2FD',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const formatMessageTime = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' 
    ? new Date(timestamp) 
    : timestamp.toDate?.() || new Date(timestamp);
  
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDateSeparator = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' 
    ? new Date(timestamp) 
    : timestamp.toDate?.() || new Date(timestamp);
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  }
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const shouldShowDateSeparator = (currentMsg, prevMsg) => {
  if (!prevMsg) return true;
  
  const currentDate = currentMsg.timestamp?.toDate?.() || new Date(currentMsg.timestamp);
  const prevDate = prevMsg.timestamp?.toDate?.() || new Date(prevMsg.timestamp);
  
  return currentDate.toDateString() !== prevDate.toDateString();
};

const shouldGroupWithPrevious = (currentMsg, prevMsg) => {
  if (!prevMsg) return false;
  if (currentMsg.senderId !== prevMsg.senderId) return false;
  
  const currentTime = currentMsg.timestamp?.toDate?.() || new Date(currentMsg.timestamp);
  const prevTime = prevMsg.timestamp?.toDate?.() || new Date(prevMsg.timestamp);
  
  // Group if within 2 minutes
  return (currentTime - prevTime) < 2 * 60 * 1000;
};

// ============================================================
// DATE SEPARATOR COMPONENT
// ============================================================
const DateSeparator = memo(({ date }) => (
  <View style={styles.dateSeparator}>
    <View style={styles.dateSeparatorLine} />
    <Text style={styles.dateSeparatorText}>{date}</Text>
    <View style={styles.dateSeparatorLine} />
  </View>
));

// ============================================================
// MESSAGE BUBBLE COMPONENT
// ============================================================
const MessageBubble = memo(({ message, isSent, isGrouped, showAvatar, partnerName }) => {
  return (
    <View style={[
      styles.messageRow,
      isSent ? styles.messageRowSent : styles.messageRowReceived,
      isGrouped && styles.messageRowGrouped,
    ]}>
      {/* Avatar for received messages */}
      {!isSent && (
        <View style={styles.avatarContainer}>
          {showAvatar ? (
            <View style={styles.messageAvatar}>
              <Text style={styles.messageAvatarText}>{getInitials(partnerName)}</Text>
            </View>
          ) : (
            <View style={styles.avatarSpacer} />
          )}
        </View>
      )}
      
      {/* Message bubble */}
      <View style={[
        styles.messageBubble,
        isSent ? styles.messageBubbleSent : styles.messageBubbleReceived,
      ]}>
        <Text style={[
          styles.messageText,
          isSent ? styles.messageTextSent : styles.messageTextReceived,
        ]}>
          {message.text}
        </Text>
      </View>
      
      {/* Timestamp */}
      <Text style={[
        styles.messageTime,
        isSent ? styles.messageTimeSent : styles.messageTimeReceived,
      ]}>
        {formatMessageTime(message.timestamp)}
        {isSent && (
          <Text style={styles.messageStatus}>
            {message.read ? ' ✓✓' : message.delivered ? ' ✓✓' : ' ✓'}
          </Text>
        )}
      </Text>
    </View>
  );
});

// ============================================================
// ORDER REFERENCE CARD COMPONENT
// ============================================================
const OrderReferenceCard = memo(({ orderId, orderTotal, onViewOrder, onDismiss }) => (
  <View style={styles.orderCard}>
    <View style={styles.orderCardContent}>
      <View style={styles.orderCardInfo}>
        <Text style={styles.orderCardIcon}>📦</Text>
        <View>
          <Text style={styles.orderCardTitle}>Order #{orderId?.slice(-8).toUpperCase()}</Text>
          {orderTotal && (
            <Text style={styles.orderCardSubtitle}>₹{orderTotal.toFixed(2)}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity onPress={onViewOrder}>
        <Text style={styles.orderCardLink}>View Details</Text>
      </TouchableOpacity>
    </View>
    <TouchableOpacity style={styles.orderCardClose} onPress={onDismiss}>
      <Text style={styles.orderCardCloseText}>×</Text>
    </TouchableOpacity>
  </View>
));

// ============================================================
// EMPTY STATE COMPONENT
// ============================================================
const EmptyState = memo(({ partnerName }) => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyIcon}>💬</Text>
    <Text style={styles.emptyTitle}>Start the conversation</Text>
    <Text style={styles.emptySubtitle}>Say hi to {partnerName}!</Text>
  </View>
));

// ============================================================
// MAIN COMPONENT
// ============================================================
const ChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const flatListRef = useRef(null);

  // Route params
  const {
    orderId,
    sellerId,
    sellerName,
    buyerId,
    buyerName,
  } = route.params || {};

  // Redux state
  const currentUser = useSelector((state) => state.auth?.user);
  const currentUserId = currentUser?.uid;

  // Determine chat partner
  const isBuyer = currentUserId === buyerId || currentUserId !== sellerId;
  const partnerId = isBuyer ? sellerId : buyerId;
  const partnerName = isBuyer ? sellerName : buyerName;

  // Local state
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showOrderCard, setShowOrderCard] = useState(!!orderId);
  const [orderDetails, setOrderDetails] = useState(null);

  // Set up header
  useEffect(() => {
    navigation.setOptions({
      title: partnerName ? `${partnerName}'s Kitchen` : 'Chat',
      headerRight: () => (
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{getInitials(partnerName)}</Text>
        </View>
      ),
    });
  }, [navigation, partnerName]);

  // Find or create chat
  useEffect(() => {
    if (!currentUserId || !partnerId) {
      setLoading(false);
      return;
    }

    const findOrCreateChat = async () => {
      try {
        // First try to find existing chat by orderId
        if (orderId) {
          const orderChatsSnapshot = await firestore()
            .collection('chats')
            .where('orderId', '==', orderId)
            .limit(1)
            .get();

          if (!orderChatsSnapshot.empty) {
            setChatId(orderChatsSnapshot.docs[0].id);
            
            // Get order details
            const orderDoc = await firestore().collection('orders').doc(orderId).get();
            if (orderDoc.exists) {
              setOrderDetails(orderDoc.data());
            }
            return;
          }
        }

        // Find existing chat between participants
        const existingChatsSnapshot = await firestore()
          .collection('chats')
          .where('participants', 'array-contains', currentUserId)
          .get();

        const existingChat = existingChatsSnapshot.docs.find((doc) => {
          const data = doc.data();
          return data.participants?.includes(partnerId);
        });

        if (existingChat) {
          setChatId(existingChat.id);
          
          // Get order details if orderId exists
          const chatData = existingChat.data();
          if (chatData.orderId) {
            const orderDoc = await firestore().collection('orders').doc(chatData.orderId).get();
            if (orderDoc.exists) {
              setOrderDetails(orderDoc.data());
            }
          }
          return;
        }

        // Create new chat
        const newChatData = {
          participants: [currentUserId, partnerId],
          participantNames: {
            [currentUserId]: currentUser?.name || currentUser?.email || 'User',
            [partnerId]: partnerName || 'User',
          },
          orderId: orderId || null,
          lastMessage: null,
          lastMessageTime: null,
          unreadCount: {
            [currentUserId]: 0,
            [partnerId]: 0,
          },
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        };

        const newChatRef = await firestore().collection('chats').add(newChatData);
        setChatId(newChatRef.id);

        // Get order details if orderId exists
        if (orderId) {
          const orderDoc = await firestore().collection('orders').doc(orderId).get();
          if (orderDoc.exists) {
            setOrderDetails(orderDoc.data());
          }
        }
      } catch (error) {
        console.error('Error finding/creating chat:', error);
      } finally {
        setLoading(false);
      }
    };

    findOrCreateChat();
  }, [currentUserId, partnerId, orderId, currentUser, partnerName]);

  // Listen to messages
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot(
        (snapshot) => {
          const messagesData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setMessages(messagesData);
          setLoading(false);
        },
        (error) => {
          console.error('Messages listener error:', error);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [chatId]);

  // Mark messages as read
  useEffect(() => {
    if (!chatId || !currentUserId || messages.length === 0) return;

    const markAsRead = async () => {
      try {
        // Get unread messages from partner
        const unreadMessages = messages.filter(
          (msg) => msg.senderId !== currentUserId && !msg.read
        );

        // Update each unread message
        const batch = firestore().batch();
        unreadMessages.forEach((msg) => {
          const msgRef = firestore()
            .collection('chats')
            .doc(chatId)
            .collection('messages')
            .doc(msg.id);
          batch.update(msgRef, { read: true });
        });

        // Reset unread count for current user
        const chatRef = firestore().collection('chats').doc(chatId);
        batch.update(chatRef, {
          [`unreadCount.${currentUserId}`]: 0,
        });

        await batch.commit();
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    markAsRead();
  }, [chatId, currentUserId, messages]);

  // Send message
  const handleSend = useCallback(async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || !chatId || sending) return;

    setSending(true);
    setInputText('');
    Keyboard.dismiss();

    try {
      // Add message to subcollection
      await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .add({
          senderId: currentUserId,
          text: trimmedText,
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false,
          delivered: true,
        });

      // Update chat document
      await firestore()
        .collection('chats')
        .doc(chatId)
        .update({
          lastMessage: trimmedText,
          lastMessageTime: firestore.FieldValue.serverTimestamp(),
          [`unreadCount.${partnerId}`]: firestore.FieldValue.increment(1),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      // Send push notification to chat partner
      const currentUserName = currentUser?.displayName || currentUser?.firstName || 'Someone';
      const messagePreview = trimmedText.length > 50
        ? trimmedText.substring(0, 50) + '...'
        : trimmedText;
      const pushNotification = NotificationTemplates.newMessage(
        currentUserName,
        messagePreview,
        chatId
      );
      await sendNotificationToUser(partnerId, pushNotification);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(trimmedText); // Restore text on error
    } finally {
      setSending(false);
    }
  }, [inputText, chatId, currentUserId, partnerId, sending]);

  // View order details
  const handleViewOrder = useCallback(() => {
    if (orderId || orderDetails?.id) {
      navigation.navigate('OrderDetail', { orderId: orderId || orderDetails?.id });
    }
  }, [navigation, orderId, orderDetails]);

  // Render message item
  const renderMessage = useCallback(({ item, index }) => {
    const isSent = item.senderId === currentUserId;
    const prevMessage = messages[index - 1];
    const isGrouped = shouldGroupWithPrevious(item, prevMessage);
    const showDateSeparator = shouldShowDateSeparator(item, prevMessage);
    const showAvatar = !isGrouped;

    return (
      <>
        {showDateSeparator && (
          <DateSeparator date={formatDateSeparator(item.timestamp)} />
        )}
        <MessageBubble
          message={item}
          isSent={isSent}
          isGrouped={isGrouped}
          showAvatar={showAvatar}
          partnerName={partnerName}
        />
      </>
    );
  }, [currentUserId, messages, partnerName]);

  // Key extractor
  const keyExtractor = useCallback((item) => item.id, []);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Order Reference Card */}
        {showOrderCard && (orderId || orderDetails) && (
          <OrderReferenceCard
            orderId={orderId || orderDetails?.id}
            orderTotal={orderDetails?.totalAmount}
            onViewOrder={handleViewOrder}
            onDismiss={() => setShowOrderCard(false)}
          />
        )}

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.messagesContent,
            messages.length === 0 && styles.messagesContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState partnerName={partnerName} />}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onLayout={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
        />

        {/* Input Section */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.sendButtonIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textLight,
  },

  // Header
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Order Card
  orderCard: {
    backgroundColor: COLORS.infoLight,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderCardIcon: {
    fontSize: 24,
  },
  orderCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  orderCardSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  orderCardLink: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.info,
  },
  orderCardClose: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  orderCardCloseText: {
    fontSize: 20,
    color: COLORS.textMuted,
    fontWeight: '300',
  },

  // Messages List
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messagesContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // Date Separator
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dateSeparatorText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  // Message Row
  messageRow: {
    marginBottom: 12,
    maxWidth: '75%',
  },
  messageRowSent: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowReceived: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  messageRowGrouped: {
    marginBottom: 4,
  },

  // Avatar
  avatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  avatarSpacer: {
    width: 28,
    height: 28,
  },

  // Message Bubble
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '100%',
  },
  messageBubbleSent: {
    backgroundColor: COLORS.messageSent,
    borderBottomRightRadius: 4,
  },
  messageBubbleReceived: {
    backgroundColor: COLORS.messageReceived,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextSent: {
    color: COLORS.white,
  },
  messageTextReceived: {
    color: COLORS.text,
  },

  // Message Time
  messageTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  messageTimeSent: {
    textAlign: 'right',
  },
  messageTimeReceived: {
    marginLeft: 36, // Account for avatar width + margin
  },
  messageStatus: {
    color: COLORS.info,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // Input Section
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  sendButtonIcon: {
    fontSize: 18,
    color: COLORS.white,
    marginLeft: 2,
  },
});

export default ChatScreen;
