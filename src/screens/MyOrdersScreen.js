import React, { useEffect, useCallback, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';

// Redux
import {
  fetchSellerOrders,
  updateOrderStatus,
  selectActiveOrders,
  selectCompletedOrders,
  selectOrdersLoading,
  selectOrdersError,
} from '../redux/creatorOrdersSlice';

// Components
import OrderCard from '../components/OrderCard';

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
};

// ============================================================
// SECTION HEADER COMPONENT
// ============================================================
const SectionHeader = memo(({ title, count }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {count > 0 && (
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    )}
  </View>
));

// ============================================================
// EMPTY STATE COMPONENT
// ============================================================
const EmptyState = memo(({ isFinished }) => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyIcon}>{isFinished ? '📋' : '🍳'}</Text>
    <Text style={styles.emptyTitle}>
      {isFinished ? 'No completed orders yet' : 'No active orders'}
    </Text>
    <Text style={styles.emptySubtitle}>
      {isFinished
        ? 'Completed orders will appear here'
        : 'New orders for your food post will appear here'}
    </Text>
  </View>
));

// ============================================================
// TAB BUTTON COMPONENT
// ============================================================
const TabButton = memo(({ title, isActive, onPress, count }) => (
  <TouchableOpacity
    style={[styles.tabButton, isActive && styles.tabButtonActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
      {title}
    </Text>
    {count > 0 && (
      <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
        <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
          {count}
        </Text>
      </View>
    )}
  </TouchableOpacity>
));

// ============================================================
// MAIN COMPONENT
// ============================================================
const MyOrdersScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();

  // Get post info from navigation params (if navigating from specific post)
  const { postId, postTitle } = route.params || {};

  // Redux state
  const activeOrders = useSelector(selectActiveOrders);
  const completedOrders = useSelector(selectCompletedOrders);
  const loading = useSelector(selectOrdersLoading);
  const error = useSelector(selectOrdersError);
  const currentUser = useSelector((state) => state.auth?.user);

  // Local state
  const [activeTab, setActiveTab] = useState('active');
  const [refreshing, setRefreshing] = useState(false);

  // Filter orders by post if postId is provided
  const filteredActiveOrders = postId
    ? activeOrders.filter((order) => order.postId === postId)
    : activeOrders;

  const filteredCompletedOrders = postId
    ? completedOrders.filter((order) => order.postId === postId)
    : completedOrders;

  // Fetch orders on mount
  useEffect(() => {
    if (currentUser?.uid) {
      dispatch(fetchSellerOrders(currentUser.uid));
    }
  }, [dispatch, currentUser?.uid]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (!currentUser?.uid) return;
    setRefreshing(true);
    try {
      await dispatch(fetchSellerOrders(currentUser.uid)).unwrap();
    } catch (err) {
      console.error('Error refreshing orders:', err);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, currentUser?.uid]);

  // Handle status update
  const handleStatusUpdate = useCallback(async (orderId, newStatus, buyerId) => {
    const sellerName = currentUser?.displayName || currentUser?.name || 'Seller';
    
    // Confirmation for important status changes
    if (newStatus === 'ready') {
      Alert.alert(
        'Mark as Ready?',
        'The buyer will be notified that their order is ready for pickup.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark Ready',
            style: 'default',
            onPress: () => {
              dispatch(updateOrderStatus({ orderId, status: newStatus, buyerId, sellerName }));
            },
          },
        ]
      );
      return;
    }

    if (newStatus === 'completed') {
      Alert.alert(
        'Complete Order?',
        'Mark this order as picked up and completed?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete',
            style: 'default',
            onPress: () => {
              dispatch(updateOrderStatus({ orderId, status: newStatus, buyerId, sellerName }));
            },
          },
        ]
      );
      return;
    }

    // Direct update for other statuses
    dispatch(updateOrderStatus({ orderId, status: newStatus, buyerId, sellerName }));
  }, [dispatch, currentUser]);

  // Handle order card press
  const handleOrderPress = useCallback((order) => {
    // Could navigate to order details if needed
    console.log('Order pressed:', order.id);
  }, []);

  // Handle cancel order
  const handleCancelOrder = useCallback(async (orderId, buyerId, cancelNote) => {
    try {
      const sellerName = currentUser?.displayName || currentUser?.name || 'Seller';
      
      // Update order status to cancelled with the note
      await dispatch(updateOrderStatus({
        orderId,
        status: 'cancelled',
        buyerId,
        sellerName,
        cancelNote, // Pass the cancellation note
      })).unwrap();
      
      Alert.alert(
        'Order Cancelled',
        'The buyer has been notified about the cancellation.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Error cancelling order:', err);
      Alert.alert(
        'Error',
        'Failed to cancel the order. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [dispatch, currentUser]);

  // Handle message buyer
  const handleMessageBuyer = useCallback((order) => {
    navigation.navigate('Chat', {
      buyerId: order.buyerId,
      buyerName: order.buyerName,
      orderId: order.id,
      sellerId: currentUser?.uid,
      sellerName: currentUser?.displayName || currentUser?.name || 'Seller',
    });
  }, [navigation, currentUser]);

  // Render order card
  const renderOrderCard = useCallback(({ item }) => (
    <OrderCard
      order={item}
      isActive={activeTab === 'active'}
      onStatusUpdate={handleStatusUpdate}
      onCancelOrder={handleCancelOrder}
      onMessageBuyer={handleMessageBuyer}
      onPress={handleOrderPress}
    />
  ), [activeTab, handleStatusUpdate, handleCancelOrder, handleMessageBuyer, handleOrderPress]);

  // Render empty state
  const renderEmptyComponent = useCallback(() => (
    <EmptyState isFinished={activeTab !== 'active'} />
  ), [activeTab]);

  // Key extractor
  const keyExtractor = useCallback((item) => item.id, []);

  // Get current data based on active tab
  const currentData = activeTab === 'active' ? filteredActiveOrders : filteredCompletedOrders;

  // Show loading state
  if (loading && !refreshing && currentData.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error && currentData.length === 0) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Unable to load orders</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Post Title (if specific post) */}
      {postTitle && (
        <View style={styles.postHeader}>
          <Text style={styles.postTitle} numberOfLines={1}>
            📍 {postTitle}
          </Text>
        </View>
      )}

      {/* Tab Bar */}
      <View style={styles.tabContainer}>
        <TabButton
          title="Active"
          isActive={activeTab === 'active'}
          onPress={() => setActiveTab('active')}
          count={filteredActiveOrders.length}
        />
        <TabButton
          title="Completed"
          isActive={activeTab === 'completed'}
          onPress={() => setActiveTab('completed')}
          count={filteredCompletedOrders.length}
        />
      </View>

      {/* Orders List */}
      <FlatList
        data={currentData}
        renderItem={renderOrderCard}
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

  // Post Header
  postHeader: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Tab Bar
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  tabBadge: {
    marginLeft: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  tabBadgeTextActive: {
    color: COLORS.white,
  },

  // List
  listContent: {
    padding: 16,
    flexGrow: 1,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  countBadge: {
    marginLeft: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
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
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default MyOrdersScreen;
