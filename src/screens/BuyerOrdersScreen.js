import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import firestore from '@react-native-firebase/firestore';

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
  warning: '#FF9500',
  info: '#007AFF',
  purple: '#AF52DE',
};

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    backgroundColor: '#FFF3E0',
    textColor: '#E65100',
    icon: '⏳',
  },
  confirmed: {
    label: 'Confirmed',
    backgroundColor: '#E3F2FD',
    textColor: '#1565C0',
    icon: '✓',
  },
  preparing: {
    label: 'Preparing',
    backgroundColor: '#F3E5F5',
    textColor: '#7B1FA2',
    icon: '👨‍🍳',
  },
  ready: {
    label: 'Ready for Pickup',
    backgroundColor: '#E8F5E9',
    textColor: '#2E7D32',
    icon: '🎉',
  },
  completed: {
    label: 'Completed',
    backgroundColor: '#F5F5F5',
    textColor: '#616161',
    icon: '✅',
  },
  cancelled: {
    label: 'Cancelled',
    backgroundColor: '#FFEBEE',
    textColor: '#C62828',
    icon: '❌',
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Format date for display
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp.toDate?.() || new Date(timestamp);
  
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Format relative time
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp.toDate?.() || new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(timestamp);
};

// Get initials from name
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Get items summary
const getItemsSummary = (items) => {
  if (!items || items.length === 0) return 'No items';
  
  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const itemNames = items.slice(0, 2).map((item) => {
    const qty = item.quantity || 1;
    const name = item.dishName || item.name || 'Item';
    return `${qty}x ${name}`;
  });
  
  let summary = itemNames.join(', ');
  if (items.length > 2) {
    summary += '...';
  }
  
  return { totalItems, summary };
};

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
// STATUS BADGE COMPONENT
// ============================================================
const StatusBadge = memo(({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.statusBadgeText, { color: config.textColor }]}>
        {config.label}
      </Text>
    </View>
  );
});

