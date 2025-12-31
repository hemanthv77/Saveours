import React, { useEffect, useCallback, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

// Redux
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  selectNotifications,
  selectUnreadCount,
  selectNotificationsLoading,
  selectNotificationsError,
} from '../redux/notificationsSlice';

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
  error: '#FF3B30',
  border: '#E0E0E0',
  success: '#34C759',
  unread: '#E8F4FF',
};

// Notification type configuration
const NOTIFICATION_CONFIG = {
  new_order: {
    icon: '🛒',
    color: COLORS.primary,
  },
  order_confirmed: {
    icon: '✅',
    color: COLORS.success,
  },
  order_preparing: {
    icon: '👨‍🍳',
    color: '#FF9800',
  },
  order_ready: {
    icon: '🍱',
    color: COLORS.success,
  },
  order_completed: {
    icon: '🎉',
    color: COLORS.success,
  },
  order_cancelled: {
    icon: '❌',
    color: COLORS.error,
  },
  message: {
    icon: '💬',
    color: '#2196F3',
  },
  default: {
    icon: '🔔',
    color: COLORS.textMuted,
  },
};

// Format timestamp
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
};

// ============================================================
// NOTIFICATION ITEM COMPONENT
// ============================================================
const NotificationItem = memo(({ notification, onPress }) => {
  const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.default;

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !notification.read && styles.notificationUnread,
      ]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
        <Text style={styles.iconText}>{config.icon}</Text>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Text style={[styles.title, !notification.read && styles.titleUnread]}>
          {notification.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.timestamp}>{formatTime(notification.createdAt)}</Text>
      </View>

      {/* Unread indicator */}
      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
});

// ============================================================
// EMPTY STATE COMPONENT
// ============================================================
const EmptyState = memo(() => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyIcon}>🔔</Text>
    <Text style={styles.emptyTitle}>No notifications yet</Text>
    <Text style={styles.emptySubtitle}>
      When someone orders from you or you receive updates, they'll appear here
    </Text>
  </View>
));

// ============================================================
// MAIN COMPONENT
// ============================================================
const NotificationsScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  // Redux state
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loading = useSelector(selectNotificationsLoading);
  const error = useSelector(selectNotificationsError);
  const currentUser = useSelector((state) => state.auth?.user);

  // Local state
  const [refreshing, setRefreshing] = useState(false);

  // Notifications are now subscribed globally via NotificationProvider
  // Just fetch once on mount as a fallback
  useEffect(() => {
    if (currentUser?.uid && notifications.length === 0) {
      dispatch(fetchNotifications(currentUser.uid));
    }
  }, [dispatch, currentUser?.uid, notifications.length]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (!currentUser?.uid) return;
    setRefreshing(true);
    try {
      await dispatch(fetchNotifications(currentUser.uid)).unwrap();
    } catch (err) {
      console.error('Error refreshing notifications:', err);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, currentUser?.uid]);

  // Handle mark all as read
  const handleMarkAllRead = useCallback(() => {
    if (unreadCount === 0) return;

    Alert.alert(
      'Mark All as Read',
      'Mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All Read',
          onPress: () => {
            if (currentUser?.uid) {
              dispatch(markAllNotificationsRead(currentUser.uid));
            }
          },
        },
      ]
    );
  }, [dispatch, currentUser?.uid, unreadCount]);

  // Handle notification press
  const handleNotificationPress = useCallback((notification) => {
    // Mark as read if unread
    if (!notification.read) {
      dispatch(markNotificationRead(notification.id));
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'new_order':
        // Navigate to My Orders screen with the specific post
        navigation.navigate('MyOrders', {
          postId: notification.data?.postId,
          postTitle: notification.data?.postTitle,
        });
        break;

      case 'order_confirmed':
      case 'order_preparing':
      case 'order_ready':
      case 'order_completed':
      case 'order_cancelled':
        // Navigate to order tracking or chat
        if (notification.data?.orderId) {
          // Could navigate to order tracking screen
          navigation.navigate('Chat', {
            channelId: notification.data?.chatChannelId,
            orderId: notification.data?.orderId,
          });
        }
        break;

      case 'message':
        // Navigate to chat
        if (notification.data?.chatChannelId) {
          navigation.navigate('Chat', {
            channelId: notification.data?.chatChannelId,
          });
        }
        break;

      default:
        // Default navigation - could show notification details
        console.log('Notification pressed:', notification);
    }
  }, [dispatch, navigation]);

  // Render notification item
  const renderNotificationItem = useCallback(({ item }) => (
    <NotificationItem
      notification={item}
      onPress={handleNotificationPress}
    />
  ), [handleNotificationPress]);

  // Key extractor
  const keyExtractor = useCallback((item) => item.id, []);

  // Render empty component
  const renderEmptyComponent = useCallback(() => <EmptyState />, []);

  // Show loading state
  if (loading && !refreshing && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Unable to load notifications</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header Actions */}
      {notifications.length > 0 && unreadCount > 0 && (
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
          >
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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

  // Loading State
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // Error State
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Header Actions
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  markAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // List
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  // Notification Item
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notificationUnread: {
    backgroundColor: COLORS.unread,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  titleUnread: {
    fontWeight: '700',
  },
  body: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 18,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;
