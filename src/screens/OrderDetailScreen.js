import React, { useState, useEffect, useCallback, useLayoutEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import firestore from '@react-native-firebase/firestore';
import Clipboard from '@react-native-clipboard/clipboard';

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
  errorLight: '#FFEBEE',
  success: '#34C759',
  successLight: '#E8F5E9',
  warning: '#FF9500',
  warningLight: '#FFF3E0',
  info: '#007AFF',
  infoLight: '#E3F2FD',
  purple: '#AF52DE',
  purpleLight: '#F3E5F5',
};

const STATUS_CONFIG = {
  pending: {
    label: 'Order Placed',
    description: 'Waiting for seller to confirm your order',
    backgroundColor: COLORS.warningLight,
    color: '#E65100',
    icon: '⏳',
    step: 1,
  },
  confirmed: {
    label: 'Confirmed',
    description: 'Your order has been confirmed!',
    backgroundColor: COLORS.infoLight,
    color: '#1565C0',
    icon: '✓',
    step: 2,
  },
  preparing: {
    label: 'Preparing',
    description: 'Your order is being prepared with care',
    backgroundColor: COLORS.purpleLight,
    color: '#7B1FA2',
    icon: '👨‍🍳',
    step: 3,
  },
  ready: {
    label: 'Ready for Pickup',
    description: 'Your order is ready! Pick it up now',
    backgroundColor: COLORS.successLight,
    color: '#2E7D32',
    icon: '🎉',
    step: 4,
  },
  completed: {
    label: 'Completed',
    description: 'Order successfully completed. Thank you!',
    backgroundColor: '#F5F5F5',
    color: '#616161',
    icon: '✅',
    step: 5,
  },
  cancelled: {
    label: 'Cancelled',
    description: 'This order has been cancelled',
    backgroundColor: COLORS.errorLight,
    color: '#C62828',
    icon: '❌',
    step: 0,
  },
};