// ============================================================
// ORDER CARD COMPONENT
// ============================================================
const OrderCard = memo(({ order, onViewDetails, onMessageSeller }) => {
  const statusConfig = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.pending;
  const { totalItems, summary } = getItemsSummary(order.items);
  const isActive = ['pending', 'confirmed', 'preparing', 'ready'].includes(order.orderStatus);

  return (
    <View style={styles.orderCard}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.sellerInfo}>
          {order.sellerAvatar ? (
            <Image source={{ uri: order.sellerAvatar }} style={styles.sellerAvatar} />
          ) : (
            <View style={styles.sellerAvatarFallback}>
              <Text style={styles.sellerAvatarText}>
                {getInitials(order.sellerName)}
              </Text>
            </View>
          )}
          <View style={styles.sellerDetails}>
            <Text style={styles.sellerName} numberOfLines={1}>
              {order.sellerName || 'Seller'}'s Kitchen
            </Text>
            <Text style={styles.orderTime}>{formatRelativeTime(order.createdAt)}</Text>
          </View>
        </View>
        <StatusBadge status={order.orderStatus} />
      </View>

      {/* Order Details */}
      <View style={styles.orderDetails}>
        <Text style={styles.orderId}>Order #{order.id?.slice(-8).toUpperCase()}</Text>
        <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        <View style={styles.itemsRow}>
          <Text style={styles.itemsCount}>{totalItems} item{totalItems !== 1 ? 's' : ''}</Text>
          <Text style={styles.itemsDot}>•</Text>
          <Text style={styles.orderTotal}>₹{(order.totalAmount || 0).toFixed(2)}</Text>
        </View>
        <Text style={styles.itemsSummary} numberOfLines={1}>{summary}</Text>
      </View>

      {/* Status-Specific Info */}
      <View style={styles.statusInfo}>
        {order.orderStatus === 'pending' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>⏳</Text>
            <Text style={styles.infoText}>Waiting for seller to confirm your order</Text>
          </View>
        )}
        
        {order.orderStatus === 'confirmed' && (
          <View style={[styles.infoBox, { backgroundColor: '#E3F2FD' }]}>
            <Text style={styles.infoIcon}>✓</Text>
            <Text style={styles.infoText}>Order confirmed! Seller will start preparing soon</Text>
          </View>
        )}
        
        {order.orderStatus === 'preparing' && (
          <View style={[styles.infoBox, { backgroundColor: '#F3E5F5' }]}>
            <Text style={styles.infoIcon}>👨‍🍳</Text>
            <Text style={styles.infoText}>Your order is being prepared</Text>
          </View>
        )}
        
        {order.orderStatus === 'ready' && (
          <View style={[styles.infoBox, { backgroundColor: '#E8F5E9' }]}>
            <Text style={styles.infoIcon}>🎉</Text>
            <View style={styles.infoContent}>
              <Text style={[styles.infoText, { fontWeight: '700', color: '#2E7D32' }]}>
                Ready for pickup!
              </Text>
              {order.pickupLocation && (
                <Text style={styles.pickupLocation}>📍 {order.pickupLocation}</Text>
              )}
            </View>
          </View>
        )}
        
        {order.orderStatus === 'completed' && (
          <View style={[styles.infoBox, { backgroundColor: '#F5F5F5' }]}>
            <Text style={styles.infoIcon}>✅</Text>
            <Text style={styles.infoText}>
              Completed on {formatDate(order.completedAt || order.updatedAt)}
            </Text>
          </View>
        )}
        
        {order.orderStatus === 'cancelled' && (
          <View style={[styles.infoBox, { backgroundColor: '#FFEBEE' }]}>
            <Text style={styles.infoIcon}>❌</Text>
            <View style={styles.infoContent}>
              <Text style={[styles.infoText, { color: '#C62828' }]}>Order cancelled</Text>
              {order.cancelNote && (
                <Text style={styles.cancelReason}>Reason: {order.cancelNote}</Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.outlinedButton}
          onPress={() => onViewDetails(order)}
          activeOpacity={0.7}
        >
          <Text style={styles.outlinedButtonText}>View Details</Text>
        </TouchableOpacity>
        
        {isActive && (
          <TouchableOpacity
            style={styles.filledButton}
            onPress={() => onMessageSeller(order)}
            activeOpacity={0.7}
          >
            <Text style={styles.filledButtonText}>Message Seller</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// ============================================================
// EMPTY STATE COMPONENT
// ============================================================
const EmptyState = memo(({ isActive, onBrowseFood }) => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyIcon}>{isActive ? '🛒' : '📋'}</Text>
    <Text style={styles.emptyTitle}>
      {isActive ? 'No active orders' : 'No past orders yet'}
    </Text>
    <Text style={styles.emptySubtitle}>
      {isActive
        ? 'Browse delicious homemade food from your community'
        : 'Your completed and cancelled orders will appear here'}
    </Text>
    {isActive && (
      <TouchableOpacity style={styles.browseButton} onPress={onBrowseFood}>
        <Text style={styles.browseButtonText}>Browse Food</Text>
      </TouchableOpacity>
    )}
  </View>
));

// ============================================================
// MAIN COMPONENT
// ============================================================
const BuyerOrdersScreen = () => {
  const navigation = useNavigation();
  const currentUser = useSelector((state) => state.auth?.user);

  // Local state
  const [activeTab, setActiveTab] = useState('active');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previousStatuses, setPreviousStatuses] = useState({});

  // Filtered orders based on active tab
  const activeOrders = orders.filter((o) =>
    ['pending', 'confirmed', 'preparing', 'ready'].includes(o.orderStatus)
  );
  const pastOrders = orders.filter((o) =>
    ['completed', 'cancelled'].includes(o.orderStatus)
  );
  const currentOrders = activeTab === 'active' ? activeOrders : pastOrders;

  // Real-time listener for orders
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = firestore()
      .collection('orders')
      .where('buyerId', '==', currentUser.uid)
      .onSnapshot(
        (snapshot) => {
          const ordersData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toMillis?.() || Date.now(),
            updatedAt: doc.data().updatedAt?.toMillis?.() || Date.now(),
            completedAt: doc.data().completedAt?.toMillis?.() || null,
          }));

          // Sort by createdAt descending
          ordersData.sort((a, b) => b.createdAt - a.createdAt);

          // Check for status changes and show toast
          ordersData.forEach((order) => {
            const prevStatus = previousStatuses[order.id];
            if (prevStatus && prevStatus !== order.orderStatus) {
              // Status changed - show appropriate alert
              showStatusChangeAlert(order.orderStatus, order.sellerName);
            }
          });

          // Update previous statuses
          const newStatuses = {};
          ordersData.forEach((order) => {
            newStatuses[order.id] = order.orderStatus;
          });
          setPreviousStatuses(newStatuses);

          setOrders(ordersData);
          setLoading(false);
          setRefreshing(false);
        },
        (error) => {
          console.error('Orders listener error:', error);
          setLoading(false);
          setRefreshing(false);
        }
      );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Show status change alert
  const showStatusChangeAlert = useCallback((newStatus, sellerName) => {
    const messages = {
      confirmed: `${sellerName || 'The seller'} has confirmed your order!`,
      preparing: `${sellerName || 'The seller'} is now preparing your order!`,
      ready: 'Your order is ready for pickup! 🎉',
      completed: 'Your order has been marked as completed. Thank you!',
      cancelled: 'Unfortunately, your order has been cancelled.',
    };

    const message = messages[newStatus];
    if (message) {
      Alert.alert('Order Update', message, [{ text: 'OK' }]);
    }
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // The onSnapshot listener will handle the refresh
  }, []);

  // Handle view details
  const handleViewDetails = useCallback((order) => {
    navigation.navigate('OrderDetail', { orderId: order.id });
  }, [navigation]);

  // Handle message seller
  const handleMessageSeller = useCallback((order) => {
    navigation.navigate('Chat', {
      sellerId: order.sellerId,
      sellerName: order.sellerName,
      orderId: order.id,
      buyerId: currentUser?.uid,
      buyerName: currentUser?.name || order.buyerName,
    });
  }, [navigation, currentUser]);

  // Handle browse food
  const handleBrowseFood = useCallback(() => {
    navigation.navigate('Communities');
  }, [navigation]);

  // Render order card
  const renderOrderCard = useCallback(({ item }) => (
    <OrderCard
      order={item}
      onViewDetails={handleViewDetails}
      onMessageSeller={handleMessageSeller}
    />
  ), [handleViewDetails, handleMessageSeller]);

  // Render empty component
  const renderEmptyComponent = useCallback(() => (
    <EmptyState
      isActive={activeTab === 'active'}
      onBrowseFood={handleBrowseFood}
    />
  ), [activeTab, handleBrowseFood]);

  // Key extractor
  const keyExtractor = useCallback((item) => item.id, []);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your orders...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab Bar */}
      <View style={styles.tabContainer}>
        <TabButton
          title="Active"
          isActive={activeTab === 'active'}
          onPress={() => setActiveTab('active')}
          count={activeOrders.length}
        />
        <TabButton
          title="Past"
          isActive={activeTab === 'past'}
          onPress={() => setActiveTab('past')}
          count={pastOrders.length}
        />
      </View>

      {/* Orders List */}
      <FlatList
        data={currentOrders}
        renderItem={renderOrderCard}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonIcon: {
    fontSize: 24,
    color: COLORS.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 40,
  },

  // Tab Bar
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: COLORS.background,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabBadgeTextActive: {
    color: COLORS.white,
  },

  // List
  listContent: {
    padding: 16,
    flexGrow: 1,
  },

  // Order Card
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sellerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sellerDetails: {
    marginLeft: 10,
    flex: 1,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  orderTime: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Status Badge
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Order Details
  orderDetails: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderId: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemsCount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemsDot: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginHorizontal: 8,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  itemsSummary: {
    fontSize: 14,
    color: COLORS.textLight,
  },

  // Status Info
  statusInfo: {
    marginTop: 12,
    marginBottom: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  infoContent: {
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  pickupLocation: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
  },
  cancelReason: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  outlinedButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlinedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  filledButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filledButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default BuyerOrdersScreen;