const PROGRESS_STEPS = [
  { key: 'pending', label: 'Placed', step: 1 },
  { key: 'confirmed', label: 'Confirmed', step: 2 },
  { key: 'preparing', label: 'Preparing', step: 3 },
  { key: 'ready', label: 'Ready', step: 4 },
  { key: 'completed', label: 'Completed', step: 5 },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// ============================================================
// PROGRESS BAR COMPONENT
// ============================================================
const ProgressBar = memo(({ currentStep }) => {
  if (currentStep === 0) return null; // Don't show for cancelled

  return (
    <View style={styles.progressContainer}>
      {PROGRESS_STEPS.map((step, index) => {
        const isActive = step.step <= currentStep;
        const isCurrentStep = step.step === currentStep;
        const isLast = index === PROGRESS_STEPS.length - 1;

        return (
          <View key={step.key} style={styles.progressStepWrapper}>
            <View style={styles.progressStep}>
              <View style={[
                styles.progressCircle,
                isActive && styles.progressCircleActive,
                isCurrentStep && styles.progressCircleCurrent,
              ]}>
                {isActive && <Text style={styles.progressCheckmark}>✓</Text>}
              </View>
              <Text style={[
                styles.progressLabel,
                isActive && styles.progressLabelActive,
              ]}>
                {step.label}
              </Text>
            </View>
            {!isLast && (
              <View style={[
                styles.progressLine,
                isActive && step.step < currentStep && styles.progressLineActive,
              ]} />
            )}
          </View>
        );
      })}
    </View>
  );
});

// ============================================================
// SECTION CARD COMPONENT
// ============================================================
const SectionCard = memo(({ title, icon, children, style }) => (
  <View style={[styles.sectionCard, style]}>
    {title && (
      <View style={styles.sectionHeader}>
        {icon && <Text style={styles.sectionIcon}>{icon}</Text>}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    )}
    {children}
  </View>
));

// ============================================================
// ORDER ITEM ROW COMPONENT
// ============================================================
const OrderItemRow = memo(({ item }) => (
  <View style={styles.orderItemRow}>
    {item.dishPhoto ? (
      <Image source={{ uri: item.dishPhoto }} style={styles.itemPhoto} />
    ) : (
      <View style={styles.itemPhotoPlaceholder}>
        <Text style={styles.itemPhotoPlaceholderText}>🍽️</Text>
      </View>
    )}
    <View style={styles.itemDetails}>
      <Text style={styles.itemName} numberOfLines={1}>{item.dishName || 'Item'}</Text>
      <Text style={styles.itemPrice}>₹{item.pricePerPortion || 0} × {item.quantity || 1}</Text>
    </View>
    <Text style={styles.itemSubtotal}>₹{((item.pricePerPortion || 0) * (item.quantity || 1)).toFixed(2)}</Text>
  </View>
));

// ============================================================
// MAIN COMPONENT
// ============================================================
const OrderDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId } = route.params || {};

  const currentUser = useSelector((state) => state.auth?.user);

  // State
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Determine user role
  const isBuyer = order?.buyerId === currentUser?.uid;
  const isSeller = order?.sellerId === currentUser?.uid;
  const statusConfig = STATUS_CONFIG[order?.orderStatus] || STATUS_CONFIG.pending;

  // Handle need help - defined early for header
  const handleNeedHelp = useCallback(() => {
    Alert.alert(
      'Need Help?',
      'For any issues with your order, please message the seller directly or contact support.',
      [
        { text: 'Close', style: 'cancel' },
        { 
          text: 'Message Seller', 
          onPress: () => {
            if (order) {
              navigation.navigate('Chat', {
                sellerId: order.sellerId,
                sellerName: order.sellerName,
                orderId: order.id,
                buyerId: currentUser?.uid,
                buyerName: currentUser?.name || order.buyerName,
              });
            }
          },
        },
      ]
    );
  }, [order, navigation, currentUser]);

  // Set up header with "Need Help?" button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={handleNeedHelp}
          style={styles.headerHelpButton}
        >
          <Text style={styles.headerHelpText}>Need Help?</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleNeedHelp]);

  // Real-time order listener
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('orders')
      .doc(orderId)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            const data = doc.data();
            setOrder({
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toMillis?.() || Date.now(),
              updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
              completedAt: data.completedAt?.toMillis?.() || null,
              cancelledAt: data.cancelledAt?.toMillis?.() || null,
            });
          } else {
            setOrder(null);
          }
          setLoading(false);
        },
        (error) => {
          console.error('Order listener error:', error);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [orderId]);

  // Copy order ID
  const handleCopyOrderId = useCallback(() => {
    if (orderId) {
      Clipboard.setString(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [orderId]);

  // Open maps for directions
  const handleGetDirections = useCallback(() => {
    const address = order?.pickupLocation || order?.sellerAddress;
    if (!address) {
      Alert.alert('No Location', 'Pickup location is not available.');
      return;
    }

    const encodedAddress = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps://app?daddr=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`,
    });

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback to Google Maps web
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
        }
      })
      .catch((err) => {
        console.error('Error opening maps:', err);
        Alert.alert('Error', 'Could not open maps application.');
      });
  }, [order]);

  // Message seller
  const handleMessageSeller = useCallback(() => {
    navigation.navigate('Chat', {
      sellerId: order?.sellerId,
      sellerName: order?.sellerName,
      orderId: order?.id,
      buyerId: currentUser?.uid,
      buyerName: currentUser?.name || order?.buyerName,
    });
  }, [navigation, order, currentUser]);

  // Handle cancel order (buyer)
  const handleCancelOrder = useCallback(async () => {
    if (!order) return;

    setCancelling(true);
    try {
      const orderRef = firestore().collection('orders').doc(order.id);

      // Update order status
      await orderRef.update({
        orderStatus: 'cancelled',
        cancelNote: cancelReason.trim() || 'Cancelled by buyer',
        cancelledBy: 'buyer',
        cancelledAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      // Release reserved portions if applicable
      if (order.postId && order.items) {
        try {
          const postRef = firestore().collection('posts').doc(order.postId);
          let totalPortions = 0;
          order.items.forEach((item) => {
            totalPortions += item.quantity || 1;
          });

          await postRef.update({
            portionsAvailable: firestore.FieldValue.increment(totalPortions),
            portionsReserved: firestore.FieldValue.increment(-totalPortions),
          });
        } catch (releaseErr) {
          console.error('Error releasing portions:', releaseErr);
        }
      }

      // Create notification for seller
      await firestore().collection('notifications').add({
        userId: order.sellerId,
        type: 'order_cancelled',
        title: 'Order Cancelled',
        body: `${order.buyerName || 'A buyer'} cancelled their order${cancelReason ? `: ${cancelReason}` : ''}`,
        data: {
          orderId: order.id,
          postId: order.postId,
        },
        read: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      setShowCancelModal(false);
      setCancelReason('');
      Alert.alert('Order Cancelled', 'Your order has been cancelled successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Cancel order error:', error);
      Alert.alert('Error', 'Failed to cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  }, [order, cancelReason, navigation]);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </SafeAreaView>
    );
  }

  // Not found state
  if (!order) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorIcon}>📋</Text>
        <Text style={styles.errorTitle}>Order Not Found</Text>
        <Text style={styles.errorSubtitle}>This order may have been deleted or doesn't exist.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const canCancel = isBuyer && ['pending', 'confirmed'].includes(order.orderStatus);
  const isActive = ['pending', 'confirmed', 'preparing', 'ready'].includes(order.orderStatus);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Section */}
        <View style={[styles.statusSection, { backgroundColor: statusConfig.backgroundColor }]}>
          <Text style={styles.statusIcon}>{statusConfig.icon}</Text>
          <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
          <Text style={styles.statusDescription}>{statusConfig.description}</Text>
          
          {/* Progress Bar */}
          {order.orderStatus !== 'cancelled' && (
            <ProgressBar currentStep={statusConfig.step} />
          )}
        </View>

        {/* Ready for Pickup Alert */}
        {order.orderStatus === 'ready' && (
          <View style={styles.readyAlert}>
            <Text style={styles.readyAlertIcon}>🎉</Text>
            <View style={styles.readyAlertContent}>
              <Text style={styles.readyAlertTitle}>Ready for Pickup!</Text>
              <Text style={styles.readyAlertText}>
                Your order is ready. Please pick it up as soon as possible.
              </Text>
            </View>
          </View>
        )}

        {/* Cancellation Info */}
        {order.orderStatus === 'cancelled' && (
          <View style={styles.cancelledInfo}>
            <Text style={styles.cancelledIcon}>❌</Text>
            <View style={styles.cancelledContent}>
              <Text style={styles.cancelledTitle}>Order Cancelled</Text>
              {order.cancelNote && (
                <Text style={styles.cancelledReason}>Reason: {order.cancelNote}</Text>
              )}
              <Text style={styles.cancelledBy}>
                Cancelled by: {order.cancelledBy === 'buyer' ? 'You' : 'Seller'}
              </Text>
            </View>
          </View>
        )}

        {/* Seller Information */}
        <SectionCard title="Seller Information" icon="👨‍🍳">
          <View style={styles.sellerCard}>
            <View style={styles.sellerHeader}>
              {order.sellerAvatar ? (
                <Image source={{ uri: order.sellerAvatar }} style={styles.sellerAvatar} />
              ) : (
                <View style={styles.sellerAvatarFallback}>
                  <Text style={styles.sellerAvatarText}>{getInitials(order.sellerName)}</Text>
                </View>
              )}
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{order.sellerName || 'Seller'}'s Kitchen</Text>
                <Text style={styles.sellerSubtext}>Food Creator</Text>
              </View>
            </View>

            {order.pickupLocation && (
              <View style={styles.locationRow}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={styles.locationText}>{order.pickupLocation}</Text>
              </View>
            )}

            <View style={styles.sellerActions}>
              {order.pickupLocation && (
                <TouchableOpacity 
                  style={styles.directionButton}
                  onPress={handleGetDirections}
                  activeOpacity={0.7}
                >
                  <Text style={styles.directionButtonIcon}>🗺️</Text>
                  <Text style={styles.directionButtonText}>Get Directions</Text>
                </TouchableOpacity>
              )}
              
              {isActive && (
                <TouchableOpacity 
                  style={styles.messageButton}
                  onPress={handleMessageSeller}
                  activeOpacity={0.7}
                >
                  <Text style={styles.messageButtonIcon}>💬</Text>
                  <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SectionCard>

        {/* Order Items */}
        <SectionCard title="Order Items" icon="🍽️">
          {order.items?.map((item, index) => (
            <OrderItemRow key={item.dishId || index} item={item} />
          ))}
          
          <View style={styles.itemsDivider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Total ({order.items?.reduce((sum, i) => sum + (i.quantity || 1), 0)} items)
            </Text>
            <Text style={styles.totalAmount}>₹{(order.totalAmount || 0).toFixed(2)}</Text>
          </View>
        </SectionCard>

        {/* Payment Information */}
        <SectionCard title="Payment" icon="💳">
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Method</Text>
            <Text style={styles.paymentValue}>
              {order.paymentMethod === 'cash' ? '💵 Cash on Pickup' : '📱 UPI on Pickup'}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Status</Text>
            <Text style={[styles.paymentValue, { color: order.orderStatus === 'completed' ? COLORS.success : COLORS.warning }]}>
              {order.orderStatus === 'completed' ? 'Paid' : 'Pay when you pick up'}
            </Text>
          </View>
          
          <View style={styles.paymentDivider} />
          
          <View style={styles.paymentBreakdown}>
            <View style={styles.paymentBreakdownRow}>
              <Text style={styles.breakdownLabel}>Items Total</Text>
              <Text style={styles.breakdownValue}>₹{(order.subtotal || order.totalAmount || 0).toFixed(2)}</Text>
            </View>
            {order.platformFee > 0 && (
              <View style={styles.paymentBreakdownRow}>
                <Text style={styles.breakdownLabel}>Platform Fee</Text>
                <Text style={styles.breakdownValue}>₹{(order.platformFee || 0).toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.paymentBreakdownRow}>
              <Text style={styles.breakdownLabelBold}>Total</Text>
              <Text style={styles.breakdownValueBold}>₹{(order.totalAmount || 0).toFixed(2)}</Text>
            </View>
          </View>
        </SectionCard>

        {/* Order Information */}
        <SectionCard title="Order Information" icon="📋">
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order ID</Text>
            <TouchableOpacity style={styles.copyRow} onPress={handleCopyOrderId}>
              <Text style={styles.infoValue}>#{order.id?.slice(-8).toUpperCase()}</Text>
              <Text style={styles.copyIcon}>{copied ? '✓' : '📋'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order Date</Text>
            <Text style={styles.infoValue}>{formatDate(order.createdAt)}</Text>
          </View>
          {order.specialInstructions && (
            <View style={styles.instructionsBox}>
              <Text style={styles.instructionsLabel}>Special Instructions</Text>
              <Text style={styles.instructionsText}>{order.specialInstructions}</Text>
            </View>
          )}
        </SectionCard>

        {/* Spacing for bottom actions */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {isActive && (
          <>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleMessageSeller}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonIcon}>💬</Text>
              <Text style={styles.primaryButtonText}>Message Seller</Text>
            </TouchableOpacity>

            {canCancel && (
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowCancelModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel Order</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {order.orderStatus === 'completed' && (
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => Alert.alert('Coming Soon', 'Rating feature will be available soon!')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonIcon}>⭐</Text>
            <Text style={styles.secondaryButtonText}>Rate Order</Text>
          </TouchableOpacity>
        )}

        {order.orderStatus === 'cancelled' && (
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Communities')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Browse Food</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cancel Order Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Order?</Text>
            <Text style={styles.modalSubtitle}>
              Are you sure you want to cancel this order? The seller will be notified.
            </Text>

            <TextInput
              style={styles.cancelInput}
              placeholder="Reason for cancellation (optional)"
              placeholderTextColor={COLORS.textMuted}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              maxLength={200}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                disabled={cancelling}
              >
                <Text style={styles.modalCancelBtnText}>Go Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, cancelling && styles.modalConfirmBtnDisabled]}
                onPress={handleCancelOrder}
                disabled={cancelling}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {cancelling ? 'Cancelling...' : 'Cancel Order'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
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
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Header Help Button
  headerHelpButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerHelpText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Status Section
  statusSection: {
    padding: 24,
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Progress Bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10,
  },
  progressStepWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressStep: {
    alignItems: 'center',
    width: 55,
  },
  progressCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressCircleActive: {
    backgroundColor: COLORS.success,
  },
  progressCircleCurrent: {
    backgroundColor: COLORS.primary,
  },
  progressCheckmark: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  progressLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  progressLine: {
    width: 20,
    height: 2,
    backgroundColor: COLORS.border,
    marginTop: 11,
  },
  progressLineActive: {
    backgroundColor: COLORS.success,
  },

  // Ready Alert
  readyAlert: {
    flexDirection: 'row',
    backgroundColor: COLORS.successLight,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  readyAlertIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  readyAlertContent: {
    flex: 1,
  },
  readyAlertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 4,
  },
  readyAlertText: {
    fontSize: 14,
    color: COLORS.textLight,
  },

  // Cancelled Info
  cancelledInfo: {
    flexDirection: 'row',
    backgroundColor: COLORS.errorLight,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  cancelledIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  cancelledContent: {
    flex: 1,
  },
  cancelledTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 4,
  },
  cancelledReason: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  cancelledBy: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // Section Card
  sectionCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Seller Card
  sellerCard: {},
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  sellerAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sellerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  sellerSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  sellerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  directionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  directionButtonIcon: {
    fontSize: 16,
  },
  directionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  messageButtonIcon: {
    fontSize: 16,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Order Items
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemPhoto: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  itemPhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemPhotoPlaceholderText: {
    fontSize: 20,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  itemSubtotal: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Payment
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  paymentBreakdown: {},
  paymentBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  breakdownValue: {
    fontSize: 14,
    color: COLORS.text,
  },
  breakdownLabelBold: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  breakdownValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Order Info
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyIcon: {
    fontSize: 14,
  },
  instructionsBox: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  instructionsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  instructionsText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },

  // Bottom Actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonIcon: {
    fontSize: 18,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  cancelButton: {
    paddingHorizontal: 20,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  secondaryButtonIcon: {
    fontSize: 18,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 16,
    lineHeight: 20,
  },
  cancelInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  modalCancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.error,
  },
  modalConfirmBtnDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  modalConfirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default OrderDetailScreen;
